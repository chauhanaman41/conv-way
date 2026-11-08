import { SearchProvider, SearchProviderOptions, SearchResponse, SearchResult } from './types';

export class ExaProvider implements SearchProvider {
  public readonly name = 'exa';
  private apiKey?: string;

  constructor(options: { apiKey?: string }) {
    this.apiKey = options.apiKey;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async search(query: string, options?: SearchProviderOptions): Promise<SearchResponse> {
    if (!this.isAvailable()) {
      throw new Error('Exa API key is missing or not configured.');
    }

    const maxResults = Math.min(options?.maxResults || 5, 10);
    const timeoutMs = options?.timeoutMs || 8000;
    const isTrustedScope = Boolean(options?.domains && options.domains.length > 0);

    const requestBody: Record<string, any> = {
      query,
      type: 'auto',
      numResults: maxResults,
      contents: {
        text: { maxCharacters: 1000 },
      },
    };

    if (isTrustedScope) {
      requestBody.includeDomains = options!.domains;
    }

    const executeFetch = async (isRetry = false): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-api-key': this.apiKey!,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timer);
        return response;
      } catch (err: any) {
        clearTimeout(timer);
        if (!isRetry && (err.name === 'AbortError' || err.message?.includes('timeout'))) {
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
      throw new Error(`Exa HTTP error ${response.status}: ${errorBody}`);
    }

    const data: any = await response.json();
    const rawResults = data.results || [];

    const results: SearchResult[] = rawResults.map((item: any) => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.text ? item.text.slice(0, 300) : '',
      content: item.text || '',
      publishedDate: item.publishedDate || undefined,
    }));

    return {
      provider: this.name,
      scope: isTrustedScope ? 'trusted' : 'open',
      creditsUsed: 1,
      results,
    };
  }
}

