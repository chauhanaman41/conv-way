import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { Env, AppEnv, ApiErrorResponse } from './types';
import { rateLimiterMiddleware, getHashedIp } from './middleware/rate-limiter';
import { GovernorService } from './services/governor';
import { YouTubeDiscoveryService } from './youtube/discovery';
import { TranscriptAdapter } from './transcript/adapter';
import { WayService } from './services/way';
import { QueryOrchestrator } from './services/query';
import { PrismaClient } from './gnani/prisma';

const app = new Hono<AppEnv>();

// Enable CORS
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Calibration-Key'],
  })
);

// Standard error handling
app.onError((err, c) => {
  console.error('[Worker Error]', err);
  const status = err.message === 'NO_VERIFIED_MATCH' ? 404 : 500;
  const errorResponse: ApiErrorResponse = {
    ok: false,
    error: {
      code: err.message === 'NO_VERIFIED_MATCH' ? 'NO_VERIFIED_MATCH' : 'INTERNAL_SERVER_ERROR',
      message:
        err.message === 'NO_VERIFIED_MATCH'
          ? 'No verified video segment or grounded source found for this question.'
          : err.message || 'An unexpected server error occurred.',
      retryable: status !== 404,
    },
  };
  return c.json(errorResponse, status);
});

// =============================================================================
// DISCOVERY ENDPOINTS
// =============================================================================

// GET /api/discovery/trending
app.get('/api/discovery/trending', async (c) => {
  const discovery = new YouTubeDiscoveryService(c.env);
  const trending = await discovery.getTrending();
  return c.json({
    ok: true,
    updatedAt: trending.updatedAt,
    videos: trending.videos,
  });
});

// GET /api/discovery/search?q={query}&lang={lang}
app.get('/api/discovery/search', async (c) => {
  const q = c.req.query('q');
  const lang = c.req.query('lang') || 'en';

  if (!q || q.trim().length < 2) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'Search query parameter "q" must be at least 2 characters.',
          retryable: false,
        },
      },
      400
    );
  }

  const discovery = new YouTubeDiscoveryService(c.env);
  const results = await discovery.search(q, lang);
  return c.json({
    ok: true,
    source: 'D1_FTS5_AND_YOUTUBE',
    results,
  });
});

// POST /api/videos/resolve
app.post('/api/videos/resolve', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const urlOrId = body.url || body.videoId;

  if (!urlOrId || typeof urlOrId !== 'string') {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body must include "url" or "videoId".',
          retryable: false,
        },
      },
      400
    );
  }

  const discovery = new YouTubeDiscoveryService(c.env);
  const video = await discovery.resolveVideo(urlOrId);

  if (!video) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'VIDEO_NOT_FOUND',
          message: 'Unable to resolve or retrieve YouTube metadata for this video.',
          retryable: false,
        },
      },
      404
    );
  }

  return c.json({
    ok: true,
    video,
  });
});

// =============================================================================
// VIDEO INITIALIZATION & TRANSCRIPTS (2-Second Rule)
// =============================================================================

const initSchema = z.object({
  watchedSeconds: z.number().min(0),
  currentPlayheadSec: z.number().optional(),
  language: z.string().optional().default('en'),
  title: z.string().optional(),
  channelTitle: z.string().optional(),
  durationSec: z.number().optional(),
});

