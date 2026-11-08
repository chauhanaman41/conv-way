export interface Env {
  // Bindings
  DB: D1Database;
  KV: KVNamespace;
  ASSETS?: Fetcher;

  // Variables
  ENVIRONMENT?: string;
  GNANI_TOTAL_CREDIT_BUDGET?: string;
  GNANI_BUDGET_END_DATE?: string;
  GNANI_RESERVE_RATIO?: string;
  YOUTUBE_DAILY_SEARCH_BUDGET?: string;
  DAILY_TRANSCRIPT_FETCH_BUDGET?: string;
  D1_STORAGE_LIMIT_MB?: string;

  SEARCH_ORDER_TRUSTED?: string;
  SEARCH_ORDER_OPEN?: string;
  SEARCH_MAX_PER_QUESTION?: string;
  SEARCH_DAILY_CAP?: string;
  GOOGLE_CSE_ENABLED?: string;
  GOOGLE_CSE_SUNSET?: string;
  GOOGLE_CSE_DAILY_CAP?: string;
  SEARCH_CACHE_TTL_DAYS?: string;

  // Secrets
  GNANI_API_KEY?: string;
  SUPADATA_API_KEY?: string;
  TRANSCRIPT_API_FALLBACK_KEY?: string;
  YOUTUBE_DATA_API_KEY?: string;
  TAVILY_API_KEY?: string;
  EXA_API_KEY?: string;
  WEB_SEARCH_API_KEY?: string;
  WEB_SEARCH_CX?: string;
  ADMIN_CALIBRATION_SECRET?: string;
  IP_HASH_SALT?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    ipHash: string;
  };
};

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: any;
    governorState?: {
      stepDownLevel: 'NORMAL' | 'CONSERVATIVE' | 'CRITICAL' | 'SHUTDOWN';
      dailyCapRemainingPct: number;
    };
  };
}
