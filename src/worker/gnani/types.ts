export interface GnaniConfig {
  apiKey?: string;
  accessToken?: string;
  evonEndpointUrl?: string;
  prismaEndpointUrl?: string;
  timbreEndpointUrl?: string;
}

export interface PredictedWayQuestion {
  questionText: string;
  triggerSec: number;
  answerStartSec: number;
  answerEndSec: number;
  speakerName?: string;
  confidenceScore: number;
}

export interface EvonWayPrediction {
  questions: PredictedWayQuestion[];
}

export interface EvonRerankResult {
  windowIndex: number;
  startSec: number;
  endSec: number;
  speakerName?: string;
  breadcrumbSummary: string;
  confidenceScore: number;
}

export interface EvonFallbackResult {
  answerText: string;
  reason: string;
  citedUrls: string[];
  isContradicted: boolean;
}

