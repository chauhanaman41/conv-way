import { SupadataProvider } from './supadata';
import { TranscriptApiProvider } from './transcript-api';
import { WindowBuilder } from './window-builder';
import { ITranscriptProvider, TranscriptFetchResult, SpeechWindow } from './types';

export class TranscriptBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptBudgetExceededError';
  }
}

export class TranscriptAdapter {
  private primaryProvider: ITranscriptProvider;
  private fallbackProvider: ITranscriptProvider;
  private db?: D1Database;
  private inFlightMap = new Map<string, Promise<{ captionStatus: string; windowCount: number }>>();

  constructor(options: {
    supadataKey?: string;
    transcriptApiKey?: string;
    db?: D1Database;
  }) {
    this.primaryProvider = new SupadataProvider(options.supadataKey);
    this.fallbackProvider = new TranscriptApiProvider(options.transcriptApiKey);
    this.db = options.db;
  }

  private async checkDailyBudget(): Promise<{ allowed: boolean; count: number }> {
    if (!this.db) return { allowed: true, count: 0 };
    const todayUtc = new Date().toISOString().split('T')[0];
    try {
      const row = await this.db
        .prepare(`SELECT count_value FROM quota_counters WHERE date_utc = ?1 AND metric_name = 'TRANSCRIPTS_FETCHED'`)
        .bind(todayUtc)
        .first<{ count_value: number }>();
      const count = row?.count_value || 0;
      return { allowed: count < 5, count }; // Hard limit of 5 new transcripts per day
    } catch {
      return { allowed: true, count: 0 };
    }
  }

  private async incrementDailyTranscripts(providerName: string, latencyMs: number, ipHash = 'system'): Promise<void> {
    if (!this.db) return;
    const todayUtc = new Date().toISOString().split('T')[0];
    try {
      await this.db
        .prepare(
          `INSERT INTO quota_counters (date_utc, metric_name, count_value, last_updated_at)
           VALUES (?1, 'TRANSCRIPTS_FETCHED', 1, datetime('now'))
           ON CONFLICT(date_utc, metric_name) DO UPDATE SET count_value = count_value + 1, last_updated_at = datetime('now')`
        )
        .bind(todayUtc)
        .run();

      await this.db
        .prepare(
          `INSERT INTO credit_ledger (date_utc, ip_hash, service, operation, units_consumed, estimated_credits, http_status, latency_ms)
           VALUES (?1, ?2, ?3, 'FETCH_TRANSCRIPT', 1, 1, 200, ?4)`
        )
        .bind(todayUtc, ipHash, providerName, latencyMs)
        .run();
    } catch (e) {
      console.error('[TranscriptAdapter] Error logging transcript quota to D1:', e);
    }
  }

