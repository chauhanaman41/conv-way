import { SpeechWindow, WindowCueCompact } from '../transcript/types';
import { ILanguageModelProvider } from '../gnani/llm-adapter';

export interface GeneratedWayQuestion {
  questionText: string;
  triggerSec: number;
  answerStartSec: number;
  answerEndSec: number;
  confidenceScore: number;
  tier: 'TIER_A_MODEL' | 'TIER_B_KEYPHRASE' | 'TIER_C_UNAVAILABLE';
}

export interface WayGenerationResult {
  questions: GeneratedWayQuestion[];
  tier: 'TIER_A_MODEL' | 'TIER_B_KEYPHRASE' | 'TIER_C_UNAVAILABLE';
  reason?: string;
  modelId?: string;
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
  'in', 'with', 'to', 'for', 'of', 'about', 'what', 'why', 'how', 'when',
  'where', 'who', 'does', 'can', 'could', 'would', 'should', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'did', 'doing',
  'tell', 'me', 'explain', 'show', 'like', 'just', 'that', 'this', 'there',
  'then', 'so', 'it', 'its', 'he', 'she', 'they', 'them', 'their', 'we',
  'us', 'our', 'you', 'your', 'i', 'my', 'yeah', 'yes', 'no', 'oh', 'okay',
  'well', 'actually', 'mean', 'gonna', 'wanna', 'got', 'think', 'know',
  'theres', 'heres', 'thats', 'whats', 'some', 'any', 'from', 'than',
  'although', 'though', 'because', 'unless', 'while', 'since', 'until',
  'whether', 'after', 'before'
]);

const DISALLOWED_FRAGMENT_WORDS = new Set([
  'theres', 'there', 'here', 'heres', 'thats', 'whats', 'whos', 'hows', 'where',
  'some', 'any', 'point', 'increasing', 'essentially', 'major', 'certainly',
  'definitely', 'probably', 'maybe', 'perhaps', 'actually', 'mean', 'gonna',
  'wanna', 'got', 'think', 'know', 'feel', 'like', 'just', 'well', 'sure',
  'kind', 'sort', 'lot', 'many', 'much', 'little', 'bit', 'part', 'thing',
  'things', 'stuff', 'way', 'ways', 'someone', 'something', 'anything',
  'nothing', 'everything', 'amount', 'amounts', 'percentage', 'percent',
  'number', 'numbers', 'time', 'times', 'today', 'talk', 'talking',
  'start', 'starting', 'take', 'taking', 'done', 'doing', 'learn', 'learning',
  'try', 'trying', 'hope', 'hoping', 'coffee', 'conversation', 'okay',
  'blush', 'oneaday', 'really', 'seriously', 'than', 'although', 'muscular', 'bulkier',
  'uh', 'um', 'guess', 'fine', 'cappuccino', 'stop', 'youre', 'theyre', 'im',
  'making', 'small', 'big', 'good', 'bad', 'cant', 'wont', 'dont', 'didnt',
  'isnt', 'arent', 'hasnt', 'havent', 'hadnt'
]);

