import { Env } from '../types';
import { GovernorService } from './governor';
import { EvonClient } from '../gnani/evon';
import { TimbreClient } from '../gnani/timbre';
import { SearchOrchestrator } from '../search/orchestrator';
import { SpeechWindow } from '../transcript/types';

export interface QueryAskRequest {
  videoId: string;
  currentPlayheadSec: number;
  windowIndex?: number;
  questionText: string;
  language?: string;
  isDiveDeeper?: boolean;
  excludedRanges?: Array<{ startSec: number; endSec: number }>;
  ttsOptIn?: boolean;
}

export interface AnswerClipDto {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  speakerName?: string;
  startSec: number;
  endSec: number;
  isExternalVideo: boolean;
  breadcrumbSummary: string;
}

export interface AiFallbackDto {
  isAiLabeled: boolean;
  reason: string;
  answerText: string;
  wordCount: number;
  citations: Array<{ title: string; url: string; domain?: string }>;
  isContradicted?: boolean;
  ttsAudioBase64?: string | null;
}

export interface QueryAskResponse {
  ok: true;
  resolutionType: 'IN_VIDEO_SEGMENT' | 'AI_VERIFIED_FALLBACK';
  cacheSource?: 'WAY_PREPARED_MATCH' | 'FTS5_EVON_RERANK' | 'CROSS_VIDEO_FTS5' | 'LIVE_SEARCH_FALLBACK';
  answerClip?: AnswerClipDto;
  clarificationPrompt?: string;
  aiFallback?: AiFallbackDto;
  governorState?: {
    stepDownLevel: string;
    dailyCapRemainingPct?: number;
  };
}

export class QueryOrchestrator {
  private env: Env;
  private governor: GovernorService;
  private evon: EvonClient;
  private timbre: TimbreClient;
  private searchOrchestrator: SearchOrchestrator;

  constructor(env: Env) {
    this.env = env;
    this.governor = new GovernorService(env);
    this.evon = new EvonClient({ apiKey: env.GNANI_API_KEY });
    this.timbre = new TimbreClient({ apiKey: env.GNANI_API_KEY });
    this.searchOrchestrator = new SearchOrchestrator(
      {
        tavilyApiKey: env.TAVILY_API_KEY,
        exaApiKey: env.EXA_API_KEY,
        webSearchApiKey: env.WEB_SEARCH_API_KEY,
        webSearchCx: env.WEB_SEARCH_CX,
        googleCseEnabled: env.GOOGLE_CSE_ENABLED !== 'false',
      },
      env.DB
    );
  }

