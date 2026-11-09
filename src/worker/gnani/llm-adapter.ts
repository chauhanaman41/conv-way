import { SpeechWindow } from '../transcript/types';
import { SearchResult } from '../search/types';
import { EvonWayPrediction, EvonRerankResult, EvonFallbackResult } from './types';
import { EvonClient } from './evon';

export interface LlmHealthStatus {
  provider: string;
  isAvailable: boolean;
  status: 'ONLINE' | 'DISABLED' | 'SCOPE_RESTRICTED' | 'FAILED';
  lastError?: string;
  verifiedEndpoint: boolean;
  modelId?: string;
  neuronUsageToday?: number;
}

export interface ILanguageModelProvider {
  readonly name: string;
  isAvailable(): boolean;
  getHealth(): Promise<LlmHealthStatus>;
  predictWayQuestions?(window: SpeechWindow, videoDurationSec?: number): Promise<EvonWayPrediction | null>;
  rerankAndExtractBoundaries?(question: string, windows: SpeechWindow[]): Promise<EvonRerankResult | null>;
  generateCitedFallback?(question: string, searchResults: SearchResult[], speakerClaim?: string): Promise<EvonFallbackResult | null>;
}

export class EvonLlmProvider implements ILanguageModelProvider {
  public readonly name = 'evon';
  private client: EvonClient;
  private verified: boolean = false;
  private lastError?: string;

  constructor(apiKey?: string, endpointUrl?: string) {
    this.client = new EvonClient({ apiKey, evonEndpointUrl: endpointUrl });
  }

  public isAvailable(): boolean {
    return this.client.isAvailable();
  }

  public async getHealth(): Promise<LlmHealthStatus> {
    if (!this.isAvailable()) {
      return {
        provider: this.name,
        isAvailable: false,
        status: 'DISABLED',
        lastError: 'Missing GNANI_API_KEY',
        verifiedEndpoint: false,
      };
    }

    if (this.lastError && this.lastError.includes('403')) {
      return {
        provider: this.name,
        isAvailable: false,
        status: 'SCOPE_RESTRICTED',
        lastError: this.lastError,
        verifiedEndpoint: false,
      };
    }

    return {
      provider: this.name,
      isAvailable: true,
      status: this.verified ? 'ONLINE' : 'SCOPE_RESTRICTED',
      lastError: this.lastError || 'Evon endpoint unverified / scope not enabled',
      verifiedEndpoint: this.verified,
    };
  }

  public async predictWayQuestions(window: SpeechWindow, videoDurationSec?: number): Promise<EvonWayPrediction | null> {
    try {
      const res = await this.client.predictWayQuestions(window, videoDurationSec);
      this.verified = true;
      return res;
    } catch (err: any) {
      this.lastError = err.message || String(err);
      return null;
    }
  }

  public async rerankAndExtractBoundaries(question: string, windows: SpeechWindow[]): Promise<EvonRerankResult | null> {
    try {
      const res = await this.client.rerankAndExtractBoundaries(question, windows);
      this.verified = true;
      return res;
    } catch (err: any) {
      this.lastError = err.message || String(err);
      return null;
    }
  }

  public async generateCitedFallback(
    question: string,
    searchResults: SearchResult[],
    speakerClaim?: string
  ): Promise<EvonFallbackResult | null> {
    try {
      const res = await this.client.generateCitedFallback(question, searchResults, speakerClaim);
      if (res) this.verified = true;
      return res;
    } catch (err: any) {
      this.lastError = err.message || String(err);
      return null;
    }
  }
}

export class WorkersAiProvider implements ILanguageModelProvider {
  public readonly name = 'workers_ai';
  private aiBinding?: any;
  private model: string;
  private verified: boolean = false;
  private lastError?: string;
  private neuronUsageToday: number = 0;

  constructor(aiBinding?: any, model = '@cf/meta/llama-3.2-3b-instruct') {
    this.aiBinding = aiBinding;
    this.model = model;
  }

  public isAvailable(): boolean {
    return !!this.aiBinding;
  }

  public async getHealth(): Promise<LlmHealthStatus> {
    if (!this.aiBinding) {
      return {
        provider: this.name,
        isAvailable: false,
        status: 'DISABLED',
        lastError: 'Missing env.AI binding in Worker environment',
        verifiedEndpoint: false,
        modelId: this.model,
        neuronUsageToday: this.neuronUsageToday,
      };
    }
    return {
      provider: this.name,
      isAvailable: true,
      status: this.lastError ? 'FAILED' : 'ONLINE',
      lastError: this.lastError,
      verifiedEndpoint: this.verified,
      modelId: this.model,
      neuronUsageToday: this.neuronUsageToday,
    };
  }

