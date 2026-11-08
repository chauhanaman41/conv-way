import { Env } from '../types';
import { EvonClient } from '../gnani/evon';
import { GovernorService } from './governor';

export interface WayQuestionDto {
  id: string;
  questionText: string;
  triggerSec: number;
  answer?: {
    videoId: string;
    videoTitle?: string;
    channelTitle?: string;
    startSec: number;
    endSec: number;
    isExternalVideo: boolean;
  };
  confidenceScore: number;
}

export class WayService {
  private env: Env;
  private governor: GovernorService;
  private evon: EvonClient;

  constructor(env: Env) {
    this.env = env;
    this.governor = new GovernorService(env);
    this.evon = new EvonClient({ apiKey: env.GNANI_API_KEY });
  }

  /**
   * Retrieves predicted Way questions for a window, generating via Evon on cache miss
   */
  async getQuestionsForWindow(
    videoId: string,
    windowIndex: number,
    lang = 'en',
    mode: 'full' | 'titles' = 'full'
  ): Promise<{ questions: WayQuestionDto[]; startSec: number; endSec: number }> {
    if (!this.env.DB) {
      return { questions: [], startSec: 0, endSec: 0 };
    }

    // 1. Get window boundaries
    const windowRow = await this.env.DB.prepare(
      `SELECT start_sec, end_sec, plain_text FROM transcript_windows WHERE video_id = ?1 AND window_index = ?2`
    )
      .bind(videoId, windowIndex)
      .first<{ start_sec: number; end_sec: number; plain_text: string }>();

    if (!windowRow) {
      return { questions: [], startSec: 0, endSec: 0 };
    }

    // 2. Check D1 way_questions cache
    const existing = await this.env.DB.prepare(
      `SELECT id, question_text, trigger_sec, answer_video_id, answer_video_title, answer_channel_title,
              answer_start_sec, answer_end_sec, confidence_score
       FROM way_questions
       WHERE video_id = ?1 AND window_index = ?2 AND language = ?3
       ORDER BY trigger_sec ASC`
    )
      .bind(videoId, windowIndex, lang)
      .all<any>();

    if (existing.results && existing.results.length > 0) {
      const questions: WayQuestionDto[] = existing.results.map((r: any) => ({
        id: r.id,
        questionText: r.question_text,
        triggerSec: r.trigger_sec,
        confidenceScore: r.confidence_score,
        ...(mode === 'full'
          ? {
              answer: {
                videoId: r.answer_video_id,
                videoTitle: r.answer_video_title || undefined,
                channelTitle: r.answer_channel_title || undefined,
                startSec: r.answer_start_sec,
                endSec: r.answer_end_sec,
                isExternalVideo: r.answer_video_id !== videoId,
              },
            }
          : {}),
      }));

      return {
        questions,
        startSec: windowRow.start_sec,
        endSec: windowRow.end_sec,
      };
    }

    // 3. Cache miss: check governor before generating with Gnani Evon
    const govState = await this.governor.getState();
    if (!govState.canCallEvon || !this.env.GNANI_API_KEY) {
      // Degraded state: return empty questions list rather than fake questions
      return { questions: [], startSec: windowRow.start_sec, endSec: windowRow.end_sec };
    }

    // Fetch video metadata for duration check
    const videoRow = await this.env.DB.prepare(
      `SELECT title, channel_title, duration_sec FROM videos WHERE video_id = ?1`
    )
      .bind(videoId)
      .first<{ title: string; channel_title: string; duration_sec: number }>();

    const maxDuration = videoRow?.duration_sec ?? 86400;

    // Call Gnani Evon to generate predicted questions
    const startTime = Date.now();
    try {
      let cuesJson = '[]';
      const cueRow = await this.env.DB.prepare(
        `SELECT cues_json, word_count FROM transcript_windows WHERE video_id = ?1 AND window_index = ?2`
      )
        .bind(videoId, windowIndex)
        .first<{ cues_json: string; word_count: number }>();
      if (cueRow) {
        cuesJson = cueRow.cues_json;
      }

      const prediction = await this.evon.predictWayQuestions(
        {
          windowIndex,
          startSec: windowRow.start_sec,
          endSec: windowRow.end_sec,
          wordCount: cueRow?.word_count || 500,
          plainText: windowRow.plain_text,
          cuesJson,
        },
        maxDuration
      );

      const latency = Date.now() - startTime;
      await this.governor.recordUsage({
        service: 'GNANI_EVON',
        operation: 'WAY_PREDICTION',
        unitsConsumed: 1,
        estimatedCredits: 0.25,
        httpStatus: 200,
        latencyMs: latency,
      });

      const questionsToInsert: WayQuestionDto[] = [];

      for (const q of prediction.questions) {
        // Enforce boundary sanity checks
        const validStart = Math.max(0, Math.min(q.answerStartSec, maxDuration));
        const validEnd = Math.max(validStart + 5, Math.min(q.answerEndSec, maxDuration));
        const qId = `wq_${crypto.randomUUID().slice(0, 8)}`;

        await this.env.DB.prepare(
          `INSERT INTO way_questions (
            id, video_id, window_index, language, question_text, normalized_q,
            trigger_sec, answer_video_id, answer_video_title, answer_channel_title,
            answer_start_sec, answer_end_sec, confidence_score, source_type, created_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'PREDICTED', (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`
        )
          .bind(
            qId,
            videoId,
            windowIndex,
            lang,
            q.questionText,
            q.questionText.toLowerCase().replace(/[^\w\s]/g, '').trim(),
            q.triggerSec,
            videoId,
            videoRow?.title || null,
            videoRow?.channel_title || null,
            validStart,
            validEnd,
            q.confidenceScore || 0.95
          )
          .run();

        questionsToInsert.push({
          id: qId,
          questionText: q.questionText,
          triggerSec: q.triggerSec,
          confidenceScore: q.confidenceScore || 0.95,
          ...(mode === 'full'
            ? {
                answer: {
                  videoId,
                  videoTitle: videoRow?.title,
                  channelTitle: videoRow?.channel_title,
                  startSec: validStart,
                  endSec: validEnd,
                  isExternalVideo: false,
                },
              }
            : {}),
        });
      }

      return {
        questions: questionsToInsert,
        startSec: windowRow.start_sec,
        endSec: windowRow.end_sec,
      };
    } catch (err) {
      console.warn('[WayService] Evon generation failed:', err);
      return { questions: [], startSec: windowRow.start_sec, endSec: windowRow.end_sec };
    }
  }

  /**
   * Retrieves single question details and increments hit count
   */
  async getQuestionById(questionId: string): Promise<WayQuestionDto | null> {
    if (!this.env.DB) return null;

    const row = await this.env.DB.prepare(
      `SELECT id, video_id, question_text, trigger_sec, answer_video_id, answer_video_title, answer_channel_title,
              answer_start_sec, answer_end_sec, confidence_score
       FROM way_questions WHERE id = ?1`
    )
      .bind(questionId)
      .first<any>();

    if (!row) return null;

    // Increment hit telemetry
    await this.env.DB.prepare(
      `UPDATE way_questions SET hit_count = hit_count + 1, last_hit_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?1`
    )
      .bind(questionId)
      .run();

    return {
      id: row.id,
      questionText: row.question_text,
      triggerSec: row.trigger_sec,
      confidenceScore: row.confidence_score,
      answer: {
        videoId: row.answer_video_id,
        videoTitle: row.answer_video_title || undefined,
        channelTitle: row.answer_channel_title || undefined,
        startSec: row.answer_start_sec,
        endSec: row.answer_end_sec,
        isExternalVideo: row.answer_video_id !== row.video_id,
      },
    };
  }
}