export function cleanCueText(text: string): string {
  return text
    .replace(/\[.*?\]/g, '') // [music], [laughter]
    .replace(/\(.*?\)/g, '') // (applause)
    .replace(/^>>\s*/g, '')
    .replace(/\s+>>\s+/g, ' ')
    .replace(/^[A-Za-z0-9\s_-]{1,20}:\s*/, '') // Speaker labels e.g. "Elon:"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates a single Way question according to strict owner rules:
 * - At most 110 characters
 * - Ends with '?'
 * - No timestamps
 * - No ellipsis ('...' or '…')
 * - No duplicate (case-insensitive)
 * - Valid answer range inside the transcript window
 */
export function validateWayQuestion(
  q: { questionText: string; triggerSec?: number; answerStartSec?: number; answerEndSec?: number } | string,
  windowStartSec?: number,
  windowEndSec?: number,
  seenQuestions?: Set<string>
): boolean {
  if (!q) return false;
  const text = typeof q === 'string' ? q.trim() : q.questionText?.trim();
  if (!text) return false;

  // Max 110 characters
  if (text.length < 5 || text.length > 110) return false;

  // Ends with "?"
  if (!text.endsWith('?')) return false;

  // No ellipsis
  if (text.includes('...') || text.includes('…')) return false;

  // No timestamps (e.g. 110:57, 12:30, or 25s, 40 sec)
  if (/\b\d{1,4}:\d{2}\b/.test(text) || /\b\d+\s*(?:s|sec|seconds|min|minutes|hr|hrs|hours)\b/i.test(text)) {
    return false;
  }

  // No duplicate (case-insensitive)
  const lower = text.toLowerCase();
  if (seenQuestions) {
    if (seenQuestions.has(lower)) return false;
    seenQuestions.add(lower);
  }

  // No more than 4 consecutive non-Latin words (must be predominantly English)
  const words = text.replace(/[^\w\s\u0900-\u0D7F]/g, '').split(/\s+/).filter(Boolean);
  let nonLatinCount = 0;
  for (const w of words) {
    if (/[\u0900-\u0D7F]/.test(w)) {
      nonLatinCount++;
      if (nonLatinCount > 4) return false;
    } else {
      nonLatinCount = 0;
    }
  }

  // Valid timestamps if object passed
  if (typeof q === 'object') {
    if (typeof q.triggerSec === 'number' && isNaN(q.triggerSec)) return false;
    if (typeof q.answerStartSec === 'number' && typeof q.answerEndSec === 'number') {
      if (isNaN(q.answerStartSec) || isNaN(q.answerEndSec)) return false;
      if (q.answerEndSec <= q.answerStartSec) return false;
      if (typeof windowStartSec === 'number' && q.answerStartSec < windowStartSec - 10) return false;
      if (typeof windowEndSec === 'number' && q.answerEndSec > windowEndSec + 10) return false;
    }
  }

  return true;
}

/**
 * Tier B: Keyphrase extraction without any language model
 * Strips filler cues, picks distinct 2-4 word noun-like phrases,
 * outputs "What do they say about <phrase>?"
 */
export function generateTierBKeyphraseQuestions(
  window: SpeechWindow,
  cues?: WindowCueCompact[],
  maxQuestions = 5
): GeneratedWayQuestion[] {
  let effectiveCues: WindowCueCompact[] = cues || [];
  if (effectiveCues.length === 0 && window.cuesJson) {
    try {
      effectiveCues = JSON.parse(window.cuesJson);
    } catch {
      effectiveCues = [];
    }
  }
  if (!effectiveCues || effectiveCues.length === 0) return [];

  const seenQuestions = new Set<string>();
  const validQuestions: GeneratedWayQuestion[] = [];

  // 1. Clean cues and map words with their timestamps
  const timedWords: Array<{ word: string; start: number; duration: number }> = [];
  for (const cue of effectiveCues) {
    const cleaned = cleanCueText(cue.w);
    if (!cleaned) continue;
    const words = cleaned.split(/\s+/).filter(Boolean);
    const wordDur = cue.d / (words.length || 1);
    words.forEach((w, idx) => {
      const cleanWord = w.replace(/[^\w]/g, '').toLowerCase();
      if (cleanWord.length > 0) {
        timedWords.push({
          word: cleanWord,
          start: cue.t + idx * wordDur,
          duration: wordDur,
        });
      }
    });
  }

  // 2. Candidate 2-3 word n-grams
  const candidatePhrases = new Map<string, { count: number; firstStart: number; rawText: string }>();

  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i <= timedWords.length - n; i++) {
      const slice = timedWords.slice(i, i + n);
      const firstWord = slice[0].word;
      const lastWord = slice[slice.length - 1].word;

      // Filter: neither first nor last word can be a stop word or disallowed fragment word
      if (STOP_WORDS.has(firstWord) || STOP_WORDS.has(lastWord)) continue;
      if (DISALLOWED_FRAGMENT_WORDS.has(firstWord) || DISALLOWED_FRAGMENT_WORDS.has(lastWord)) continue;
      if (firstWord.length < 3 || lastWord.length < 3) continue;

      // Reject if last word ends in adverbs/comparatives/participles like ly, er, est, ing
      if (/(?:ly|er|est|ing)$/.test(lastWord) && lastWord !== 'engineering' && lastWord !== 'computer') continue;

      // None of the words in the phrase can be an unresolved fragment
      const hasBadWord = slice.some(
        (sw) => DISALLOWED_FRAGMENT_WORDS.has(sw.word) || (sw.word.endsWith('s') && sw.word.length <= 4 && sw.word !== 'musk')
      );
      if (hasBadWord) continue;

      const phraseKey = slice.map((sw) => sw.word).join(' ');
      if (phraseKey.length < 8 || phraseKey.length > 45) continue;

      const existing = candidatePhrases.get(phraseKey);
      if (existing) {
        existing.count++;
      } else {
        candidatePhrases.set(phraseKey, {
          count: 1,
          firstStart: slice[0].start,
          rawText: phraseKey,
        });
      }
    }
  }

  // 3. Sort by distinctive length and frequency
  const sorted = Array.from(candidatePhrases.values()).sort(
    (a, b) => b.count * b.rawText.length - a.count * a.rawText.length
  );

  for (const cand of sorted) {
    if (validQuestions.length >= maxQuestions) break;

    const questionText = `What do they say about ${cand.rawText}?`;
    const triggerSec = Math.round(cand.firstStart * 10) / 10;
    const answerStartSec = Math.max(0, Math.round((cand.firstStart - 2) * 10) / 10);
    const answerEndSec = Math.min(window.endSec, Math.round((cand.firstStart + 60) * 10) / 10);

    const candidateObj = {
      questionText,
      triggerSec,
      answerStartSec,
      answerEndSec,
      confidenceScore: 0.88,
      tier: 'TIER_B_KEYPHRASE' as const,
    };

    if (validateWayQuestion(candidateObj, window.startSec, window.endSec, seenQuestions)) {
      validQuestions.push(candidateObj);
    }
  }

  return validQuestions;
}

