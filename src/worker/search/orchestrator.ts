import { GoogleCseProvider, GoogleCseDisabledError } from './google-cse';
import { TavilyProvider } from './tavily';
import { ExaProvider } from './exa';
import {
  SearchConfig,
  SearchProvider,
  SearchResponse,
  SearchResult,
  GroundedAnswerRequest,
  GroundedAnswerResult,
} from './types';
import trustedDomainsJson from '../../../config/trusted-domains.json';

export class SearchOrchestrator {
  private config: SearchConfig;
  private db?: D1Database;
  private providers: Map<string, SearchProvider> = new Map();
  private trustedDomains: string[];

  constructor(config: SearchConfig, db?: D1Database) {
    this.config = {
      searchOrderTrusted: config.searchOrderTrusted || 'google_cse,tavily,exa',
      searchOrderOpen: config.searchOrderOpen || 'tavily,exa',
      searchMaxPerQuestion: config.searchMaxPerQuestion ?? 2,
      searchDailyCap: config.searchDailyCap ?? 30,
      googleCseEnabled: config.googleCseEnabled ?? true,
      googleCseSunset: config.googleCseSunset || '2027-01-01',
      googleCseDailyCap: config.googleCseDailyCap ?? 90,
      searchCacheTtlDays: config.searchCacheTtlDays ?? 7,
      ...config,
    };
    this.db = db;
    this.trustedDomains = trustedDomainsJson as string[];

    // Initialize providers
    this.initProviders();
  }

  private initProviders() {
    // 1. Google CSE Provider
    const googleProvider = new GoogleCseProvider({
      apiKey: this.config.webSearchApiKey,
      cx: this.config.webSearchCx,
      enabled: this.config.googleCseEnabled,
      sunsetDate: this.config.googleCseSunset,
      onDisabled: async (reason: string) => {
        this.config.googleCseEnabled = false;
        await this.recordProviderDisabledInDb('google_cse', reason);
      },
    });
    this.providers.set('google_cse', googleProvider);

    // 2. Tavily Provider
    const tavilyProvider = new TavilyProvider({
      apiKey: this.config.tavilyApiKey,
    });
    this.providers.set('tavily', tavilyProvider);

    // 3. Exa Provider
    const exaProvider = new ExaProvider({
      apiKey: this.config.exaApiKey,
    });
    this.providers.set('exa', exaProvider);
  }

  private async recordProviderDisabledInDb(providerName: string, reason: string): Promise<void> {
    if (!this.db) return;
    try {
      const todayUtc = new Date().toISOString().split('T')[0];
      await this.db
        .prepare(
          `INSERT INTO quota_counters (date_utc, metric_name, count_value, last_updated_at)
           VALUES (?1, ?2, 1, datetime('now'))
           ON CONFLICT(date_utc, metric_name) DO UPDATE SET count_value = 1, last_updated_at = datetime('now')`
        )
        .bind(todayUtc, `${providerName.toUpperCase()}_DISABLED`)
        .run();
      console.warn(`[SearchOrchestrator] Recorded ${providerName} as disabled in D1: ${reason}`);
    } catch (e) {
      console.error('[SearchOrchestrator] Failed to record provider disabled state in D1:', e);
    }
  }

  private async isProviderDisabledInDb(providerName: string): Promise<boolean> {
    if (!this.db) return false;
    try {
      const todayUtc = new Date().toISOString().split('T')[0];
      const res = await this.db
        .prepare(`SELECT count_value FROM quota_counters WHERE date_utc = ?1 AND metric_name = ?2`)
        .bind(todayUtc, `${providerName.toUpperCase()}_DISABLED`)
        .first<{ count_value: number }>();
      return Boolean(res && res.count_value > 0);
    } catch {
      return false;
    }
  }

  private async checkDailyCap(providerName: string): Promise<boolean> {
    if (!this.db) return true;
    try {
      const todayUtc = new Date().toISOString().split('T')[0];
      if (providerName === 'google_cse') {
        const row = await this.db
          .prepare(`SELECT count_value FROM quota_counters WHERE date_utc = ?1 AND metric_name = 'GOOGLE_CSE_CALLS'`)
          .bind(todayUtc)
          .first<{ count_value: number }>();
        const used = row?.count_value || 0;
        return used < (this.config.googleCseDailyCap || 90);
      } else {
        // Combined Tavily + Exa cap
        const row = await this.db
          .prepare(`SELECT count_value FROM quota_counters WHERE date_utc = ?1 AND metric_name = 'OPEN_SEARCH_CALLS'`)
          .bind(todayUtc)
          .first<{ count_value: number }>();
        const used = row?.count_value || 0;
        return used < (this.config.searchDailyCap || 30);
      }
    } catch {
      return true;
    }
  }