// POST /api/videos/:videoId/init
app.post('/api/videos/:videoId/init', rateLimiterMiddleware('INIT_TRANSCRIPT'), async (c) => {
  const videoId = c.req.param('videoId');
  if (!videoId) {
    return c.json({ ok: false, error: { code: 'INVALID_VIDEO_ID', message: 'Missing videoId', retryable: false } }, 400);
  }
  const json = await c.req.json().catch(() => null);
  const parseResult = initSchema.safeParse(json);

  if (!parseResult.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'Invalid initialization payload.',
          details: parseResult.error.format(),
          retryable: false,
        },
      },
      400
    );
  }

  const { watchedSeconds, language, title, channelTitle, durationSec } = parseResult.data;

  // STRICT 2-SECOND RULE ENFORCEMENT
  if (watchedSeconds < 2.0) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'WATCH_THRESHOLD_NOT_MET',
          message: `Active watch threshold not met (watchedSeconds: ${watchedSeconds.toFixed(1)}s < 2.0s required).`,
          retryable: true,
        },
      },
      400
    );
  }

  const ipHash = c.get('ipHash') || (await getHashedIp(c));
  const adapter = new TranscriptAdapter({
    supadataKey: c.env.SUPADATA_API_KEY,
    transcriptApiKey: c.env.TRANSCRIPT_API_FALLBACK_KEY,
    db: c.env.DB,
  });

  const ingestionResult = await adapter.ingestVideoTranscript({
    videoId,
    title,
    channelTitle,
    durationSec,
    language: language || 'en',
    ipHash,
  });

  if (ingestionResult.captionStatus !== 'READY') {
    return c.json(
      {
        ok: false,
        error: {
          code:
            ingestionResult.captionStatus === 'BUDGET_DEFERRED'
              ? 'BUDGET_DEFERRED'
              : 'TRANSCRIPT_UNAVAILABLE',
          message:
            ingestionResult.captionStatus === 'BUDGET_DEFERRED'
              ? 'Daily transcript budget limit reached (5 new transcripts per day).'
              : 'Captions are unavailable from both primary and fallback providers for this video.',
          retryable: ingestionResult.captionStatus === 'BUDGET_DEFERRED',
        },
        captionStatus: ingestionResult.captionStatus,
        windowCount: 0,
        windows: [],
      },
      ingestionResult.captionStatus === 'BUDGET_DEFERRED' ? 429 : 404
    );
  }

  // Pre-warm Window 0 for Way questions in the background
  if (ingestionResult.captionStatus === 'READY' && ingestionResult.windowCount > 0) {
    const wayService = new WayService(c.env);
    c.executionCtx.waitUntil(
      wayService.getQuestionsForWindow(videoId, 0, language || 'en', 'full').catch((err) => {
        console.warn('[Init] Window 0 prewarm error:', err);
      })
    );
  }

  return c.json({
    ok: true,
    videoId,
    captionStatus: ingestionResult.captionStatus,
    windowCount: ingestionResult.windowCount,
    transcriptProvider: (ingestionResult as any).provider || 'SUPADATA',
    windows: (ingestionResult.windows || []).map((w) => ({
      windowIndex: w.windowIndex,
      startSec: w.startSec,
      endSec: w.endSec,
      wordCount: w.wordCount,
    })),
  });
});

