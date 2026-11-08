import { GnaniConfig } from './types';

export class TimbreClient {
  private apiKey?: string;
  private endpointUrl: string;

  constructor(config: GnaniConfig) {
    this.apiKey = config.apiKey || config.accessToken;
    this.endpointUrl = config.timbreEndpointUrl || 'https://api.vachana.ai/api/v1/tts/inference';
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Synthesizes speech from text and returns a base64 encoded audio string.
   */
  public async synthesizeSpeech(text: string, language = 'en-IN', voice = 'Avinash'): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key-ID': this.apiKey!,
          'Authorization': `Bearer ${this.apiKey!}`,
        },
        body: JSON.stringify({
          model: 'timbre-v3.0',
          voice,
          text,
          language,
        }),
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
        console.warn(`[TimbreClient] Synthesis failed with status ${response.status}: ${errBody}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (err: any) {
      clearTimeout(timer);
      console.warn('[TimbreClient] Error synthesizing speech:', err.message);
      return null;
    }
  }
}

