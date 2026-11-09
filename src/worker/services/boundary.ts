export interface Cue {
  t: number; // start time in seconds
  d: number; // duration in seconds
  w: string; // text
}

export type QueryIntent = 'IN_VIDEO_META' | 'TOPIC_QUERY';

export const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
  'in', 'with', 'to', 'for', 'of', 'about', 'what', 'why', 'how', 'when',
  'where', 'who', 'does', 'can', 'could', 'would', 'should', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'did', 'doing',
  'tell', 'me', 'explain', 'show', 'like', 'just', 'more', 'details', 'that',
  'this', 'then', 'there', 'some', 'any', 'from'
]);

export interface QueryValidationResult {
  valid: boolean;
  contentWords: string[];
  reason?: string;
}

/**
 * Validates user queries: rejects literal artifacts ('undefined', 'null', '[object Object]')
 * and ensures at least 2 meaningful content words.
 */
export function validateQuery(query: string): QueryValidationResult {
  if (!query || typeof query !== 'string') {
    return { valid: false, contentWords: [], reason: 'Query is empty' };
  }

  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { valid: false, contentWords: [], reason: 'Query too short' };
  }

  // Reject literal JS placeholders
  const lower = trimmed.toLowerCase();
  if (/\b(undefined|null|nan)\b|\[object\s+object\]/i.test(lower)) {
    return { valid: false, contentWords: [], reason: 'Query contains invalid literal placeholders' };
  }

  const words = extractKeywords(lower);
  const contentWords = words.filter((w) => !STOP_WORDS.has(w) && w.length >= 3);

  if (contentWords.length < 2) {
    return {
      valid: false,
      contentWords,
      reason: 'Query must contain at least 2 content keywords',
    };
  }

  return { valid: true, contentWords };
}

const META_QUESTION_PATTERNS = [
  /\bwhat are they talking about\b/i,
  /\bwhat is this about\b/i,
  /\bwhat('?s| is) he talking about\b/i,
  /\bwhat did he (just )?(say|mean)\b/i,
  /\bexplain that\b/i,
  /\bsummarize this\b/i,
  /\bwho is speaking\b/i,
  /\bwhat is going on\b/i,
  /\bwhat's going on\b/i,
  /\bwhat are they discussing\b/i,
];

const PRONOUN_PATTERNS = /\b(he|she|they|it|this|that|him|his|them|their)\b/i;

/**
 * Detects whether the query is a meta-inquiry about the ongoing video segment
 */
export function detectIntent(query: string): QueryIntent {
  const trimmed = query.trim();
  for (const pattern of META_QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'IN_VIDEO_META';
    }
  }
  return 'TOPIC_QUERY';
}

export const GENERIC_MATCH_TERMS = new Set([
  'taking', 'take', 'takes', 'place', 'places', 'podcast', 'podcasts',
  'time', 'times', 'thank', 'thanks', 'video', 'videos', 'episode', 'episodes',
  'conversation', 'conversations', 'speak', 'speaking', 'talk', 'talking',
  'tell', 'explain', 'show', 'discuss', 'discussing', 'discussion',
  'person', 'people', 'guy', 'guys', 'host', 'guest'
]);

/**
 * Extracts content words (excluding stopwords and generic words like taking, place, podcast, time, thank)
 * and distinguishes rare high-IDF terms.
 */
export function extractContentWords(query: string): { contentWords: string[]; rareWords: string[] } {
  const allKeywords = extractKeywords(query);
  const contentWords = allKeywords.filter((w) => !GENERIC_MATCH_TERMS.has(w) && !STOP_WORDS.has(w));
  const rareWords = contentWords.filter((w) => w.length >= 4 && !GENERIC_MATCH_TERMS.has(w));
  return { contentWords, rareWords };
}

/**
 * Extracts normalized, non-stopword keywords from a query string
 */
export function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Rewrites a query using conversational context (recent cues + video title)
 * when pronouns or references to ongoing topics are detected.
 */
export function rewriteQuery(
  query: string,
  recentCues: Cue[] = [],
  videoTitle?: string
): { rewrittenText: string; isRewritten: boolean } {
  const hasPronoun = PRONOUN_PATTERNS.test(query);

  if (!hasPronoun && recentCues.length === 0) {
    return { rewrittenText: query, isRewritten: false };
  }

  if (hasPronoun) {
    // Extract prominent context terms from the preceding 60 seconds
    const contextText = recentCues.map((c) => c.w).join(' ');
    const contextKeywords = extractKeywords(contextText);
    const titleKeywords = videoTitle ? extractKeywords(videoTitle) : [];

    // Prioritize distinctive keywords
    const candidateEntities = Array.from(new Set([...contextKeywords, ...titleKeywords])).slice(0, 4);

    if (candidateEntities.length > 0) {
      const rewritten = `${query} (${candidateEntities.join(' ')})`;
      return { rewrittenText: rewritten, isRewritten: true };
    }
  }

  return { rewrittenText: query, isRewritten: false };
}

/**
 * Calculates keyword coverage ratio (0.0 to 1.0)
 * Coverage = (matched unique query keywords) / (total unique query keywords)
 */
export function calculateKeywordCoverage(queryKeywords: string[], targetText: string): number {
  if (queryKeywords.length === 0) return 0;
  const lowerText = targetText.toLowerCase();

  let matched = 0;
  for (const kw of queryKeywords) {
    // Check for exact substring or simple plural/stem match
    const stem = kw.length > 4 ? kw.slice(0, -1) : kw;
    if (lowerText.includes(kw) || lowerText.includes(stem)) {
      matched++;
    }
  }

  return matched / queryKeywords.length;
}

export interface ExtractedClipBoundary {
  startSec: number;
  endSec: number;
  confidence: number;
  matchedCuesCount: number;
  summary: string;
}