  public async predictWayQuestions(window: SpeechWindow, videoDurationSec?: number): Promise<EvonWayPrediction | null> {
    if (!this.aiBinding) return null;

    const candidateModels = [
      this.model,
      '@cf/meta/llama-3.2-3b-instruct',
      '@cf/meta/llama-3.2-1b-instruct',
    ];

    const prompt = `You are an editorial assistant for interactive podcast exploration.
Given the following spoken transcript segment (from ${Math.floor(window.startSec)}s to ${Math.floor(window.endSec)}s), which may be in any language (e.g. Hindi, English, Punjabi), understand the core topics, translate the concepts into English if the speech is non-English, and generate 3 to 5 clear, intriguing questions in English that a viewer would ask to navigate into this segment.
Rules:
1. Every question MUST be written in English.
2. Under 110 characters per question.
3. Must end with '?'.
4. Do NOT use ellipsis ('...').
5. Respond strictly with a JSON array of objects: [{"questionText": "...", "triggerSec": number, "answerStartSec": number, "answerEndSec": number}]

Transcript:
"${window.plainText.slice(0, 1500)}"`;

    for (const modelToTry of candidateModels) {
      try {
        const response: any = await this.aiBinding.run(modelToTry, {
          messages: [
            { role: 'system', content: 'You are an AI assistant that only responds with a JSON array.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 512,
        });

        this.verified = true;
        this.model = modelToTry;
        this.neuronUsageToday += 5;
        this.lastError = undefined;

        const text = response?.response || response?.text || (typeof response === 'string' ? response : '');
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return {
              questions: parsed.map((item: any) => ({
                questionText: String(item.questionText || ''),
                triggerSec: typeof item.triggerSec === 'number' ? item.triggerSec : window.startSec,
                answerStartSec: typeof item.answerStartSec === 'number' ? item.answerStartSec : window.startSec,
                answerEndSec: typeof item.answerEndSec === 'number' ? item.answerEndSec : Math.min(window.endSec, (item.answerStartSec || window.startSec) + 60),
                confidenceScore: 0.95,
              })),
            };
          }
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        this.lastError = errMsg;
        console.warn(`[WorkersAiProvider] Model ${modelToTry} error:`, errMsg);
        // Only retry next candidate if model was deprecated/unsupported
        if (!errMsg.includes('5028') && !errMsg.includes('deprecated') && !errMsg.includes('not found')) {
          break;
        }
      }
    }
    return null;
  }

  public async generateCitedFallback(
    question: string,
    searchResults: SearchResult[],
    speakerClaim?: string
  ): Promise<EvonFallbackResult | null> {
    if (!this.aiBinding) return null;
    const prompt = `You are a concise grounded factual assistant. Answer the user question strictly using only the provided search results.
Rules:
- The answer must be strictly between 30 and 40 words.
- Must end on a clean sentence boundary (with a period).
- Cite sources using [1], [2] corresponding to the search results.
- No speculation or outside knowledge.

Question: ${question}
Search results:
${searchResults.slice(0, 3).map((r, i) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n')}`;

    try {
      const response: any = await this.aiBinding.run(this.model, {
        messages: [
          { role: 'system', content: 'Answer factually and concisely between 30 and 40 words, ending on a period.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 128,
      });

      this.verified = true;
      this.neuronUsageToday += 3;
      this.lastError = undefined;

      const text = response?.response || response?.text || (typeof response === 'string' ? response : '');
      if (text) {
        let cleanAnswer = text.trim().replace(/^"(.*)"$/, '$1');
        if (!/[.!?]$/.test(cleanAnswer)) {
          cleanAnswer += '.';
        }
        return {
          answerText: cleanAnswer,
          reason: 'Generated via Workers AI grounded fallback synthesis',
          citedUrls: searchResults.slice(0, 2).map((r) => r.url),
          isContradicted: false,
        };
      }
    } catch (err: any) {
      this.lastError = err.message || String(err);
      console.warn('[WorkersAiProvider] generateCitedFallback error:', this.lastError);
    }
    return null;
  }
}

export class LlmAdapterManager {
  private providers: ILanguageModelProvider[] = [];

  constructor(
    gnaniApiKeyOrEnv?: string | any,
    workersAiEnabled = true,
    aiBinding?: any,
    model = '@cf/meta/llama-3.2-3b-instruct',
    providerOrder = 'workers_ai,evon'
  ) {
    const isEnvObj = typeof gnaniApiKeyOrEnv === 'object' && gnaniApiKeyOrEnv !== null;
    const gnaniKey = typeof gnaniApiKeyOrEnv === 'string' ? gnaniApiKeyOrEnv : gnaniApiKeyOrEnv?.GNANI_API_KEY;
    const ai = isEnvObj ? gnaniApiKeyOrEnv?.AI || aiBinding : aiBinding;
    const isAiEnabled = isEnvObj ? gnaniApiKeyOrEnv?.LLM_WORKERS_AI_ENABLED !== 'false' : workersAiEnabled;
    const orderStr = isEnvObj ? (gnaniApiKeyOrEnv?.LLM_PROVIDER_ORDER || providerOrder) : providerOrder;
    const modelId = isEnvObj ? (gnaniApiKeyOrEnv?.WORKERS_AI_MODEL || model) : model;

    const orderList = orderStr.split(',').map((s: string) => s.trim().toLowerCase());
    for (const name of orderList) {
      if (name === 'workers_ai') {
        if (isAiEnabled) {
          this.providers.push(new WorkersAiProvider(ai, modelId));
        }
      } else if (name === 'evon') {
        this.providers.push(new EvonLlmProvider(gnaniKey));
      }
    }
    if (this.providers.length === 0 && isAiEnabled) {
      this.providers.push(new WorkersAiProvider(ai, modelId));
    }
  }

  public async getActiveProvider(): Promise<ILanguageModelProvider | null> {
    for (const p of this.providers) {
      if (p.isAvailable()) {
        return p;
      }
    }
    return null;
  }

  public async getHealth(): Promise<LlmHealthStatus> {
    for (const p of this.providers) {
      if (p.isAvailable()) {
        return await p.getHealth();
      }
    }
    const first = this.providers[0];
    if (first) return await first.getHealth();
    return {
      provider: 'none',
      isAvailable: false,
      status: 'DISABLED',
      lastError: 'LLM_WORKERS_AI_ENABLED is disabled or no provider available',
      verifiedEndpoint: false,
    };
  }
}
