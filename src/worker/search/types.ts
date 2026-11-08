export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishedDate?: string;
}

export interface SearchResponse {
  provider: string;
  scope: 'trusted' | 'open';
  creditsUsed: number;
  results: SearchResult[];
}

export interface SearchProviderOptions {
  domains?: string[];
  maxResults?: number;
  timeoutMs?: number;
}

export interface SearchProvider {
  name: string;
  search(query: string, options?: SearchProviderOptions): Promise<SearchResponse>;
}

export interface SearchConfig {
  tavilyApiKey?: string;
  exaApiKey?: string;
  webSearchApiKey?: string;
  webSearchCx?: string;
  searchOrderTrusted?: string; // default: "google_cse,tavily,exa"
  searchOrderOpen?: string;    // default: "tavily,exa"
  searchMaxPerQuestion?: number; // default: 2
  searchDailyCap?: number;     // default: 30 (counts Tavily + Exa)
  googleCseEnabled?: boolean;  // default: true
  googleCseSunset?: string;    // default: "2027-01-01"
  googleCseDailyCap?: number;  // default: 90
  searchCacheTtlDays?: number; // default: 7
}

export interface GroundedAnswerRequest {
  query: string;
  speakerClaim?: string;
  language?: string;
}

export interface GroundedAnswerResult {
  isAiLabeled: true;
  reason: string;
  answerText: string;
  wordCount: number;
  citations: Array<{
    title: string;
    url: string;
    domain: string;
  }>;
  isContradicted: boolean;
  searchScope: 'trusted' | 'open';
  provider: string;
}

