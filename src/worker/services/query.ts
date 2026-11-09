import { Env } from '../types';
import { GovernorService } from './governor';
import { EvonClient } from '../gnani/evon';
import { TimbreClient } from '../gnani/timbre';
import { SearchOrchestrator } from '../search/orchestrator';
import { SpeechWindow } from '../transcript/types';
import {
  detectIntent,
  extractKeywords,
  extractContentWords,
  rewriteQuery,
  calculateKeywordCoverage,
  extractClipBoundaries,
  validateQuery,
  Cue,
} from './boundary';
import { LlmAdapterManager, LlmHealthStatus } from '../gnani/llm-adapter';
import { cleanSourceText, summarizeToWordRange } from '../search/text-cleaner';

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
  citations: Array<{ title: string; url: string; domain?: string; snippet?: string }>;
  isContradicted?: boolean;
  ttsAudioBase64?: string | null;
}

export interface QueryDebugDto {
  intent: string;
  rewrittenQuery: string;
  routeTaken: string;
  searchScores: Array<{ rank: number; score?: number; coverage?: number; label?: string }>;
  chosenSegment?: { videoId: string; startSec: number; endSec: number };
  providerAnswered: string;
  llmHealth: LlmHealthStatus;
  creditsQuota: {
    dailyCapRemainingPct?: number;
    stepDownLevel: string;
    creditsUsedToday?: number;
  };
}

export interface QueryAskResponse {
  ok: true;
  resolutionType: 'IN_VIDEO_SEGMENT' | 'AI_VERIFIED_FALLBACK' | 'NOT_DISCUSSED';
  cacheSource?: 'WAY_PREPARED_MATCH' | 'FTS5_EVON_RERANK' | 'CROSS_VIDEO_FTS5' | 'LIVE_SEARCH_FALLBACK' | 'IN_VIDEO_META';
  answerClip?: AnswerClipDto;
  clarificationPrompt?: string;
  canSearchCrossVideo?: boolean;
  aiFallback?: AiFallbackDto;
  governorState?: {
    stepDownLevel: string;
    dailyCapRemainingPct?: number;
  };
  debug?: QueryDebugDto;
}

export class QueryOrchestrator {
  private env: Env;
  private governor: GovernorService;
  private evon: EvonClient;
  private timbre: TimbreClient;
  private searchOrchestrator: SearchOrchestrator;
  private llmManager: LlmAdapterManager;

