import { ITranscriptProvider, TranscriptCue, TranscriptFetchResult } from './types';

export class SupadataProvider implements ITranscriptProvider {
  public readonly name = 'SUPADATA' as const;
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  public async fetchTranscript(videoId: string, language = 'en'): Promise<TranscriptFetchResult> {
    if (!this.apiKey) {
      throw new Error('Supadata API key is missing.');
    }

    const url = `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(language)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
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
        throw new Error(`Supadata HTTP error ${response.status}: ${errText}`);
      }

      const data: any = await response.json();
      const rawCues = data.content || [];

      // Supadata returns offset and duration in milliseconds
      const cues: TranscriptCue[] = rawCues.map((c: any) => ({
        start: typeof c.offset === 'number' ? c.offset / 1000 : parseFloat(c.offset) / 1000 || 0,
        duration: typeof c.duration === 'number' ? c.duration / 1000 : parseFloat(c.duration) / 1000 || 0,
        text: (c.text || '').replace(/\n+/g, ' ').trim(),
      })).filter((c: TranscriptCue) => c.text.length > 0);

      if (cues.length === 0) {
        throw new Error(`No transcript cues found for video ${videoId} in language ${language}`);
      }

      return {
        provider: this.name,
        videoId,
        language: data.lang || language,
        cues,
      };
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }
}