  public async ingestVideoTranscript(params: {
    videoId: string;
    title?: string;
    channelTitle?: string;
    durationSec?: number;
    language?: string;
    ipHash?: string;
  }): Promise<{ captionStatus: string; windowCount: number; windows: SpeechWindow[] }> {
    const { videoId, language = 'en', ipHash = 'system' } = params;

    // 1. Check if already indexed in D1
    if (this.db) {
      const existing = await this.db
        .prepare(`SELECT caption_status, window_count FROM videos WHERE video_id = ?1`)
        .bind(videoId)
        .first<{ caption_status: string; window_count: number }>();

      if (existing && existing.caption_status === 'READY') {
        // Fetch existing windows
        const rows = await this.db
          .prepare(
            `SELECT window_index, start_sec, end_sec, word_count, plain_text, cues_json, rolling_summary
             FROM transcript_windows WHERE video_id = ?1 ORDER BY window_index ASC`
          )
          .bind(videoId)
          .all<{
            window_index: number;
            start_sec: number;
            end_sec: number;
            word_count: number;
            plain_text: string;
            cues_json: string;
            rolling_summary?: string;
          }>();

        const windows: SpeechWindow[] = (rows.results || []).map((r) => ({
          windowIndex: r.window_index,
          startSec: r.start_sec,
          endSec: r.end_sec,
          wordCount: r.word_count,
          plainText: r.plain_text,
          cuesJson: r.cues_json,
          rollingSummary: r.rolling_summary,
        }));

        return {
          captionStatus: 'READY',
          windowCount: existing.window_count,
          windows,
        };
      }
    }

    // 2. Single-flight concurrency deduplication
    const inFlightKey = `${videoId}:${language}`;
    if (this.inFlightMap.has(inFlightKey)) {
      const inFlight = await this.inFlightMap.get(inFlightKey)!;
      return { captionStatus: inFlight.captionStatus, windowCount: inFlight.windowCount, windows: [] };
    }

    const task = (async () => {
      // 3. Check daily budget (5 new transcripts/day)
      const budget = await this.checkDailyBudget();
      if (!budget.allowed) {
        console.warn(`[TranscriptAdapter] Daily 5-transcript budget exhausted. Setting BUDGET_DEFERRED for ${videoId}`);
        if (this.db) {
          await this.db
            .prepare(
              `INSERT INTO videos (video_id, title, channel_title, duration_sec, language, caption_status, transcript_provider)
               VALUES (?1, ?2, ?3, ?4, ?5, 'BUDGET_DEFERRED', 'NONE')
               ON CONFLICT(video_id) DO UPDATE SET caption_status = 'BUDGET_DEFERRED'`
            )
            .bind(
              videoId,
              params.title || 'Untitled Video',
              params.channelTitle || 'Unknown Channel',
              params.durationSec || 0,
              language
            )
            .run();
        }
        return { captionStatus: 'BUDGET_DEFERRED', windowCount: 0 };
      }

      // 4. Fetch transcript: Primary (Supadata) -> Fallback (TranscriptAPI)
      let fetchResult: TranscriptFetchResult | null = null;
      let usedProvider = 'NONE';
      const startMs = Date.now();

      try {
        fetchResult = await this.primaryProvider.fetchTranscript(videoId, language);
        usedProvider = this.primaryProvider.name;
        const latency = Date.now() - startMs;
        await this.incrementDailyTranscripts(usedProvider, latency, ipHash);
      } catch (primaryErr: any) {
        console.warn(`[TranscriptAdapter] Primary Supadata failed for ${videoId}:`, primaryErr.message);
        try {
          const fallbackStart = Date.now();
          fetchResult = await this.fallbackProvider.fetchTranscript(videoId, language);
          usedProvider = this.fallbackProvider.name;
          const latency = Date.now() - fallbackStart;
          await this.incrementDailyTranscripts(usedProvider, latency, ipHash);
        } catch (fallbackErr: any) {
          console.error(`[TranscriptAdapter] Both transcript providers failed for ${videoId}:`, fallbackErr.message);
          if (this.db) {
            await this.db
              .prepare(
                `INSERT INTO videos (video_id, title, channel_title, duration_sec, language, caption_status, transcript_provider)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'NO_CAPTIONS', 'NONE')
                 ON CONFLICT(video_id) DO UPDATE SET caption_status = 'NO_CAPTIONS'`
              )
              .bind(
                videoId,
                params.title || 'Untitled Video',
                params.channelTitle || 'Unknown Channel',
                params.durationSec || 0,
                language
              )
              .run();
          }
          return { captionStatus: 'NO_CAPTIONS', windowCount: 0 };
        }
      }

      // 5. Build windows from cues
      const windows = WindowBuilder.buildWindows(fetchResult.cues, params.durationSec);

      // 6. Persist to D1 in batch
      if (this.db) {
        // Upsert video record
        await this.db
          .prepare(
            `INSERT INTO videos (video_id, title, channel_title, duration_sec, language, caption_status, transcript_provider, window_count)
             VALUES (?1, ?2, ?3, ?4, ?5, 'READY', ?6, ?7)
             ON CONFLICT(video_id) DO UPDATE SET caption_status = 'READY', transcript_provider = ?6, window_count = ?7, last_accessed_at = datetime('now')`
          )
          .bind(
            videoId,
            params.title || 'Untitled Video',
            params.channelTitle || 'Unknown Channel',
            params.durationSec || (windows.length > 0 ? windows[windows.length - 1].endSec : 0),
            language,
            usedProvider,
            windows.length
          )
          .run();

        // Batch insert transcript_windows (FTS5 triggers maintain transcript_fts automatically)
        const statements = windows.map((w) =>
          this.db!
            .prepare(
              `INSERT INTO transcript_windows (video_id, window_index, start_sec, end_sec, word_count, plain_text, cues_json)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
               ON CONFLICT(video_id, window_index) DO UPDATE SET plain_text = ?6, cues_json = ?7`
            )
            .bind(videoId, w.windowIndex, w.startSec, w.endSec, w.wordCount, w.plainText, w.cuesJson)
        );

        // Execute batch in chunks of 20 to avoid SQLite statement limits
        const CHUNK_SIZE = 20;
        for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
          const chunk = statements.slice(i, i + CHUNK_SIZE);
          await this.db.batch(chunk);
        }
      }

      return { captionStatus: 'READY', windowCount: windows.length };
    })();

    this.inFlightMap.set(inFlightKey, task);
    try {
      const res = await task;
      return { ...res, windows: [] };
    } finally {
      this.inFlightMap.delete(inFlightKey);
    }
  }
}

