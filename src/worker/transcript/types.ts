export interface TranscriptCue {
  start: number;    // In seconds
  duration: number; // In seconds
  text: string;     // Transcript phrase
}

export interface TranscriptFetchResult {
  provider: 'SUPADATA' | 'TRANSCRIPT_API';
  videoId: string;
  language: string;
  cues: TranscriptCue[];
}

export interface ITranscriptProvider {
  name: 'SUPADATA' | 'TRANSCRIPT_API';
  fetchTranscript(videoId: string, language?: string): Promise<TranscriptFetchResult>;
}

export interface WindowCueCompact {
  t: number; // start second
  d: number; // duration second
  w: string; // phrase text
}

export interface SpeechWindow {
  windowIndex: number;
  startSec: number;
  endSec: number;
  wordCount: number;
  plainText: string;
  cuesJson: string;
  rollingSummary?: string;
}

