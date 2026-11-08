import { SearchProvider, SearchProviderOptions, SearchResponse, SearchResult } from './types';

export class TavilyProvider implements SearchProvider {
  public readonly name = 'tavily';
  private apiKey?: string;

  constructor(options: { apiKey?: string }) {
    this.apiKey = options.apiKey;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async search(query: string, options?: SearchProviderOptions): Promise<SearchResponse> {
    if (!this.isAvailable()) {
      throw new Error('Tavily API key is missing or not configured.');
    }

    const maxResults = Math.min(options?.maxResults || 5, 10);
    const timeoutMs = options?.timeoutMs || 8000;
    const isTrustedScope = Boolean(options?.domains && options.domains.length > 0);

    const requestBody: Record<string, any> = {
      api_key: this.apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
    };

    if (isTrustedScope) {
      requestBody.include_domains = options!.domains;
    }

    const executeFetch = async (isRetry = false): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
      throw new Error(`Tavily HTTP error ${response.status}: ${errorBody}`);
    }

    const data: any = await response.json();
    const rawResults = data.results || [];

    const results: SearchResult[] = rawResults.map((item: any) => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.content || '',
      content: item.content || '',
      publishedDate: item.published_date || undefined,
    }));

    return {
      provider: this.name,
      scope: isTrustedScope ? 'trusted' : 'open',
      creditsUsed: 1,
      results,
    };
  }
}