  constructor(env: Env) {
    this.env = env;
    this.governor = new GovernorService(env);
    this.evon = new EvonClient({ apiKey: env.GNANI_API_KEY });
    this.timbre = new TimbreClient({ apiKey: env.GNANI_API_KEY });
    this.llmManager = new LlmAdapterManager(env);
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
  private buildFtsQuery(keywords: string[]): string {
    if (keywords.length === 0) {
      return 'video';
    }
    return keywords.map((w) => `"${w}"*`).join(' OR ');
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
   * Strips citation markers, phonetics, and HTML tags from search snippet text
   */
  private cleanSnippetText(text: string): string {
    return text
      .replace(/\[\d+\]/g, '') // [1], [2]
      .replace(/\[edit\]/gi, '')
      .replace(/\/[^\/]{2,}\//g, '') // /faɪˈnæns/ phonetics
      .replace(/<[^>]+>/g, '') // HTML tags
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractDomain(urlStr: string): string {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Full retrieval & routing pipeline with strict grounding & no-LLM core flow
   */
  async ask(req: QueryAskRequest, ipHash = 'system'): Promise<QueryAskResponse> {
    const govState = await this.governor.getState();
    const lang = req.language || 'en';
    const llmHealth = await this.llmManager.getHealth();

    // 1. Detect Intent
    const intent = detectIntent(req.questionText);

    // Fetch video metadata and recent transcript cues for context rewriting
    let videoTitle = 'Video Episode';
    let channelTitle = 'Podcast Channel';
    let recentCues: Cue[] = [];

    if (this.env.DB) {
      try {
        const vRow = await this.env.DB.prepare(
          `SELECT title, channel_title FROM videos WHERE video_id = ?1`
        )
          .bind(req.videoId)
          .first<any>();
        if (vRow) {
          videoTitle = vRow.title || videoTitle;
          channelTitle = vRow.channel_title || channelTitle;
        }

        // Get window around current playhead
        const activeWin = await this.env.DB.prepare(
          `SELECT cues_json FROM transcript_windows WHERE video_id = ?1 AND start_sec <= ?2 AND end_sec >= ?2`
        )
          .bind(req.videoId, req.currentPlayheadSec)
          .first<any>();

        if (activeWin && activeWin.cues_json) {
          try {
            const allCues: Cue[] = JSON.parse(activeWin.cues_json);
            recentCues = allCues.filter(
              (c) => c.t >= Math.max(0, req.currentPlayheadSec - 60) && c.t <= req.currentPlayheadSec
            );
          } catch {}
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Failed fetching playhead context:', err);
      }
    }

    // =========================================================================
    // SPECIAL ROUTE: IN_VIDEO_META ("what are they talking about", etc.)
    // Never route to web search!
    // =========================================================================
    if (intent === 'IN_VIDEO_META') {
      if (this.env.DB) {
        try {
          const winRow = await this.env.DB.prepare(
            `SELECT start_sec, end_sec, cues_json, plain_text FROM transcript_windows WHERE video_id = ?1 AND start_sec <= ?2 AND end_sec >= ?2`
          )
            .bind(req.videoId, req.currentPlayheadSec)
            .first<any>();

          if (winRow) {
            let startSec = Math.max(0, Math.round(req.currentPlayheadSec - 30));
            let endSec = Math.round(req.currentPlayheadSec + 45);

            if (winRow.cues_json) {
              try {
                const cues: Cue[] = JSON.parse(winRow.cues_json);
                const localCues = cues.filter(
                  (c) => c.t >= Math.max(0, req.currentPlayheadSec - 40) && c.t <= req.currentPlayheadSec + 40
                );
                if (localCues.length > 0) {
                  startSec = Math.max(0, Math.round(localCues[0].t - 2));
                  const last = localCues[localCues.length - 1];
                  endSec = Math.round(last.t + last.d + 2);
                }
              } catch {}
            }

            return {
              ok: true,
              resolutionType: 'IN_VIDEO_SEGMENT',
              cacheSource: 'IN_VIDEO_META',
              answerClip: {
                videoId: req.videoId,
                videoTitle,
                channelTitle,
                startSec,
                endSec,
                isExternalVideo: false,
                breadcrumbSummary: `Current discussion topic around ${Math.floor(startSec / 60)}:${String(Math.floor(startSec % 60)).padStart(2, '0')}`,
              },
              clarificationPrompt: 'Does this segment clarify what they are discussing?',
              governorState: {
                stepDownLevel: govState.stepDownLevel,
                dailyCapRemainingPct: govState.dailyCapRemainingPct,
              },
              debug: {
                intent: 'IN_VIDEO_META',
                rewrittenQuery: req.questionText,
                routeTaken: 'IN_VIDEO_META',
                searchScores: [{ rank: 1, score: 1.0, coverage: 1.0, label: 'PLAYHEAD_TOPIC_SNAP' }],
                chosenSegment: { videoId: req.videoId, startSec, endSec },
                providerAnswered: 'LOCAL_D1',
                llmHealth,
                creditsQuota: {
                  dailyCapRemainingPct: govState.dailyCapRemainingPct,
                  stepDownLevel: govState.stepDownLevel,
                },
              },
            };
          }
        } catch (err) {
          console.warn('[QueryOrchestrator] IN_VIDEO_META resolution error:', err);
        }
      }
    }

    // 2. Validate non-meta queries to protect against undefined / garbage input
    const valResult = validateQuery(req.questionText);
    if (intent !== 'IN_VIDEO_META' && !valResult.valid) {
      return {
        ok: true,
        resolutionType: 'IN_VIDEO_SEGMENT',
        clarificationPrompt: valResult.reason || 'Please ask a specific question with at least two keywords.',
        governorState: {
          stepDownLevel: govState.stepDownLevel,
          dailyCapRemainingPct: govState.dailyCapRemainingPct,
        },
        debug: {
          intent,
          rewrittenQuery: req.questionText,
          routeTaken: 'REJECTED_INVALID_QUERY',
          searchScores: [],
          providerAnswered: 'NONE',
          llmHealth,
          creditsQuota: {
            dailyCapRemainingPct: govState.dailyCapRemainingPct,
            stepDownLevel: govState.stepDownLevel,
          },
        },
      };
    }

    // Context Query Rewriting
    const { rewrittenText } = rewriteQuery(req.questionText, recentCues, videoTitle);
    const queryKeywords = extractKeywords(rewrittenText);
    const { contentWords, rareWords } = extractContentWords(rewrittenText);
    const effectiveKeywords = contentWords.length > 0 ? contentWords : queryKeywords;
    const ftsQuery = this.buildFtsQuery(effectiveKeywords);

    // =========================================================================
    // STEP 1: Prepared Match (Zero latency, pre-computed Way questions)
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
                  videoTitle: row.answer_video_title || videoTitle,
                  channelTitle: row.answer_channel_title || channelTitle,
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
                debug: {
                  intent,
                  rewrittenQuery: rewrittenText,
                  routeTaken: 'PREPARED_MATCH',
                  searchScores: [{ rank: 1, score: sim, coverage: 1.0, label: 'WAY_PREPARED' }],
                  chosenSegment: { videoId: row.answer_video_id, startSec: row.answer_start_sec, endSec: row.answer_end_sec },
                  providerAnswered: 'LOCAL_D1',
                  llmHealth,
                  creditsQuota: {
                    dailyCapRemainingPct: govState.dailyCapRemainingPct,
                    stepDownLevel: govState.stepDownLevel,
                  },
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
    // STEP 2: In-Video FTS5 Match with Strict Keyword Coverage & No-LLM Boundary Extraction
    // =========================================================================
    if (this.env.DB) {
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
          const scoredCandidates = ftsRows.results.map((r: any) => {
            const coverage = calculateKeywordCoverage(effectiveKeywords, r.plain_text);
            const lowerPlain = (r.plain_text || '').toLowerCase();
            const hasRareTerm = rareWords.length === 0 || rareWords.some((rw) => lowerPlain.includes(rw));
            return { ...r, coverage, hasRareTerm };
          });

          // Strict match threshold: keyword coverage >= 0.75 on content words AND contains at least one rare term
          const validCandidates = scoredCandidates.filter((c) => c.coverage >= 0.75 && c.hasRareTerm);

          if (validCandidates.length > 0) {
            const topWin = validCandidates[0];

            let cues: Cue[] = [];
            try {
              cues = JSON.parse(topWin.cues_json);
            } catch {}

            // Extract tight clip boundaries without requiring any LLM
            const boundary = extractClipBoundaries(
              effectiveKeywords,
              cues,
              topWin.start_sec,
              topWin.end_sec
            );

            if (!this.isExcluded(boundary.startSec, boundary.endSec, req.excludedRanges)) {
              return {
                ok: true,
                resolutionType: 'IN_VIDEO_SEGMENT',
                cacheSource: 'FTS5_EVON_RERANK',
                answerClip: {
                  videoId: req.videoId,
                  videoTitle: topWin.video_title || videoTitle,
                  channelTitle: topWin.channel_title || channelTitle,
                  startSec: boundary.startSec,
                  endSec: boundary.endSec,
                  isExternalVideo: false,
                  breadcrumbSummary: boundary.summary,
                },
                clarificationPrompt: 'Does this segment answer your question, or would you like to explore deeper?',
                governorState: {
                  stepDownLevel: govState.stepDownLevel,
                  dailyCapRemainingPct: govState.dailyCapRemainingPct,
                },
                debug: {
                  intent,
                  rewrittenQuery: rewrittenText,
                  routeTaken: 'IN_VIDEO_FTS5',
                  searchScores: scoredCandidates.map((c, idx) => ({
                    rank: idx + 1,
                    score: c.rank,
                    coverage: c.coverage,
                    label: `Window #${c.window_index}`,
                  })),
                  chosenSegment: { videoId: req.videoId, startSec: boundary.startSec, endSec: boundary.endSec },
                  providerAnswered: 'LOCAL_D1',
                  llmHealth,
                  creditsQuota: {
                    dailyCapRemainingPct: govState.dailyCapRemainingPct,
                    stepDownLevel: govState.stepDownLevel,
                  },
                },
              };
            }
          }
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Step 2 In-Video FTS5 error:', err);
      }
    }

    // =========================================================================
    // STEP 3: Cross-Video Search (D1 transcript_fts across other stored videos)
    // Balanced Matching:
    // - Clear match (coverage >= 0.75, matching language): "Answer"
    // - Weaker match (coverage >= 0.50, >= 2 content words): "Related video, may not fully answer" (with language tag if mismatch)
    // - Below 0.50: NO MATCH
    // =========================================================================
    if (this.env.DB && queryKeywords.length >= 2) {
      try {
        const crossRows = await this.env.DB.prepare(
          `SELECT tw.id, tw.video_id, tw.window_index, tw.start_sec, tw.end_sec, tw.word_count,
                  tw.plain_text, tw.cues_json, v.title as video_title, v.channel_title, v.language as video_language,
                  bm25(transcript_fts) as rank
           FROM transcript_fts
           JOIN transcript_windows tw ON tw.id = transcript_fts.rowid
           JOIN videos v ON v.video_id = tw.video_id
           WHERE transcript_fts MATCH ?1 AND tw.video_id != ?2
           ORDER BY rank
           LIMIT 3`
        )
          .bind(ftsQuery, req.videoId)
          .all<any>();

        if (crossRows.results && crossRows.results.length > 0) {
          const scoredCross = crossRows.results.map((r: any) => ({
            ...r,
            coverage: calculateKeywordCoverage(queryKeywords, r.plain_text),
          }));

          const validCross = scoredCross.filter((c) => c.coverage >= 0.50);

          if (validCross.length > 0) {
            const topCross = validCross[0];
            const isSameLanguage = !topCross.video_language || topCross.video_language.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2));
            const isClearAnswer = topCross.coverage >= 0.75 && isSameLanguage;

            let cues: Cue[] = [];
            try {
              cues = JSON.parse(topCross.cues_json);
            } catch {}

            const boundary = extractClipBoundaries(
              queryKeywords,
              cues,
              topCross.start_sec,
              topCross.end_sec
            );

            if (!this.isExcluded(boundary.startSec, boundary.endSec, req.excludedRanges)) {
              const langTag = isSameLanguage ? '' : `[${(topCross.video_language || 'UNKNOWN').toUpperCase()}] `;
              const matchType = isClearAnswer ? 'Answer' : `${langTag}Related video, may not fully answer`;
              const summary = `${matchType}: "${topCross.video_title}"`;
              const prompt = isClearAnswer
                ? `Playing direct answer from ${topCross.channel_title}. You will return to your current video upon completion.`
                : `Playing related segment from ${topCross.channel_title}. You will return to your current video upon completion.`;

              return {
                ok: true,
                resolutionType: 'IN_VIDEO_SEGMENT',
                cacheSource: 'CROSS_VIDEO_FTS5',
                answerClip: {
                  videoId: topCross.video_id,
                  videoTitle: topCross.video_title,
                  channelTitle: topCross.channel_title,
                  startSec: boundary.startSec,
                  endSec: boundary.endSec,
                  isExternalVideo: true,
                  breadcrumbSummary: summary,
                },
                clarificationPrompt: prompt,
                governorState: {
                  stepDownLevel: govState.stepDownLevel,
                  dailyCapRemainingPct: govState.dailyCapRemainingPct,
                },
                debug: {
                  intent,
                  rewrittenQuery: rewrittenText,
                  routeTaken: 'CROSS_VIDEO_FTS5',
                  searchScores: scoredCross.map((c, idx) => ({
                    rank: idx + 1,
                    score: c.rank,
                    coverage: c.coverage,
                    label: `${c.video_title} (Win #${c.window_index}) - ${c.coverage >= 0.75 ? 'Answer' : 'Related'}`,
                  })),
                  chosenSegment: { videoId: topCross.video_id, startSec: boundary.startSec, endSec: boundary.endSec },
                  providerAnswered: 'CROSS_VIDEO_D1',
                  llmHealth,
                  creditsQuota: {
                    dailyCapRemainingPct: govState.dailyCapRemainingPct,
                    stepDownLevel: govState.stepDownLevel,
                  },
                },
              };
            }
          }
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Step 3 Cross-video search error:', err);
      }
    }

    // =========================================================================
    // STEP 4: Grounded Web Fallback (Tavily / Exa / Google CSE)
    // =========================================================================
    if (govState.canCallWebSearchFallback) {
      try {
        const searchRes = await this.searchOrchestrator.executeTwoPassSearch(rewrittenText, ipHash);
        if (searchRes && searchRes.results && searchRes.results.length > 0) {
          // Attempt LLM synthesis if scope/model available
          let grounded = null;
          try {
            const activeProvider = await this.llmManager.getActiveProvider();
            let fallbackGen = null;
            if (activeProvider && typeof activeProvider.generateCitedFallback === 'function') {
              fallbackGen = await activeProvider.generateCitedFallback(
                req.questionText,
                searchRes.results
              );
            } else if (this.evon.isAvailable()) {
              fallbackGen = await this.evon.generateCitedFallback(
                req.questionText,
                searchRes.results
              );
            }

            if (fallbackGen) {
              grounded = this.searchOrchestrator.validateAndEnforceGrounding(
                fallbackGen,
                searchRes.results,
                searchRes.scope,
                searchRes.provider
              );
            }
          } catch (llmErr) {
            console.warn('[QueryOrchestrator] LLM synthesis skipped:', llmErr);
          }

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
              debug: {
                intent,
                rewrittenQuery: rewrittenText,
                routeTaken: 'WEB_SEARCH_FALLBACK',
                searchScores: searchRes.results.map((r, idx) => ({
                  rank: idx + 1,
                  label: r.title,
                })),
                providerAnswered: searchRes.provider,
                llmHealth,
                creditsQuota: {
                  dailyCapRemainingPct: govState.dailyCapRemainingPct,
                  stepDownLevel: govState.stepDownLevel,
                },
              },
            };
          }

          // Honest fallback without LLM: present cleaned real source citations
          // Strictly enforces 20 to 30 words, stripped of all markdown & references
          const firstSnippet = searchRes.results[0]?.snippet || searchRes.results[0]?.content || '';
          const cleanSummary = summarizeToWordRange(firstSnippet, 20, 30);

          const cleanedCitations = searchRes.results.slice(0, 2).map((r) => ({
            title: cleanSourceText(r.title).slice(0, 80) || r.url,
            url: r.url,
            domain: this.extractDomain(r.url),
            snippet: cleanSourceText(r.snippet || r.content || '').slice(0, 140),
          }));

          return {
            ok: true,
            resolutionType: 'AI_VERIFIED_FALLBACK',
            cacheSource: 'LIVE_SEARCH_FALLBACK',
            aiFallback: {
              isAiLabeled: false, // Honest: NO LLM wrote an answer
              reason: `Relevant external sources found via ${searchRes.provider}.`,
              answerText: cleanSummary.text,
              wordCount: cleanSummary.wordCount,
              citations: cleanedCitations,
              isContradicted: false,
              ttsAudioBase64: null,
            },
            governorState: {
              stepDownLevel: govState.stepDownLevel,
              dailyCapRemainingPct: govState.dailyCapRemainingPct,
            },
            debug: {
              intent,
              rewrittenQuery: rewrittenText,
              routeTaken: 'WEB_SEARCH_FALLBACK',
              searchScores: searchRes.results.map((r, idx) => ({
                rank: idx + 1,
                label: r.title,
              })),
              providerAnswered: searchRes.provider,
              llmHealth,
              creditsQuota: {
                dailyCapRemainingPct: govState.dailyCapRemainingPct,
                stepDownLevel: govState.stepDownLevel,
              },
            },
          };
        }
      } catch (err) {
        console.warn('[QueryOrchestrator] Step 4 Grounded web search fallback error:', err);
      }
    }

    // =========================================================================
    // STEP 5: Honest Empty / No Verified Match -> NOT_DISCUSSED
    // =========================================================================
    return {
      ok: true,
      resolutionType: 'NOT_DISCUSSED',
      clarificationPrompt: 'Not discussed in this video. Would you like to search other videos?',
      canSearchCrossVideo: true,
      governorState: {
        stepDownLevel: govState.stepDownLevel,
        dailyCapRemainingPct: govState.dailyCapRemainingPct,
      },
      debug: {
        intent,
        rewrittenQuery: rewrittenText,
        routeTaken: 'NOT_DISCUSSED',
        searchScores: [],
        providerAnswered: 'NONE',
        llmHealth,
        creditsQuota: {
          dailyCapRemainingPct: govState.dailyCapRemainingPct,
          stepDownLevel: govState.stepDownLevel,
        },
      },
    };
  }
}
