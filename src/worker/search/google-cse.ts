import { SearchProvider, SearchProviderOptions, SearchResponse, SearchResult } from './types';

export class GoogleCseDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleCseDisabledError';
  }
}

export class GoogleCseProvider implements SearchProvider {
  public readonly name = 'google_cse';
  private apiKey?: string;
  private cx?: string;
  private enabled: boolean;
  private sunsetDate: Date;
  private onDisabledCallback?: (reason: string) => Promise<void> | void;

  constructor(options: {
    apiKey?: string;
    cx?: string;
    enabled?: boolean;
    sunsetDate?: string;
    onDisabled?: (reason: string) => Promise<void> | void;
  }) {
    this.apiKey = options.apiKey;
    this.cx = options.cx;
    this.enabled = options.enabled ?? true;
    this.sunsetDate = new Date(options.sunsetDate || '2027-01-01T00:00:00Z');
    this.onDisabledCallback = options.onDisabled;
  }

  public isAvailable(): boolean {
    if (!this.enabled) return false;
    if (new Date() >= this.sunsetDate) {
      console.warn('[GoogleCseProvider] Automatically disabled: sunset date reached (2027-01-01).');
      this.enabled = false;
      return false;
    }
    if (!this.apiKey || !this.cx) return false;
    return true;
  }

  public async search(query: string, options?: SearchProviderOptions): Promise<SearchResponse> {
    if (!this.isAvailable()) {
      throw new GoogleCseDisabledError('Google CSE is disabled, sunset, or missing credentials.');
    }

    const maxResults = Math.min(options?.maxResults || 5, 10);
    const timeoutMs = options?.timeoutMs || 8000;

    const url = new URL('https://customsearch.googleapis.com/customsearch/v1');
    url.searchParams.set('key', this.apiKey!);
    url.searchParams.set('cx', this.cx!);
    url.searchParams.set('q', query);
    url.searchParams.set('num', String(maxResults));

    const executeFetch = async (isRetry = false): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timer);
        return response;
      } catch (err: any) {
        clearTimeout(timer);
        if (!isRetry && (err.name === 'AbortError' || err.message?.includes('timeout'))) {
          // Retry once on timeout
          return executeFetch(true);
        }
        throw err;
      }
    };

    let response = await executeFetch(false);

    // If 429 or 5xx, retry once
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      response = await executeFetch(true);
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        errorBody = response.statusText;
      }

      // Check for 403 / 400 access / closed to new customers error
      if (response.status === 403 || response.status === 400 || errorBody.toLowerCase().includes('not have the access') || errorBody.toLowerCase().includes('closed')) {
        this.enabled = false;
        const reason = `Google CSE access error (${response.status}): ${errorBody}`;
        console.warn(`[GoogleCseProvider] Disabling Google CSE: ${reason}`);
        if (this.onDisabledCallback) {
          try {
            await this.onDisabledCallback(reason);
          } catch (cbErr) {
            console.error('[GoogleCseProvider] Error in onDisabled callback:', cbErr);
          }
        }
        throw new GoogleCseDisabledError(reason);
      }

      throw new Error(`Google CSE HTTP error ${response.status}: ${errorBody}`);
    }

    const data: any = await response.json();
    const items = data.items || [];

    const results: SearchResult[] = items.map((item: any) => ({
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || '',
      content: item.snippet || '',
    }));

    return {
      provider: this.name,
      scope: 'trusted',
      creditsUsed: 1,
      results,
    };
  }
}