  /**
   * Calculates Jaccard token overlap similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const tokenize = (s: string) =>
      new Set(
        s
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2)
      );

    const tokens1 = tokenize(str1);
    const tokens2 = tokenize(str2);

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersectionCount = 0;
    for (const t of tokens1) {
      if (tokens2.has(t)) intersectionCount++;
    }

    const unionCount = new Set([...tokens1, ...tokens2]).size;
    return unionCount === 0 ? 0 : intersectionCount / unionCount;
  }

  /**
   * Sanitizes user input into valid SQLite FTS5 query
   */
  private buildFtsQuery(query: string): string {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
      'in', 'with', 'to', 'for', 'of', 'about', 'what', 'why', 'how', 'when',
      'where', 'who', 'does', 'can', 'could', 'would', 'should'
    ]);

    const words = query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 2 && !stopWords.has(w));

    if (words.length === 0) {
      // Fallback to bare alphanumeric words if all were stopwords
      const fallbackWords = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
      return fallbackWords.map((w) => `"${w}"*`).join(' OR ') || 'video';
    }

    return words.map((w) => `"${w}"*`).join(' OR ');
  }

  /**
   * Checks if a candidate time range overlaps with any excluded ranges
   */
  private isExcluded(startSec: number, endSec: number, excludedRanges?: Array<{ startSec: number; endSec: number }>): boolean {
    if (!excludedRanges || excludedRanges.length === 0) return false;
    for (const range of excludedRanges) {
      const overlapStart = Math.max(startSec, range.startSec);
      const overlapEnd = Math.min(endSec, range.endSec);
      if (overlapEnd - overlapStart > 5) {
        return true;
      }
    }
    return false;
  }

  /**
   * Full 5-stage retrieval pipeline
   */
  async ask(req: QueryAskRequest, ipHash = 'system'): Promise<QueryAskResponse> {
    const govState = await this.governor.getState();
    const lang = req.language || 'en';

    // =========================================================================
    // STEP 1: Prepared Match (Zero Gnani cost, sub-100ms response)
    // =========================================================================
    if (this.env.DB) {
      try {
        const wayRows = await this.env.DB.prepare(
          `SELECT id, question_text, trigger_sec, answer_video_id, answer_video_title, answer_channel_title,
                  answer_start_sec, answer_end_sec, confidence_score
           FROM way_questions
           WHERE video_id = ?1
           ORDER BY hit_count DESC
           LIMIT 25`
        )
          .bind(req.videoId)
          .all<any>();

        for (const row of wayRows.results) {
          const sim = this.calculateSimilarity(req.questionText, row.question_text);
          if (sim >= 0.65) {
            if (!this.isExcluded(row.answer_start_sec, row.answer_end_sec, req.excludedRanges)) {
              // Hit telemetry
              await this.env.DB.prepare(
                `UPDATE way_questions SET hit_count = hit_count + 1, last_hit_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?1`
              )
                .bind(row.id)
                .run();

              return {
                ok: true,
                resolutionType: 'IN_VIDEO_SEGMENT',
                cacheSource: 'WAY_PREPARED_MATCH',
                answerClip: {
                  videoId: row.answer_video_id,
                  videoTitle: row.answer_video_title || 'Video Episode',
                  channelTitle: row.answer_channel_title || 'Podcast Channel',
                  startSec: row.answer_start_sec,
                  endSec: row.answer_end_sec,
                  isExternalVideo: row.answer_video_id !== req.videoId,
                  breadcrumbSummary: `Jump to direct answer matching: "${row.question_text}"`,
                },
                clarificationPrompt: 'Does this answer your question, or would you like to dive deeper?',
                governorState: {
                  stepDownLevel: govState.stepDownLevel,
                  dailyCapRemainingPct: govState.dailyCapRemainingPct,
                },
              };
            }
          }
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Step 1 Prepared match error:', err);
      }
    }

    // =========================================================================
    // STEP 2: In-Video FTS5 BM25 Match + Evon Rerank
    // =========================================================================
    if (this.env.DB) {
      const ftsQuery = this.buildFtsQuery(req.questionText);
      try {
        const ftsRows = await this.env.DB.prepare(
          `SELECT tw.id, tw.video_id, tw.window_index, tw.start_sec, tw.end_sec, tw.word_count,
                  tw.plain_text, tw.cues_json, v.title as video_title, v.channel_title,
                  bm25(transcript_fts) as rank
           FROM transcript_fts
           JOIN transcript_windows tw ON tw.id = transcript_fts.rowid
           JOIN videos v ON v.video_id = tw.video_id
           WHERE transcript_fts MATCH ?1 AND tw.video_id = ?2
           ORDER BY rank
           LIMIT 3`
        )
          .bind(ftsQuery, req.videoId)
          .all<any>();

        if (ftsRows.results && ftsRows.results.length > 0) {
          const candidateWindows: SpeechWindow[] = ftsRows.results.map((r: any) => ({
            id: r.id,
            videoId: r.video_id,
            windowIndex: r.window_index,
            startSec: r.start_sec,
            endSec: r.end_sec,
            wordCount: r.word_count,
            plainText: r.plain_text,
            cuesJson: r.cues_json,
          }));

          const primaryVideoTitle = ftsRows.results[0].video_title || 'Video Episode';
          const primaryChannelTitle = ftsRows.results[0].channel_title || 'Podcast Channel';

          // Call Gnani Evon rerank if permitted by governor
          if (govState.canCallEvon && this.evon.isAvailable()) {
            const startRerank = Date.now();
            try {
              const rerankResult = await this.evon.rerankAndExtractBoundaries(
                req.questionText,
                candidateWindows
              );

              if (rerankResult && !this.isExcluded(rerankResult.startSec, rerankResult.endSec, req.excludedRanges)) {
                const latency = Date.now() - startRerank;
                await this.governor.recordUsage({
                  service: 'GNANI_EVON',
                  operation: 'EVON_RERANK',
                  unitsConsumed: 1,
                  estimatedCredits: 0.15,
                  httpStatus: 200,
                  latencyMs: latency,
                  ipHash,
                });

                return {
                  ok: true,
                  resolutionType: 'IN_VIDEO_SEGMENT',
                  cacheSource: 'FTS5_EVON_RERANK',
                  answerClip: {
                    videoId: req.videoId,
                    videoTitle: primaryVideoTitle,
                    channelTitle: primaryChannelTitle,
                    speakerName: rerankResult.speakerName,
                    startSec: rerankResult.startSec,
                    endSec: rerankResult.endSec,
                    isExternalVideo: false,
                    breadcrumbSummary: rerankResult.breadcrumbSummary,
                  },
                  clarificationPrompt: 'Does this segment clarify your question, or would you like to explore deeper?',
                  governorState: {
                    stepDownLevel: govState.stepDownLevel,
                    dailyCapRemainingPct: govState.dailyCapRemainingPct,
                  },
                };
              }
            } catch (err) {
              console.warn('[QueryOrchestrator] Evon rerank error, falling back to window bounds:', err);
            }
          }

          // Fallback to top window bounds without paid Evon call
          const topWin = candidateWindows[0];
          if (!this.isExcluded(topWin.startSec, topWin.endSec, req.excludedRanges)) {
            return {
              ok: true,
              resolutionType: 'IN_VIDEO_SEGMENT',
              cacheSource: 'FTS5_EVON_RERANK',
              answerClip: {
                videoId: req.videoId,
                videoTitle: primaryVideoTitle,
                channelTitle: primaryChannelTitle,
                startSec: topWin.startSec,
                endSec: Math.min(topWin.startSec + 75, topWin.endSec),
                isExternalVideo: false,
                breadcrumbSummary: `Relevant section found in the video.`,
              },
              governorState: {
                stepDownLevel: govState.stepDownLevel,
                dailyCapRemainingPct: govState.dailyCapRemainingPct,
              },
            };
          }
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Step 2 In-Video FTS5 error:', err);
      }
    }

    // =========================================================================
    // STEP 3: Cross-Video Search (D1 transcript_fts across other stored videos)
    // =========================================================================
    if (this.env.DB) {
      const ftsQuery = this.buildFtsQuery(req.questionText);
      try {
        const crossRows = await this.env.DB.prepare(
          `SELECT tw.id, tw.video_id, tw.window_index, tw.start_sec, tw.end_sec, tw.word_count,
                  tw.plain_text, tw.cues_json, v.title as video_title, v.channel_title,
                  bm25(transcript_fts) as rank
           FROM transcript_fts
           JOIN transcript_windows tw ON tw.id = transcript_fts.rowid
           JOIN videos v ON v.video_id = tw.video_id
           WHERE transcript_fts MATCH ?1 AND tw.video_id != ?2
           ORDER BY rank
           LIMIT 1`
        )
          .bind(ftsQuery, req.videoId)
          .first<any>();

        if (crossRows && !this.isExcluded(crossRows.start_sec, crossRows.end_sec, req.excludedRanges)) {
          return {
            ok: true,
            resolutionType: 'IN_VIDEO_SEGMENT',
            cacheSource: 'CROSS_VIDEO_FTS5',
            answerClip: {
              videoId: crossRows.video_id,
              videoTitle: crossRows.video_title,
              channelTitle: crossRows.channel_title,
              startSec: crossRows.start_sec,
              endSec: Math.min(crossRows.start_sec + 75, crossRows.end_sec),
              isExternalVideo: true,
              breadcrumbSummary: `Answer found in external podcast episode: "${crossRows.video_title}"`,
            },
            clarificationPrompt: `Playing external answer from ${crossRows.channel_title}. You will return to your current video upon completion.`,
            governorState: {
              stepDownLevel: govState.stepDownLevel,
              dailyCapRemainingPct: govState.dailyCapRemainingPct,
            },
          };
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Step 3 Cross-video search error:', err);
      }
    }

    // =========================================================================
    // STEP 4: Grounded AI Fallback (Tavily/Exa + Evon 30-40 word synthesis)
    // =========================================================================
    if (govState.canCallWebSearchFallback) {
      try {
        const searchRes = await this.searchOrchestrator.executeTwoPassSearch(req.questionText, ipHash);
        if (searchRes && searchRes.results && searchRes.results.length > 0) {
          const fallbackGen = await this.evon.generateCitedFallback(
            req.questionText,
            searchRes.results
          );

          if (fallbackGen) {
            const grounded = this.searchOrchestrator.validateAndEnforceGrounding(
              fallbackGen,
              searchRes.results,
              searchRes.scope,
              searchRes.provider
            );

            if (grounded) {
              let ttsAudio: string | null = null;
              if (req.ttsOptIn && govState.canCallTimbre && this.timbre.isAvailable()) {
                ttsAudio = await this.timbre.synthesizeSpeech(grounded.answerText, lang);
              }

              return {
                ok: true,
                resolutionType: 'AI_VERIFIED_FALLBACK',
                cacheSource: 'LIVE_SEARCH_FALLBACK',
                aiFallback: {
                  isAiLabeled: true,
                  reason: grounded.reason,
                  answerText: grounded.answerText,
                  wordCount: grounded.wordCount,
                  citations: grounded.citations,
                  isContradicted: grounded.isContradicted,
                  ttsAudioBase64: ttsAudio,
                },
                governorState: {
                  stepDownLevel: govState.stepDownLevel,
                  dailyCapRemainingPct: govState.dailyCapRemainingPct,
                },
              };
            }
          }
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Step 4 Grounded AI fallback error:', err);
      }
    }

    // =========================================================================
    // STEP 5: Honest Empty / No Verified Match
    // =========================================================================
    throw new Error('NO_VERIFIED_MATCH');
  }
}