// Helper to compute next UTC 00:00 ISO string
function getNextUtcMidnightIso(): string {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

// GET /api/videos/:videoId/state (One True State API)
app.get('/api/videos/:videoId/state', async (c) => {
  const videoId = c.req.param('videoId');
  if (!videoId) {
    return c.json({ ok: false, error: { code: 'INVALID_VIDEO_ID', message: 'Missing videoId' } }, 400);
  }

  if (!c.env.DB) {
    return c.json({
      ok: true,
      status: 'PENDING',
      captionStatus: 'PENDING',
      windowCount: 0,
      language: 'en',
      provider: 'NONE',
      reason: null,
      retryAfter: null,
      windows: [],
    });
  }

  const row = await c.env.DB.prepare(
    `SELECT caption_status, window_count, language, transcript_provider, duration_sec FROM videos WHERE video_id = ?1`
  )
    .bind(videoId)
    .first<any>();

  if (!row) {
    return c.json({
      ok: true,
      status: 'PENDING',
      captionStatus: 'PENDING',
      windowCount: 0,
      language: 'en',
      provider: 'NONE',
      reason: 'Active watch gate requires >= 2.0s of continuous playback.',
      retryAfter: null,
      windows: [],
    });
  }

  let status: 'READY' | 'PENDING' | 'BUDGET_EXHAUSTED' | 'NO_CAPTIONS' | 'FAILED' = 'PENDING';
  let reason: string | null = null;
  let retryAfterVal: string | null = null;

  if (row.caption_status === 'READY') {
    status = 'READY';
  } else if (row.caption_status === 'BUDGET_DEFERRED' || row.caption_status === 'BUDGET_EXHAUSTED') {
    status = 'BUDGET_EXHAUSTED';
    reason = 'Daily transcript budget limit reached (5 new transcripts per day).';
    retryAfterVal = getNextUtcMidnightIso();
  } else if (row.caption_status === 'NO_CAPTIONS') {
    status = 'NO_CAPTIONS';
    reason = 'Captions unavailable from transcript providers.';
  } else if (row.caption_status === 'PROCESSING') {
    status = 'PENDING';
    reason = 'Transcript ingestion in progress.';
  } else {
    status = 'FAILED';
    reason = 'Transcript processing failed.';
  }

  let windows: any[] = [];
  if (status === 'READY') {
    const windowsRes = await c.env.DB.prepare(
      `SELECT window_index as windowIndex, start_sec as startSec, end_sec as endSec, word_count as wordCount
       FROM transcript_windows WHERE video_id = ?1 ORDER BY window_index ASC`
    )
      .bind(videoId)
      .all<any>();
    windows = windowsRes.results || [];
  }

  return c.json({
    ok: true,
    status,
    captionStatus: row.caption_status,
    windowCount: status === 'READY' ? (row.window_count || windows.length) : 0,
    language: row.language || 'en',
    provider: row.transcript_provider || 'NONE',
    durationSec: row.duration_sec,
    reason,
    retryAfter: retryAfterVal,
    windows,
  });
});

// GET /api/videos/:videoId/status (Backwards-compatible alias)
app.get('/api/videos/:videoId/status', async (c) => {
  const videoId = c.req.param('videoId');
  if (!videoId) {
    return c.json({ ok: false, error: { code: 'INVALID_VIDEO_ID', message: 'Missing videoId' } }, 400);
  }

  if (!c.env.DB) {
    return c.json({ ok: true, videoId, captionStatus: 'PENDING', windowCount: 0, windows: [] });
  }

  const row = await c.env.DB.prepare(
    `SELECT caption_status, window_count, language, duration_sec FROM videos WHERE video_id = ?1`
  )
    .bind(videoId)
    .first<any>();

  if (!row) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'VIDEO_NOT_INITIALIZED',
          message: 'Video has not been initialized or indexed in Conv-way.',
          retryable: true,
        },
      },
      404
    );
  }

  const windowsRes = await c.env.DB.prepare(
    `SELECT window_index as windowIndex, start_sec as startSec, end_sec as endSec, word_count as wordCount FROM transcript_windows WHERE video_id = ?1 ORDER BY window_index ASC`
  )
    .bind(videoId)
    .all<any>();

  return c.json({
    ok: true,
    videoId,
    captionStatus: row.caption_status,
    status: row.caption_status,
    windowCount: row.window_count,
    language: row.language,
    durationSec: row.duration_sec,
    windows: windowsRes.results || [],
  });
});

// =============================================================================
// WAY QUESTION PREDICTION ENDPOINTS
// =============================================================================

// GET /api/videos/:videoId/way?windowIndex={index}&lang={lang}&mode={full|titles}
app.get('/api/videos/:videoId/way', async (c) => {
  const videoId = c.req.param('videoId');
  if (!videoId) {
    return c.json({ ok: false, error: { code: 'INVALID_VIDEO_ID', message: 'Missing videoId', retryable: false } }, 400);
  }
  const windowIndexStr = c.req.query('windowIndex');
  const lang = c.req.query('lang') || 'en';
  const mode = (c.req.query('mode') as 'full' | 'titles') || 'full';

  const windowIndex = parseInt(windowIndexStr || '0', 10);
  if (isNaN(windowIndex) || windowIndex < 0) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_WINDOW_INDEX',
          message: 'windowIndex query parameter must be a non-negative integer.',
          retryable: false,
        },
      },
      400
    );
  }

  const wayService = new WayService(c.env);
  const result = await wayService.getQuestionsForWindow(videoId, windowIndex, lang, mode);

  // Set CDN edge cache headers for cached speech windows (busted with ?v=2, shortened s-maxage to 300)
  c.header('Cache-Control', 'public, max-age=60, s-maxage=300');

  return c.json({
    ok: true,
    videoId,
    windowIndex,
    startSec: result.startSec,
    endSec: result.endSec,
    questions: result.questions,
    tier: result.tier || 'TIER_A_MODEL',
    reason: result.reason || null,
    modelId: result.modelId || null,
  });
});

// GET /api/videos/:videoId/way/:questionId
app.get('/api/videos/:videoId/way/:questionId', async (c) => {
  const questionId = c.req.param('questionId');
  if (!questionId) {
    return c.json({ ok: false, error: { code: 'INVALID_QUESTION_ID', message: 'Missing questionId', retryable: false } }, 400);
  }
  const wayService = new WayService(c.env);
  const question = await wayService.getQuestionById(questionId);

  if (!question) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'QUESTION_NOT_FOUND',
          message: 'Specified Way question was not found.',
          retryable: false,
        },
      },
      404
    );
  }

  return c.json({
    ok: true,
    question,
  });
});

