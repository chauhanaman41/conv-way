import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchOrchestrator } from '../../src/worker/search/orchestrator';
import { GoogleCseProvider, GoogleCseDisabledError } from '../../src/worker/search/google-cse';
import { TavilyProvider } from '../../src/worker/search/tavily';
import { ExaProvider } from '../../src/worker/search/exa';
import { SearchResult } from '../../src/worker/search/types';

describe('Search Layer Unit Tests (Step 10)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GoogleCseProvider', () => {
    it('disables automatically on or after sunset date (2027-01-01)', () => {
      const provider = new GoogleCseProvider({
        apiKey: 'test-key',
        cx: 'test-cx',
        enabled: true,
        sunsetDate: '2025-01-01', // Date in the past
      });

      expect(provider.isAvailable()).toBe(false);
    });

    it('remains available prior to sunset date when credentials are provided', () => {
      const provider = new GoogleCseProvider({
        apiKey: 'test-key',
        cx: 'test-cx',
        enabled: true,
        sunsetDate: '2028-01-01',
      });

      expect(provider.isAvailable()).toBe(true);
    });

    it('auto-disables on HTTP 403 (closed to new customers / no access) and calls callback', async () => {
      let disabledReason = '';
      const provider = new GoogleCseProvider({
        apiKey: 'test-key',
        cx: 'test-cx',
        enabled: true,
        sunsetDate: '2028-01-01',
        onDisabled: (reason) => {
          disabledReason = reason;
        },
      });

      // Mock fetch returning 403
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'This project does not have the access to Custom Search JSON API.' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(provider.search('test query')).rejects.toThrow(GoogleCseDisabledError);
      expect(provider.isAvailable()).toBe(false);
      expect(disabledReason).toContain('403');
    });

    it('maps successful results correctly with trusted scope', async () => {
      const provider = new GoogleCseProvider({
        apiKey: 'test-key',
        cx: 'test-cx',
        enabled: true,
        sunsetDate: '2028-01-01',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              { title: 'Starlink Wiki', link: 'https://en.wikipedia.org/wiki/Starlink', snippet: 'Starlink is a satellite constellation.' },
              { title: 'Starlink Official', link: 'https://starlink.com', snippet: 'High-speed internet anywhere.' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const resp = await provider.search('starlink');
      expect(resp.provider).toBe('google_cse');
      expect(resp.scope).toBe('trusted');
      expect(resp.results).toHaveLength(2);
      expect(resp.results[0].url).toBe('https://en.wikipedia.org/wiki/Starlink');
    });
  });

  describe('TavilyProvider', () => {
    it('sends include_domains when provided for trusted scope', async () => {
      const provider = new TavilyProvider({ apiKey: 'tvly-test' });

      let capturedBody: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            results: [
              { title: 'Test 1', url: 'https://starlink.com/spec', content: 'Specs here' },
              { title: 'Test 2', url: 'https://wikipedia.org/wiki/Starlink', content: 'Wiki info' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const resp = await provider.search('starlink orbits', { domains: ['starlink.com', 'wikipedia.org'] });
      expect(resp.scope).toBe('trusted');
      expect(capturedBody.include_domains).toEqual(['starlink.com', 'wikipedia.org']);
      expect(resp.results).toHaveLength(2);
    });

    it('omits include_domains when searching open web scope', async () => {
      const provider = new TavilyProvider({ apiKey: 'tvly-test' });

      let capturedBody: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            results: [{ title: 'Open Result', url: 'https://anynews.com/article', content: 'News content' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const resp = await provider.search('global broadband news');
      expect(resp.scope).toBe('open');
      expect(capturedBody.include_domains).toBeUndefined();
      expect(resp.results).toHaveLength(1);
    });
  });

  describe('ExaProvider', () => {
    it('sends includeDomains (camelCase) and x-api-key header', async () => {
      const provider = new ExaProvider({ apiKey: 'exa-key-123' });

      let capturedHeaders: any = null;
      let capturedBody: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
        capturedHeaders = init?.headers;
        capturedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({
            results: [
              { id: '1', title: 'Exa Result 1', url: 'https://spacex.com/launches', text: 'Launch manifest' },
              { id: '2', title: 'Exa Result 2', url: 'https://nasa.gov/mission', text: 'NASA mission' },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const resp = await provider.search('spacex starship', { domains: ['spacex.com'] });
      expect(resp.scope).toBe('trusted');
      expect(capturedHeaders['x-api-key']).toBe('exa-key-123');
      expect(capturedBody.includeDomains).toEqual(['spacex.com']);
      expect(resp.results).toHaveLength(2);
    });
  });

  describe('SearchOrchestrator Two-Pass & Fallback Flow', () => {
    it('Pass 1: Stops at the first provider that returns at least 2 results', async () => {
      const orchestrator = new SearchOrchestrator({
        webSearchApiKey: 'g-key',
        webSearchCx: 'g-cx',
        tavilyApiKey: 'tvly-key',
        exaApiKey: 'exa-key',
        searchOrderTrusted: 'google_cse,tavily,exa',
      });

      // Mock Google CSE failing with 403
      // Mock Tavily returning 2 results
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: '403 Forbidden' } }), { status: 403 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              results: [
                { title: 'Tavily 1', url: 'https://starlink.com/specs', content: 'Starlink specs' },
                { title: 'Tavily 2', url: 'https://en.wikipedia.org/wiki/Starlink', content: 'Wikipedia Starlink' },
              ],
            }),
            { status: 200 }
          )
        );

      const resp = await orchestrator.executeTwoPassSearch('starlink pricing');
      expect(resp).not.toBeNull();
      expect(resp!.provider).toBe('tavily');
      expect(resp!.scope).toBe('trusted');
      expect(resp!.results).toHaveLength(2);
    });

    it('Pass 2: Falls back to open web if Pass 1 returns fewer than 2 results (Google never used in Pass 2)', async () => {
      const orchestrator = new SearchOrchestrator({
        webSearchApiKey: 'g-key',
        webSearchCx: 'g-cx',
        tavilyApiKey: 'tvly-key',
        exaApiKey: 'exa-key',
        searchOrderTrusted: 'google_cse,tavily',
        searchOrderOpen: 'exa',
        searchMaxPerQuestion: 3,
      });

      // Pass 1: Google fails, Tavily returns 0 results
      // Pass 2: Exa called with open web (no domains) and returns 2 results
      let exaCallBody: any = null;
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: '403' } }), { status: 403 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
        .mockImplementationOnce(async (_url, init) => {
          exaCallBody = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              results: [{ id: '1', title: 'Open Web Hit', url: 'https://techblog.com/starlink', text: 'Tech blog article' }],
            }),
            { status: 200 }
          );
        });

      const resp = await orchestrator.executeTwoPassSearch('obscure query');
      expect(resp).not.toBeNull();
      expect(resp!.provider).toBe('exa');
      expect(resp!.scope).toBe('open');
      expect(exaCallBody.includeDomains).toBeUndefined(); // Verified open web
    });

    it('Respects SEARCH_MAX_PER_QUESTION limit (default 2)', async () => {
      const orchestrator = new SearchOrchestrator({
        webSearchApiKey: 'g-key',
        webSearchCx: 'g-cx',
        tavilyApiKey: 'tvly-key',
        exaApiKey: 'exa-key',
        searchOrderTrusted: 'google_cse,tavily,exa',
        searchMaxPerQuestion: 2, // Max 2 calls
      });

      let fetchCallCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        fetchCallCount++;
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      });

      await orchestrator.executeTwoPassSearch('test query');
      expect(fetchCallCount).toBe(2); // Stopped at max 2
    });
  });

  describe('Grounding Rules Enforcement (Step 7)', () => {
    const orchestrator = new SearchOrchestrator({});
    const sampleRetrieved: SearchResult[] = [
      {
        title: 'Starlink Specifications',
        url: 'https://www.starlink.com/specifications',
        snippet: 'Residential hardware pricing is $349 globally.',
      },
      {
        title: 'Department of Telecommunications',
        url: 'https://dot.gov.in/spectrum',
        snippet: 'Satellite regulatory spectrum licensing updates in India.',
      },
    ];

    it('accepts valid 30-40 word answer with exact matching citations', () => {
      const answer34Words =
        "Starlink standard residential kits retail for approximately 349 US dollars internationally; Indian market pricing remains unannounced pending official Department of Telecommunications spectrum frequency assignments, satellite gateway authorizations, and final regulatory clearance from the government.";

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: answer34Words,
          reason: 'The active video does not mention current commercial Starlink residential pricing in India.',
          citedUrls: ['https://www.starlink.com/specifications'],
        },
        sampleRetrieved,
        'trusted',
        'tavily'
      );

      expect(result).not.toBeNull();
      expect(result!.isAiLabeled).toBe(true);
      expect(result!.wordCount).toBe(34);
      expect(result!.citations).toHaveLength(1);
      expect(result!.citations[0].domain).toBe('starlink.com');
      expect(result!.searchScope).toBe('trusted');
    });

    it('drops hallucinated cited URLs and returns null if no valid citation remains', () => {
      const answer32Words =
        "Starlink standard residential kits retail for approximately 349 US dollars internationally; Indian market pricing remains unannounced pending official Department of Telecommunications spectrum frequency assignments and final clearance.";

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: answer32Words,
          reason: 'No pricing mentioned in podcast.',
          citedUrls: ['https://fake-hallucinated-site.com/starlink-pricing'], // Hallucinated URL not in retrieved set!
        },
        sampleRetrieved,
        'trusted',
        'tavily'
      );

      expect(result).toBeNull(); // Dropped because cited URL was not in retrieved set
    });

    it('rejects answers outside 30 to 40 words', () => {
      const shortAnswer23Words =
        "Starlink standard residential kit is priced around $349 USD globally, though Indian pricing awaits final regulatory spectrum allocation and gateway licensing.";

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: shortAnswer23Words, // 23 words
          reason: 'Pricing omitted in video.',
          citedUrls: ['https://www.starlink.com/specifications'],
        },
        sampleRetrieved,
        'trusted',
        'tavily'
      );

      expect(result).toBeNull(); // Dropped due to word count < 30
    });

    it('adds [Open Web Search] annotation to reason when Pass 2 open web sources are used', () => {
      const answer32Words =
        "Starlink standard residential kits retail for approximately 349 US dollars internationally; Indian market commercial pricing remains unannounced pending official Department of Telecommunications spectrum frequency assignments, satellite gateway authorizations, and final regulatory clearance.";

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: answer32Words,
          reason: 'No video segment states current residential pricing.',
          citedUrls: ['https://www.starlink.com/specifications'],
        },
        sampleRetrieved,
        'open', // Pass 2 Open Scope
        'exa'
      );

      expect(result).not.toBeNull();
      expect(result!.reason).toContain('[Open Web Search]');
    });
  });
});
