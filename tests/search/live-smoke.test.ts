import { describe, it, expect } from 'vitest';
import { SearchOrchestrator } from '../../src/worker/search/orchestrator';

describe('Live Smoke Tests (Real Provider Keys)', () => {
  it('runs two-pass search with real Tavily & Exa keys, handling Google 403 auto-disable seamlessly', async () => {
    const orchestrator = new SearchOrchestrator({
      webSearchApiKey: 'AIzaSyAq1sJWGZ-ToVgT19CvNAAbY9TqG0LNooo',
      webSearchCx: '819f7245209624657',
      tavilyApiKey: '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',
      exaApiKey: 'a304e790-494e-4322-a13c-2a07928d44f0',
      searchOrderTrusted: 'google_cse,tavily,exa',
      searchOrderOpen: 'tavily,exa',
    });

    const response = await orchestrator.executeTwoPassSearch('starlink satellite orbital altitude 550 km');
    expect(response).not.toBeNull();
    expect(response!.results.length).toBeGreaterThanOrEqual(1);
    expect(['tavily', 'exa']).toContain(response!.provider);
    console.log(`Live Smoke Test Success! Resolved via provider: ${response!.provider}, scope: ${response!.scope}, results: ${response!.results.length}`);
    console.log(`First result: ${response!.results[0].title} (${response!.results[0].url})`);
  }, 20000);
});

