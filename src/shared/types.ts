// Shared Type Definitions for Conv-way

export type CaptionStatus = 'READY' | 'NO_CAPTIONS' | 'BUDGET_DEFERRED' | 'PENDING' | 'PROCESSING' | 'FAILED';
export type TranscriptProvider = 'SUPADATA' | 'TRANSCRIPT_API' | 'NONE';
export type SourceType = 'PREDICTED' | 'LEARNED_LIVE' | 'EMPTY_PLACEHOLDER';
export type ModerationStatus = 'APPROVED' | 'PENDING' | 'FLAGGED';
export type GovernorTier = 'TIER_1_NORMAL' | 'TIER_2_MODERATE' | 'TIER_3_CONSERVATIVE' | 'TIER_4_HARD_CAP';
export type ResolutionType = 'IN_VIDEO_SEGMENT' | 'EXTERNAL_VIDEO_SEGMENT' | 'AI_VERIFIED_FALLBACK' | 'NO_MATCH';
export type SystemStatusType = 'IDLE · READY' | 'LISTENING · MIC ACTIVE' | 'THINKING · ROUTING QUERY' | 'PLAYING ANSWER' | 'WAITING FOR YOU · HAND-BACK';

export interface CaptionCue {
  t: number; // start second
  d: number; // duration second
  w: string; // text phrase
}

export interface VideoRecord {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId?: string | null;
  thumbnailUrl: string;
  durationSec: number;
  language: string;
  captionStatus: CaptionStatus;
  transcriptProvider?: TranscriptProvider;
  windowCount: number;
  accessCount?: number;
  lastAccessedAt?: string;
  createdAt?: string;
}

export interface TranscriptWindow {
  id?: number;
  videoId: string;
  windowIndex: number;
  startSec: number;
  endSec: number;
  wordCount: number;
  plainText: string;
  cuesJson: string;
  rollingSummary?: string | null;
  cues?: CaptionCue[];
}

export interface WayQuestionAnswer {
  videoId: string;
  videoTitle?: string | null;
  channelTitle?: string | null;
  speakerName?: string | null;
  startSec: number;
  endSec: number;
  isExternalVideo: boolean;
  breadcrumbSummary?: string;
}

export interface WayQuestion {
  id: string;
  videoId: string;
  windowIndex: number;
  language: string;
  questionText: string;
  normalizedQ?: string;
  triggerSec: number;
  answer: WayQuestionAnswer;
  confidenceScore: number;
  sourceType: SourceType;
  moderationStatus?: ModerationStatus;
  hitCount?: number;
  lastHitAt?: string;
}

export interface Citation {
  title: string;
  url: string;
  snippet?: string;
}

export interface AiFallbackResponse {
  isAiLabeled: true;
  reason: string;
  answerText: string;
  wordCount: number;
  citations: Citation[];
  ttsAudioBase64?: string | null;
}

export interface GovernorState {
  tier: GovernorTier;
  dailyCapRemainingPct?: number;
}

export interface AskQueryResponse {
  ok: boolean;
  resolutionType: ResolutionType;
  cacheSource?: 'WAY_PREPARED_MATCH' | 'FTS5_EXACT_MATCH' | 'EVON_RERANK' | 'CROSS_VIDEO_SEARCH' | 'AI_FALLBACK';
  answerClip?: WayQuestionAnswer;
  aiFallback?: AiFallbackResponse;
  clarificationPrompt?: string;
  governorState?: GovernorState;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface StackEntry {
  id: string;
  videoId: string;
  videoTitle?: string;
  channelTitle?: string;
  returnTimestamp: number;
  playbackRate: number;
  volume: number;
  branchId: string;
  queryText: string;
  isExternal: boolean;
  clipStartSec?: number;
  clipEndSec?: number;
}

export interface SystemStatusResponse {
  ok: boolean;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  governor: {
    tier: GovernorTier;
    daysRemaining: number;
    totalBudget: number;
    spentCredits: number;
    remainingCredits: number;
    dailyCap: number;
    dailySpentToday: number;
    dailyRemainingPct: number;
  };
  quotas: {
    transcriptsFetchedToday: number;
    dailyTranscriptLimit: number;
    youtubeSearchesToday: number;
    dailySearchLimit: number;
  };
  database: {
    estimatedStorageMb: number;
    storageCeilingMb: number;
  };
}

export interface UserPreferences {
  audioDuckingMode: 'duck' | 'pause';
  uiLanguage: string;
  timbreTtsOptIn: boolean;
}

