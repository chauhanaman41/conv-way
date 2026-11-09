import { describe, it, expect } from 'vitest';
import { SearchOrchestrator } from '../../src/worker/search/orchestrator';

describe('Live Smoke Tests (Real Provider Keys)', () => {
  it.skipIf(process.env.LIVE !== '1')(
    'runs two-pass search with real Tavily & Exa keys, handling Google 403 auto-disable seamlessly',
    async () => {
      const orchestrator = new SearchOrchestrator({
        webSearchApiKey: process.env.WEB_SEARCH_API_KEY,
        webSearchCx: process.env.WEB_SEARCH_CX,
        tavilyApiKey: process.env.TAVILY_API_KEY,
        exaApiKey: process.env.EXA_API_KEY,
        searchOrderTrusted: 'google_cse,tavily,exa',
        searchOrderOpen: 'tavily,exa',
      });

      const response = await orchestrator.executeTwoPassSearch('starlink satellite orbital altitude 550 km');
      expect(response).not.toBeNull();
      expect(response!.results.length).toBeGreaterThanOrEqual(1);
      expect(['tavily', 'exa']).toContain(response!.provider);
      console.log(`Live Smoke Test Success! Resolved via provider: ${response!.provider}, scope: ${response!.scope}, results: ${response!.results.length}`);
      console.log(`First result: ${response!.results[0].title} (${response!.results[0].url})`);
    },
    35000
  );
});