// =============================================================================
// LIVE QUERY RESOLUTION & DIVE DEEPER
// =============================================================================

const askSchema = z.object({
  videoId: z.string(),
  currentPlayheadSec: z.number().default(0),
  windowIndex: z.number().optional(),
  questionText: z.string().min(2).max(500),
  language: z.string().optional().default('en'),
  isDiveDeeper: z.boolean().optional().default(false),
  excludedRanges: z
    .array(
      z.object({
        startSec: z.number(),
        endSec: z.number(),
      })
    )
    .optional(),
  ttsOptIn: z.boolean().optional().default(false),
});

// POST /api/query/ask
app.post('/api/query/ask', rateLimiterMiddleware('ASK_QUERY'), async (c) => {
  const json = await c.req.json().catch(() => null);
  const parseResult = askSchema.safeParse(json);

  if (!parseResult.success) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_ASK_REQUEST',
          message: 'Invalid ask query payload.',
          details: parseResult.error.format(),
          retryable: false,
        },
      },
      400
    );
  }

  const ipHash = c.get('ipHash') || (await getHashedIp(c));
  const orchestrator = new QueryOrchestrator(c.env);

  try {
    const answer = await orchestrator.ask(parseResult.data, ipHash);
    return c.json(answer);
  } catch (err: any) {
    if (err.message === 'NO_VERIFIED_MATCH') {
      const governor = new GovernorService(c.env);
      const govState = await governor.getState();
      return c.json(
        {
          ok: false,
          error: {
            code: 'NO_VERIFIED_MATCH',
            message: 'No verified video segment or grounded web source found for this question.',
            retryable: false,
            governorState: {
              stepDownLevel: govState.stepDownLevel,
              dailyCapRemainingPct: govState.dailyCapRemainingPct,
            },
          },
        },
        404
      );
    }
    throw err;
  }
});

// =============================================================================
// VOICE TRANSCRIPTION FALLBACK (Gnani Prisma v3.0)
// =============================================================================

// POST /api/voice/transcribe
app.post('/api/voice/transcribe', rateLimiterMiddleware('VOICE_TRANSCRIBE'), async (c) => {
  const governor = new GovernorService(c.env);
  const govState = await governor.getState();

  if (!govState.canCallPrisma) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'VOICE_TRANSCRIBE_DISABLED',
          message: 'Server-side voice transcription is temporarily paused to preserve daily credit pool. Please use browser speech recognition or type your question.',
          retryable: false,
          governorState: {
            stepDownLevel: govState.stepDownLevel,
            dailyCapRemainingPct: govState.dailyCapRemainingPct,
          },
        },
      },
      503
    );
  }

  const contentType = c.req.header('content-type') || '';
  let audioBuffer: ArrayBuffer | null = null;
  let mimeType = 'audio/webm';
  let language = 'en-IN';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('audio') as File | null;
    language = (formData.get('language') as string) || 'en-IN';

    if (!file) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'MISSING_AUDIO_FILE',
            message: 'Multipart form must include "audio" field with audio file.',
            retryable: false,
          },
        },
        400
      );
    }
    mimeType = file.type || 'audio/webm';
    audioBuffer = await file.arrayBuffer();
  } else {
    mimeType = contentType.split(';')[0].trim() || 'audio/webm';
    audioBuffer = await c.req.arrayBuffer();
  }

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'EMPTY_AUDIO_PAYLOAD',
          message: 'No audio data received.',
          retryable: false,
        },
      },
      400
    );
  }

  if (audioBuffer.byteLength > 2 * 1024 * 1024) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'AUDIO_PAYLOAD_TOO_LARGE',
          message: 'Audio recording exceeds maximum permitted 2 MB limit.',
          retryable: false,
        },
      },
      413
    );
  }

  const prisma = new PrismaClient({ apiKey: c.env.GNANI_API_KEY });
  const startMs = Date.now();
  const ipHash = c.get('ipHash') || (await getHashedIp(c));

  try {
    const result = await prisma.transcribeAudio(audioBuffer, mimeType, language);
    const latency = Date.now() - startMs;

    await governor.recordUsage({
      service: 'GNANI_PRISMA',
      operation: 'VOICE_TRANSCRIBE',
      unitsConsumed: result.durationSec / 60,
      estimatedCredits: 0.5 * (result.durationSec / 60),
      httpStatus: 200,
      latencyMs: latency,
      ipHash,
    });

    return c.json({
      ok: true,
      provider: 'GNANI_PRISMA_V3',
      transcript: result.transcript,
      language,
      durationSec: result.durationSec,
      confidence: result.confidence,
    });
  } catch (err: any) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'TRANSCRIPTION_FAILED',
          message: err.message || 'Gnani Prisma voice transcription failed.',
          retryable: true,
        },
      },
      502
    );
  }
});