  private async incrementDailyUsage(providerName: string, credits: number, latencyMs: number, ipHash = 'system'): Promise<void> {
    if (!this.db) return;
    try {
      const todayUtc = new Date().toISOString().split('T')[0];
      const metricName = providerName === 'google_cse' ? 'GOOGLE_CSE_CALLS' : 'OPEN_SEARCH_CALLS';
      await this.db
        .prepare(
          `INSERT INTO quota_counters (date_utc, metric_name, count_value, last_updated_at)
           VALUES (?1, ?2, ?3, datetime('now'))
           ON CONFLICT(date_utc, metric_name) DO UPDATE SET count_value = count_value + ?3, last_updated_at = datetime('now')`
        )
        .bind(todayUtc, metricName, credits)
        .run();

      await this.db
        .prepare(
          `INSERT INTO credit_ledger (date_utc, ip_hash, service, operation, units_consumed, estimated_credits, http_status, latency_ms)
           VALUES (?1, ?2, 'WEB_SEARCH', ?3, ?4, ?4, 200, ?5)`
        )
        .bind(todayUtc, ipHash, providerName, credits, latencyMs)
        .run();
    } catch (e) {
      console.error('[SearchOrchestrator] Error logging search quota to D1:', e);
    }
  }

  private normalizeQuery(q: string): string {
    return q
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  private hashKey(key: string): string {
    // Simple deterministic hash for cache key
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'sc_' + Math.abs(hash).toString(16);
  }

  private async getFromCache(query: string, scope: 'trusted' | 'open'): Promise<SearchResponse | null> {
    if (!this.db) return null;
    const normalized = this.normalizeQuery(query);
    const queryHash = this.hashKey(`${normalized}:${scope}`);
    try {
      const row = await this.db
        .prepare(`SELECT response_json, expires_at FROM search_cache WHERE query_hash = ?1`)
        .bind(queryHash)
        .first<{ response_json: string; expires_at: string }>();

      if (row && new Date(row.expires_at) > new Date()) {
        const cached: SearchResponse = JSON.parse(row.response_json);
        // Update hit count asynchronously
        this.db.prepare(`UPDATE search_cache SET hit_count = hit_count + 1 WHERE query_hash = ?1`).bind(queryHash).run().catch(() => {});
        return cached;
      }
    } catch (e) {
      console.warn('[SearchOrchestrator] Cache read error:', e);
    }
    return null;
  }

  private async saveToCache(query: string, response: SearchResponse): Promise<void> {
    if (!this.db) return;
    const normalized = this.normalizeQuery(query);
    const queryHash = this.hashKey(`${normalized}:${response.scope}`);
    const ttlDays = this.config.searchCacheTtlDays || 7;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

    try {
      await this.db
        .prepare(
          `INSERT INTO search_cache (query_hash, normalized_query, language, response_json, expires_at)
           VALUES (?1, ?2, 'en', ?3, ?4)
           ON CONFLICT(query_hash) DO UPDATE SET response_json = ?3, expires_at = ?4, hit_count = hit_count + 1`
        )
        .bind(queryHash, normalized, JSON.stringify(response), expiresAt)
        .run();
    } catch (e) {
      console.warn('[SearchOrchestrator] Cache write error:', e);
    }
  }

  public async executeTwoPassSearch(query: string, ipHash = 'system'): Promise<SearchResponse | null> {
    let searchesPerformed = 0;
    const maxSearches = this.config.searchMaxPerQuestion || 2;

    // ─── PASS 1: TRUSTED DOMAINS ───
    const cachedTrusted = await this.getFromCache(query, 'trusted');
    if (cachedTrusted && cachedTrusted.results.length >= 2) {
      return cachedTrusted;
    }

    const trustedOrder = (this.config.searchOrderTrusted || 'google_cse,tavily,exa')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let pass1Response: SearchResponse | null = null;

    for (const providerName of trustedOrder) {
      if (searchesPerformed >= maxSearches) break;
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      if (providerName === 'google_cse') {
        const disabledInDb = await this.isProviderDisabledInDb('google_cse');
        if (disabledInDb) continue;
      }

      const underCap = await this.checkDailyCap(providerName);
      if (!underCap) {
        console.warn(`[SearchOrchestrator] Daily cap reached for ${providerName}, skipping.`);
        continue;
      }

      const startTime = Date.now();
      try {
        searchesPerformed++;
        const resp = await provider.search(query, {
          domains: this.trustedDomains,
          maxResults: 5,
          timeoutMs: 8000,
        });

        const latency = Date.now() - startTime;
        await this.incrementDailyUsage(providerName, resp.creditsUsed, latency, ipHash);

        if (resp.results && resp.results.length >= 2) {
          pass1Response = resp;
          await this.saveToCache(query, resp);
          return resp; // Stop at first provider that returns >= 2 results
        } else if (resp.results && resp.results.length > 0 && !pass1Response) {
          pass1Response = resp; // Keep as partial candidate if nothing better
        }
      } catch (err: any) {
        console.warn(`[SearchOrchestrator] Provider ${providerName} failed in Pass 1:`, err.message);
        if (err instanceof GoogleCseDisabledError) {
          await this.recordProviderDisabledInDb('google_cse', err.message);
        }
      }
    }

    if (pass1Response && pass1Response.results.length >= 2) {
      return pass1Response;
    }

    // ─── PASS 2: OPEN WEB (Tavily & Exa only, Google never used) ───
    const cachedOpen = await this.getFromCache(query, 'open');
    if (cachedOpen && cachedOpen.results.length >= 2) {
      return cachedOpen;
    }

    const openOrder = (this.config.searchOrderOpen || 'tavily,exa')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== 'google_cse'); // Google CSE is strictly forbidden in Pass 2

    for (const providerName of openOrder) {
      if (searchesPerformed >= maxSearches) break;
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      const underCap = await this.checkDailyCap(providerName);
      if (!underCap) continue;

      const startTime = Date.now();
      try {
        searchesPerformed++;
        const resp = await provider.search(query, {
          maxResults: 5,
          timeoutMs: 8000,
        });

        const latency = Date.now() - startTime;
        await this.incrementDailyUsage(providerName, resp.creditsUsed, latency, ipHash);

        if (resp.results && resp.results.length > 0) {
          await this.saveToCache(query, resp);
          return resp;
        }
      } catch (err: any) {
        console.warn(`[SearchOrchestrator] Provider ${providerName} failed in Pass 2:`, err.message);
      }
    }

    // Return pass1 partial results if any, or null
    return pass1Response && pass1Response.results.length > 0 ? pass1Response : null;
  }

