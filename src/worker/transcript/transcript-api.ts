import { ITranscriptProvider, TranscriptCue, TranscriptFetchResult } from './types';

export class TranscriptApiProvider implements ITranscriptProvider {
  public readonly name = 'TRANSCRIPT_API' as const;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public async fetchTranscript(videoId: string, language = 'en'): Promise<TranscriptFetchResult> {
    if (!this.apiKey) {
      throw new Error('TranscriptAPI key is missing.');
    }

    const url = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoId)}&format=json`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        let errText = '';
        try {
          errText = await response.text();
        } catch {
          errText = response.statusText;
        }
        throw new Error(`TranscriptAPI HTTP error ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const rawCues = data.transcript || [];

      // TranscriptAPI returns start and duration in seconds directly
      const cues: TranscriptCue[] = rawCues.map((c: any) => ({
        start: typeof c.start === 'number' ? c.start : parseFloat(c.start) || 0,
        duration: typeof c.duration === 'number' ? c.duration : parseFloat(c.duration) || 0,
        text: (c.text || '').replace(/\n+/g, ' ').trim(),
      })).filter((c: TranscriptCue) => c.text.length > 0);

      if (cues.length === 0) {
        throw new Error(`No transcript cues found for video ${videoId} in language ${language}`);
      }

      return {
        provider: this.name,
        videoId,
        language: data.language || language,
        cues,
      };
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }
}