// =============================================================================
// SYSTEM OBSERVABILITY & ADMINISTRATIVE CALIBRATION
// =============================================================================

// GET /api/system/status
app.get('/api/system/status', async (c) => {
  const governor = new GovernorService(c.env);
  const state = await governor.getState();

  return c.json({
    ok: true,
    system: 'Conv-way Edge Worker',
    environment: c.env.ENVIRONMENT || 'production',
    status: 'HEALTHY',
    governor: state,
    integrations: {
      gnaniEvon: Boolean(c.env.GNANI_API_KEY),
      gnaniPrisma: Boolean(c.env.GNANI_API_KEY),
      gnaniTimbre: Boolean(c.env.GNANI_API_KEY),
      supadata: Boolean(c.env.SUPADATA_API_KEY),
      transcriptApiFallback: Boolean(c.env.TRANSCRIPT_API_FALLBACK_KEY),
      youtubeDataApi: Boolean(c.env.YOUTUBE_DATA_API_KEY),
      tavilySearch: Boolean(c.env.TAVILY_API_KEY),
      exaSearch: Boolean(c.env.EXA_API_KEY),
      googleCse: c.env.GOOGLE_CSE_ENABLED !== 'false' && Boolean(c.env.WEB_SEARCH_API_KEY && c.env.WEB_SEARCH_CX),
    },
    timestamp: new Date().toISOString(),
  });
});

// POST /api/admin/calibrate
app.post('/api/admin/calibrate', async (c) => {
  const adminKey = c.req.header('X-Admin-Calibration-Key');
  if (!adminKey || adminKey !== c.env.ADMIN_CALIBRATION_SECRET) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Valid X-Admin-Calibration-Key header is required.',
          retryable: false,
        },
      },
      401
    );
  }

  // Returns current measured rates from D1 calibration_rates
  if (c.env.DB) {
    const rates = await c.env.DB.prepare(
      `SELECT service_op, credits_per_unit, unit_type, p50_latency_ms, p95_latency_ms, measured_sample_size, updated_at
       FROM calibration_rates`
    ).all<any>();

    return c.json({
      ok: true,
      calibrationRates: rates.results,
      status: 'CALIBRATED',
      timestamp: new Date().toISOString(),
    });
  }

  return c.json({ ok: true, status: 'NO_DB' });
});

// POST /api/admin/warm
app.post('/api/admin/warm', async (c) => {
  const adminKey = c.req.header('X-Admin-Calibration-Key');
  if (!adminKey || adminKey !== c.env.ADMIN_CALIBRATION_SECRET) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }

  const discovery = new YouTubeDiscoveryService(c.env);
  const trending = await discovery.getTrending();

  return c.json({
    ok: true,
    warmedVideosCount: trending.videos.length,
    trendingUpdated: trending.updatedAt,
  });
});

// =============================================================================
// WORKER EXPORT WITH SCHEDULED CRON TRIGGER & STATIC ASSET PASSTHROUGH
// =============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. API endpoints handled by Hono
    if (url.pathname.startsWith('/api')) {
      return app.fetch(request, env, ctx);
    }

    // 2. Static Assets handled by Cloudflare Worker Assets (Vite SPA)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Conv-way API Worker is running. Frontend assets not mounted.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('[Cron Trigger] Executing daily 02:00 UTC maintenance job...');
    const discovery = new YouTubeDiscoveryService(env);

    // Refresh Top 20 trending list
    await discovery.getTrending().catch((err) => {
      console.error('[Cron] Error refreshing trending podcasts:', err);
    });

    // Clean up expired rate limit counters older than 24 hours
    if (env.DB) {
      try {
        await env.DB.prepare(
          `DELETE FROM rate_limit_counters WHERE datetime(expires_at) < datetime('now', '-1 day')`
        ).run();
        console.log('[Cron] Cleaned up expired rate limit counters.');
      } catch (e) {
        console.warn('[Cron] Rate limit cleanup error:', e);
      }
    }
  },
};