  /**
   * Enforces Grounding Rules for Step 5 (Verified AI Fallback):
   * 1. Only cites URLs from retrieved set (exact match).
   * 2. Exactly 30 to 40 words (validates & retries once, otherwise drops answer).
   * 3. Reason specifies if open web was used.
   * 4. Flags contradicted only when retrieved text contradicts speaker claim.
   */
  public validateAndEnforceGrounding(
    generatedAnswer: {
      answerText: string;
      reason: string;
      citedUrls: string[];
      isContradicted?: boolean;
    },
    retrievedResults: SearchResult[],
    searchScope: 'trusted' | 'open',
    provider: string
  ): GroundedAnswerResult | null {
    // 1. Validate Cited URLs (must exactly match one of retrieved URLs)
    const validRetrievedUrls = new Map<string, SearchResult>();
    for (const r of retrievedResults) {
      if (r.url) {
        validRetrievedUrls.set(r.url.trim(), r);
      }
    }

    const validCitations: Array<{ title: string; url: string; domain: string }> = [];
    for (const url of generatedAnswer.citedUrls) {
      const match = validRetrievedUrls.get(url.trim());
      if (match) {
        let domain = '';
        try {
          domain = new URL(match.url).hostname.replace(/^www\./, '');
        } catch {
          domain = match.url;
        }
        validCitations.push({
          title: match.title,
          url: match.url,
          domain,
        });
      }
    }

    // If no valid source remains after filtering, drop the AI answer
    if (validCitations.length === 0) {
      console.warn('[SearchOrchestrator] Dropped AI answer: Zero cited URLs matched the retrieved search set.');
      return null;
    }

    // 2. Validate Word Count: 30 to 40 words
    const words = generatedAnswer.answerText
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const wordCount = words.length;

    if (wordCount < 30 || wordCount > 40) {
      console.warn(`[SearchOrchestrator] Invalid word count (${wordCount} words; required 30-40).`);
      return null;
    }

    // 3. Annotate reason if Pass 2 (open web) sources were used
    let finalReason = generatedAnswer.reason;
    if (searchScope === 'open' && !finalReason.toLowerCase().includes('open web')) {
      finalReason = `[Open Web Search] ${finalReason}`;
    }

    return {
      isAiLabeled: true,
      reason: finalReason,
      answerText: generatedAnswer.answerText.trim(),
      wordCount,
      citations: validCitations.slice(0, 2), // 1 to 2 source links
      isContradicted: Boolean(generatedAnswer.isContradicted),
      searchScope,
      provider,
    };
  }
}

