import { Env } from '../types';

export interface VideoMetadata {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  thumbnailUrl: string;
  durationSec: number;
  captionStatus: 'READY' | 'NO_CAPTIONS' | 'BUDGET_DEFERRED' | 'PENDING' | 'PROCESSING';
  language?: string;
  windowCount?: number;
}

export class YouTubeDiscoveryService {
  private env: Env;
  private apiKey?: string;

  constructor(env: Env) {
    this.env = env;
    this.apiKey = env.YOUTUBE_DATA_API_KEY;
  }

  /**
   * Extracts clean 11-character YouTube video ID from various URL formats or raw ID.
   */
  static extractVideoId(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    const regExp = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(regExp);
    return match ? match[1] : null;
  }

  /**
   * Parses ISO 8601 duration (e.g. PT1H12M30S) into integer seconds.
   */
  static parseIsoDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Checks remaining daily YouTube API quota
   */
  private async checkQuota(): Promise<boolean> {
    if (!this.env.DB) return true;
    const todayUtc = new Date().toISOString().split('T')[0];
    const cap = parseInt(this.env.YOUTUBE_DAILY_SEARCH_BUDGET || '90', 10);
    try {
      const row = await this.env.DB.prepare(
        `SELECT count_value FROM quota_counters WHERE date_utc = ?1 AND metric_name = 'YOUTUBE_SEARCHES'`
      )
        .bind(todayUtc)
        .first<{ count_value: number }>();
      return (row?.count_value ?? 0) < cap;
    } catch {
      return true;
    }
  }

  private async incrementQuota(): Promise<void> {
    if (!this.env.DB) return;
    const todayUtc = new Date().toISOString().split('T')[0];
    try {
      await this.env.DB.prepare(
        `INSERT INTO quota_counters (date_utc, metric_name, count_value, last_updated_at)
         VALUES (?1, 'YOUTUBE_SEARCHES', 1, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
         ON CONFLICT(date_utc, metric_name)
         DO UPDATE SET count_value = count_value + 1, last_updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
      )
        .bind(todayUtc)
        .run();
    } catch (e) {
      console.warn('[YouTubeDiscovery] Failed to increment quota:', e);
    }
  }

  /**
   * Resolves a video ID or URL: returns D1 cached metadata or queries YouTube Data API.
   */
  async resolveVideo(urlOrId: string): Promise<VideoMetadata | null> {
    const videoId = YouTubeDiscoveryService.extractVideoId(urlOrId);
    if (!videoId) return null;

    // 1. Check D1 first
    if (this.env.DB) {
      try {
        const cached = await this.env.DB.prepare(
          `SELECT video_id, title, channel_title, channel_id, thumbnail_url, duration_sec, caption_status, language, window_count
           FROM videos WHERE video_id = ?1`
        )
          .bind(videoId)
          .first<{
            video_id: string;
            title: string;
            channel_title: string;
            channel_id: string | null;
            thumbnail_url: string | null;
            duration_sec: number;
            caption_status: string;
            language: string;
            window_count: number;
          }>();

        if (cached) {
          // Touch access count
          await this.env.DB.prepare(
            `UPDATE videos SET access_count = access_count + 1, last_accessed_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE video_id = ?1`
          )
            .bind(videoId)
            .run();

          return {
            videoId: cached.video_id,
            title: cached.title,
            channelTitle: cached.channel_title,
            channelId: cached.channel_id || undefined,
            thumbnailUrl: cached.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            durationSec: cached.duration_sec,
            captionStatus: cached.caption_status as any,
            language: cached.language,
            windowCount: cached.window_count,
          };
        }
      } catch (e) {
        console.warn('[YouTubeDiscovery] DB lookup error:', e);
      }
    }

    // 2. Fetch from YouTube Data API v3, falling back to public YouTube oEmbed if key is invalid
    let title = '';
    let channelTitle = '';
    let channelId: string | undefined = undefined;
    let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    let durationSec = 0;
    let language = 'en';

    let resolvedViaApi = false;
    if (this.apiKey) {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${this.apiKey}`;
        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = (await res.json()) as any;
          const item = data.items?.[0];
          if (item) {
            title = item.snippet.title;
            channelTitle = item.snippet.channelTitle;
            channelId = item.snippet.channelId;
            thumbnailUrl =
              item.snippet.thumbnails?.high?.url ||
              item.snippet.thumbnails?.medium?.url ||
              item.snippet.thumbnails?.default?.url ||
              thumbnailUrl;
            durationSec = YouTubeDiscoveryService.parseIsoDuration(item.contentDetails?.duration || 'PT0S');
            language = item.snippet.defaultAudioLanguage || item.snippet.defaultLanguage || 'en';
            resolvedViaApi = true;
          }
        } else {
          const errText = await res.text();
          console.warn(`[YouTubeDiscovery] YouTube Data API returned HTTP ${res.status}:`, errText);
        }
      } catch (e: any) {
        console.warn('[YouTubeDiscovery] YouTube Data API fetch error:', e.message);
      }
    }