/**
 * Extracts tight clip start and end boundaries from transcript cues
 * WITHOUT requiring an external LLM.
 *
 * Algorithm:
 * 1. Find the cue or cluster with highest keyword density (the answer core).
 * 2. Look backwards up to 30s to include question turn if nearby (e.g. interviewer question).
 * 3. Look forward until argument completes (sentence end / pause / topic transition).
 * 4. Apply 2-second padding, cap duration at 120s.
 */
export function extractClipBoundaries(
  queryKeywords: string[],
  cues: Cue[],
  targetWindowStartSec: number,
  targetWindowEndSec: number
): ExtractedClipBoundary {
  if (!cues || cues.length === 0) {
    return {
      startSec: targetWindowStartSec,
      endSec: Math.min(targetWindowStartSec + 75, targetWindowEndSec),
      confidence: 0.5,
      matchedCuesCount: 0,
      summary: 'Relevant section in video.',
    };
  }

  // 1. Score each cue by keyword occurrence
  const scoredCues = cues.map((cue, idx) => {
    const textLower = cue.w.toLowerCase();
    let score = 0;
    for (const kw of queryKeywords) {
      const stem = kw.length > 4 ? kw.slice(0, -1) : kw;
      if (textLower.includes(kw) || textLower.includes(stem)) {
        score += 2;
      }
    }
    return { cue, idx, score };
  });

  // 2. Sliding window density (sum over 5 consecutive cues)
  let bestClusterIdx = 0;
  let maxClusterScore = -1;

  for (let i = 0; i < scoredCues.length; i++) {
    let windowScore = 0;
    for (let j = i; j < Math.min(i + 5, scoredCues.length); j++) {
      windowScore += scoredCues[j].score;
    }
    if (windowScore > maxClusterScore) {
      maxClusterScore = windowScore;
      bestClusterIdx = i;
    }
  }

  const peakCue = scoredCues[bestClusterIdx].cue;

  // 3. Look backwards for question turn (up to 65 seconds before the answer peak)
  let startCueIdx = bestClusterIdx;
  const searchBackLimit = Math.max(0, peakCue.t - 65);

  // Scan backwards to find the question turn or first occurrence of query topic
  let foundQuestionIdx = -1;
  for (let i = bestClusterIdx; i >= 0; i--) {
    const c = cues[i];
    if (c.t < searchBackLimit) break;

    const textLower = c.w.toLowerCase();
    const hasQuestionMark = textLower.includes('?');
    const hasAskerKeyword = queryKeywords.some((kw) => textLower.includes(kw));

    if (hasQuestionMark || hasAskerKeyword) {
      foundQuestionIdx = i;
    }
  }

  if (foundQuestionIdx !== -1) {
    startCueIdx = foundQuestionIdx;
  }

  // If startCueIdx was chosen at a phrase that continues into another cue,
  // walk backwards to the start of the thought / sentence if within 15s
  while (startCueIdx > 0 && cues[startCueIdx].t >= searchBackLimit) {
    const prevCue = cues[startCueIdx - 1];
    const prevText = prevCue.w.trim();
    if (prevText.endsWith('.') || prevText.endsWith('!') || prevText.endsWith('?')) {
      break;
    }
    if (cues[startCueIdx].t - prevCue.t > 3.0) {
      break;
    }
    startCueIdx--;
  }

  // 4. Look forward from the peak cluster to find the conclusion of the answer
  let endCueIdx = Math.min(bestClusterIdx + 4, cues.length - 1);
  const maxEndSec = cues[startCueIdx].t + 115; // cap clip duration at ~115s before padding

  for (let i = bestClusterIdx; i < cues.length; i++) {
    const c = cues[i];
    if (c.t > maxEndSec) break;

    const textLower = c.w.toLowerCase();
    // If the next turn is a new question by interviewer, stop before it
    if (
      c.t > cues[startCueIdx].t + 35 &&
      (textLower.includes('if i were to ask') ||
        textLower.includes('do you think') ||
        (textLower.endsWith('?') && !queryKeywords.some((kw) => textLower.includes(kw))))
    ) {
      break;
    }

    endCueIdx = i;
    const trimmed = c.w.trim();
    if (c.t > peakCue.t + 35 && (trimmed.endsWith('.') || trimmed.endsWith('!'))) {
      if (i + 1 < cues.length && cues[i + 1].t - (c.t + c.d) > 1.5) {
        break;
      }
    }
  }

  const rawStart = cues[startCueIdx].t;
  const rawEnd = cues[endCueIdx].t + cues[endCueIdx].d;

  // Apply padding: -2s start, bounded end before the next speaker/question
  const paddedStart = Math.max(0, Math.round((rawStart - 2) * 10) / 10);
  const nextCueStart = endCueIdx + 1 < cues.length ? cues[endCueIdx + 1].t : rawEnd;
  const paddedEnd = Math.min(Math.max(rawEnd, nextCueStart - 1.0), Math.round(rawEnd * 10) / 10);

  // Enforce maximum 120s duration
  const finalEnd = paddedEnd - paddedStart > 120 ? paddedStart + 120 : paddedEnd;

  return {
    startSec: paddedStart,
    endSec: finalEnd,
    confidence: Math.min(1.0, maxClusterScore / (queryKeywords.length * 2 || 1)),
    matchedCuesCount: scoredCues.filter((sc) => sc.score > 0).length,
    summary: `Segment answering "${queryKeywords.join(' ')}" (${Math.floor(paddedStart / 60)}:${String(Math.floor(paddedStart % 60)).padStart(2, '0')} - ${Math.floor(finalEnd / 60)}:${String(Math.floor(finalEnd % 60)).padStart(2, '0')})`,
  };
}