export async function generateTierAModelQuestions(
  window: SpeechWindow,
  llmProvider: ILanguageModelProvider | null,
  videoDurationSec?: number
): Promise<GeneratedWayQuestion[]> {
  if (!llmProvider || !llmProvider.isAvailable() || typeof llmProvider.predictWayQuestions !== 'function') {
    return [];
  }
  try {
    const prediction = await llmProvider.predictWayQuestions(window, videoDurationSec);
    if (!prediction || !Array.isArray(prediction.questions)) return [];
    const seen = new Set<string>();
    const valid: GeneratedWayQuestion[] = [];
    for (const q of prediction.questions) {
      if (validateWayQuestion(q, window.startSec, window.endSec, seen)) {
        valid.push({
          questionText: q.questionText,
          triggerSec: q.triggerSec,
          answerStartSec: q.answerStartSec,
          answerEndSec: q.answerEndSec,
          confidenceScore: q.confidenceScore || 0.95,
          tier: 'TIER_A_MODEL',
        });
      }
    }
    return valid;
  } catch {
    return [];
  }
}

/**
 * Three-tier orchestrator: Tier A (Workers AI) -> Tier B (Keyphrase) -> Tier C (Unavailable)
 */
export async function generateWayQuestionsForWindow(
  window: SpeechWindow,
  language: string,
  llmProvider: ILanguageModelProvider | null,
  videoDurationSec?: number
): Promise<WayGenerationResult> {
  let cues: WindowCueCompact[] = [];
  try {
    cues = JSON.parse(window.cuesJson);
  } catch {
    cues = [];
  }

  const isEnglish = !language || language.toLowerCase().startsWith('en');

  // =========================================================================
  // TIER A: Workers AI (Healthy Instruction Model)
  // =========================================================================
  if (llmProvider && llmProvider.isAvailable()) {
    try {
      const prediction = await llmProvider.predictWayQuestions?.(window, videoDurationSec);
      if (prediction && Array.isArray(prediction.questions) && prediction.questions.length > 0) {
        const seenQuestions = new Set<string>();
        const validatedQuestions: GeneratedWayQuestion[] = [];

        for (const q of prediction.questions) {
          const item = {
            questionText: q.questionText,
            triggerSec: q.triggerSec,
            answerStartSec: q.answerStartSec,
            answerEndSec: q.answerEndSec,
            confidenceScore: q.confidenceScore || 0.95,
            tier: 'TIER_A_MODEL' as const,
          };
          if (validateWayQuestion(item, window.startSec, window.endSec, seenQuestions)) {
            validatedQuestions.push(item);
          }
        }

        if (validatedQuestions.length > 0) {
          return {
            questions: validatedQuestions.slice(0, 5),
            tier: 'TIER_A_MODEL',
            modelId: llmProvider.name,
          };
        }
      }
    } catch (e: any) {
      console.warn('[WayGenerator] Tier A Model failed, falling to Tier B:', e.message);
    }
  }

  // =========================================================================
  // TIER B: Keyphrase Questions (English Transcript, No LLM Required)
  // =========================================================================
  if (isEnglish) {
    const keyphraseQuestions = generateTierBKeyphraseQuestions(window, cues, 5);
    if (keyphraseQuestions.length > 0) {
      return {
        questions: keyphraseQuestions,
        tier: 'TIER_B_KEYPHRASE',
        reason: 'Generated via Tier B non-AI keyphrase extraction.',
      };
    }
  }

  // =========================================================================
  // TIER C: Non-English Transcript and No Model
  // =========================================================================
  return {
    questions: [],
    tier: 'TIER_C_UNAVAILABLE',
    reason: isEnglish
      ? 'No distinct keyphrases detected in this speech segment.'
      : `Question generation unavailable for ${language.toUpperCase()} without language model.`,
  };
}

