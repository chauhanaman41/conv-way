import { GnaniConfig } from './types';

export class PrismaClient {
  private apiKey?: string;
  private endpointUrl: string;

  constructor(config: GnaniConfig) {
    this.apiKey = config.apiKey || config.accessToken;
    this.endpointUrl = config.prismaEndpointUrl || 'https://api.vachana.ai/stt/v3';
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async transcribeAudio(
    audioBytes: ArrayBuffer | Uint8Array,
    mimeType = 'audio/webm',
    language = 'en-IN'
  ): Promise<{ transcript: string; durationSec: number }> {
    if (!this.isAvailable()) {
      throw new Error('Gnani Prisma API key is not configured.');
    }

    if (audioBytes.byteLength > 2 * 1024 * 1024) {
      throw new Error('Audio payload exceeds maximum 2 MB limit.');
    }

    const formData = new FormData();
    const blob = new Blob([audioBytes], { type: mimeType });
    formData.append('audio', blob, `speech.${mimeType.split('/')[1] || 'webm'}`);
    formData.append('language', language);
    formData.append('model', 'prisma-v3.0');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'X-API-Key-ID': this.apiKey!,
          'Authorization': `Bearer ${this.apiKey!}`,
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        let errBody = '';
        try {
          errBody = await response.text();
        } catch {
          errBody = response.statusText;
        }
        throw new Error(`Gnani Prisma HTTP error ${response.status}: ${errBody}`);
      }

      const data: any = await response.json();
      const transcript = (data.transcript || data.text || data.transcription || '').trim();
      const durationSec = typeof data.duration === 'number' ? data.duration : parseFloat(data.duration) || 0;

      return {
        transcript,
        durationSec,
      };
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }
}