    // Fallback to YouTube oEmbed (key-less public resolver) if Data API failed
    if (!resolvedViaApi) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oembedRes = await fetch(oembedUrl);
        if (oembedRes.ok) {
          const oembedData = (await oembedRes.json()) as any;
          title = oembedData.title || `YouTube Video ${videoId}`;
          channelTitle = oembedData.author_name || 'YouTube Creator';
          thumbnailUrl = oembedData.thumbnail_url || thumbnailUrl;
        } else {
          return null;
        }
      } catch {
        return null;
      }
    }

    const metadata: VideoMetadata = {
      videoId,
      title,
      channelTitle,
      channelId,
      thumbnailUrl,
      durationSec,
      captionStatus: 'PENDING',
      language,
      windowCount: 0,
    };

    // Insert into D1
    if (this.env.DB) {
      try {
        await this.env.DB.prepare(
          `INSERT INTO videos (video_id, title, channel_title, channel_id, thumbnail_url, duration_sec, language, caption_status, created_at, last_accessed_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'PENDING', (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`
        )
          .bind(
            metadata.videoId,
            metadata.title,
            metadata.channelTitle,
            metadata.channelId || null,
            metadata.thumbnailUrl,
            metadata.durationSec,
            metadata.language || 'en'
          )
          .run();
      } catch (e) {
        console.warn('[YouTubeDiscovery] DB insert error:', e);
      }
    }

    return metadata;
  }

  /**
   * Returns Top 20 trending videos, using KV cache or fetching live via YouTube API.
   */
  async getTrending(): Promise<{ videos: VideoMetadata[]; updatedAt: string }> {
    const cacheKey = 'trending:top20:v2';

    // 1. Try KV cache
    if (this.env.KV) {
      try {
        const cached = await this.env.KV.get<{ videos: VideoMetadata[]; updatedAt: string }>(cacheKey, 'json');
        if (cached && cached.videos && cached.videos.length > 0) {
          // Reconcile captionStatus, windowCount and language from D1
          if (this.env.DB) {
            const metaMap = new Map<string, { status: string; windowCount: number; language?: string }>();
            const idList = cached.videos.map((v) => `'${v.videoId}'`).join(',');
            if (idList.length > 0) {
              const rows = await this.env.DB.prepare(
                `SELECT video_id, caption_status, window_count, language FROM videos WHERE video_id IN (${idList})`
              ).all<{ video_id: string; caption_status: string; window_count: number; language?: string }>();
              rows.results.forEach((r) =>
                metaMap.set(r.video_id, {
                  status: r.caption_status,
                  windowCount: r.window_count,
                  language: r.language,
                })
              );

              const updatedVideos = cached.videos.map((v) => {
                const d1 = metaMap.get(v.videoId);
                return {
                  ...v,
                  captionStatus: (d1?.status as any) || v.captionStatus,
                  windowCount: d1 ? d1.windowCount : (v.windowCount ?? 0),
                  language: d1?.language || v.language || 'en',
                };
              });
              return { videos: updatedVideos, updatedAt: cached.updatedAt };
            }
          }
          return cached;
        }
      } catch (e) {
        console.warn('[YouTubeDiscovery] KV trending read error:', e);
      }
    }

    // 2. Fetch fresh list via YouTube API if quota allows
    const canSearch = await this.checkQuota();
    let videos: VideoMetadata[] = [];

    if (canSearch && this.apiKey) {
      try {
        // Query long-form podcasts from top creators
        const query = 'podcast full episode';
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=long&order=relevance&maxResults=20&q=${encodeURIComponent(
          query
        )}&key=${this.apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          await this.incrementQuota();
          const searchData = await res.json() as any;
          const videoIds = (searchData.items || []).map((it: any) => it.id?.videoId).filter(Boolean);

          if (videoIds.length > 0) {
            // Fetch contentDetails for durations
            const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(
              ','
            )}&key=${this.apiKey}`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json() as any;
              for (const it of detailData.items || []) {
                videos.push({
                  videoId: it.id,
                  title: it.snippet.title,
                  channelTitle: it.snippet.channelTitle,
                  channelId: it.snippet.channelId,
                  thumbnailUrl:
                    it.snippet.thumbnails?.high?.url ||
                    it.snippet.thumbnails?.medium?.url ||
                    `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
                  durationSec: YouTubeDiscoveryService.parseIsoDuration(it.contentDetails?.duration || 'PT0S'),
                  captionStatus: 'PENDING',
                  language: it.snippet.defaultAudioLanguage || it.snippet.defaultLanguage || 'en',
                  windowCount: 0,
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('[YouTubeDiscovery] Live trending fetch error:', e);
      }
    }

    // If live search returned no videos (e.g. API key unavailable/quota reached), read indexed videos from D1
    if (videos.length === 0 && this.env.DB) {
      try {
        const d1Videos = await this.env.DB.prepare(
          `SELECT video_id, title, channel_title, channel_id, thumbnail_url, duration_sec, caption_status, language, window_count
           FROM videos
           ORDER BY access_count DESC, created_at DESC
           LIMIT 20`
        ).all<any>();

        for (const row of d1Videos.results || []) {
          videos.push({
            videoId: row.video_id,
            title: row.title,
            channelTitle: row.channel_title,
            channelId: row.channel_id || undefined,
            thumbnailUrl: row.thumbnail_url || `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
            durationSec: row.duration_sec,
            captionStatus: row.caption_status,
            language: row.language,
            windowCount: row.window_count,
          });
        }
      } catch (e: any) {
        console.warn('[YouTubeDiscovery] D1 trending fallback error:', e.message);
      }
    }

    // Seed or update D1 videos table
    if (this.env.DB && videos.length > 0) {
      for (const v of videos) {
        try {
          await this.env.DB.prepare(
            `INSERT INTO videos (video_id, title, channel_title, channel_id, thumbnail_url, duration_sec, language, caption_status, created_at, last_accessed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
             ON CONFLICT(video_id) DO NOTHING`
          )
            .bind(v.videoId, v.title, v.channelTitle, v.channelId || null, v.thumbnailUrl, v.durationSec, v.language || 'en', v.captionStatus)
            .run();
        } catch {
          // ignore duplicate insert errors
        }
      }
    }

    const payload = {
      videos: videos.slice(0, 20),
      updatedAt: new Date().toISOString(),
    };

    // Store in KV cache for 24 hours
    if (this.env.KV) {
      try {
        await this.env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 86400 });
      } catch (e) {
        console.warn('[YouTubeDiscovery] KV trending write error:', e);
      }
    }

    return payload;
  }

  /**
   * Search indexed videos in D1 first, then fallback to YouTube Data API if needed
   */
  async search(query: string, lang = 'en'): Promise<VideoMetadata[]> {
    const results: VideoMetadata[] = [];
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return results;

    // 1. Search D1 videos by title/channel or FTS5 transcript windows
    if (this.env.DB) {
      try {
        const d1Rows = await this.env.DB.prepare(
          `SELECT DISTINCT v.video_id, v.title, v.channel_title, v.thumbnail_url, v.duration_sec, v.caption_status, v.language, v.window_count
           FROM videos v
           WHERE v.title LIKE ?1 OR v.channel_title LIKE ?1
           LIMIT 10`
        )
          .bind(`%${normalizedQuery}%`)
          .all<any>();

        for (const row of d1Rows.results) {
          results.push({
            videoId: row.video_id,
            title: row.title,
            channelTitle: row.channel_title,
            thumbnailUrl: row.thumbnail_url || `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
            durationSec: row.duration_sec,
            captionStatus: row.caption_status,
            language: row.language,
            windowCount: row.window_count,
          });
        }
      } catch (e) {
        console.warn('[YouTubeDiscovery] D1 search error:', e);
      }
    }

    // 2. If results are few and quota allows, search YouTube Data API
    if (results.length < 5 && this.apiKey && (await this.checkQuota())) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=long&maxResults=10&q=${encodeURIComponent(
          normalizedQuery
        )}&key=${this.apiKey}`;
        const res = await fetch(url);
        if (res.ok) {
          await this.incrementQuota();
          const data = await res.json() as any;
          const newIds: string[] = [];

          for (const it of data.items || []) {
            const vid = it.id?.videoId;
            if (vid && !results.some((r) => r.videoId === vid)) {
              newIds.push(vid);
              results.push({
                videoId: vid,
                title: it.snippet.title,
                channelTitle: it.snippet.channelTitle,
                channelId: it.snippet.channelId,
                thumbnailUrl: it.snippet.thumbnails?.high?.url || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                durationSec: 0,
                captionStatus: 'PENDING',
                language: lang,
                windowCount: 0,
              });
            }
          }

          // Fetch exact durations
          if (newIds.length > 0) {
            const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${newIds.join(
              ','
            )}&key=${this.apiKey}`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
              const detailData = await detailRes.json() as any;
              const durationMap = new Map<string, number>();
              for (const it of detailData.items || []) {
                durationMap.set(it.id, YouTubeDiscoveryService.parseIsoDuration(it.contentDetails?.duration || 'PT0S'));
              }
              for (const r of results) {
                if (durationMap.has(r.videoId)) {
                  r.durationSec = durationMap.get(r.videoId)!;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[YouTubeDiscovery] YouTube search fallback error:', e);
      }
    }

    return results;
  }
}

