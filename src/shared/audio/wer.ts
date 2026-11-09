/**
 * Word Error Rate (WER) Evaluator for Speech Recognition
 * Standard Levenshtein distance on normalized word tokens.
 * WER = (Substitutions + Deletions + Insertions) / TotalReferenceWords
 */

export interface WerBreakdown {
  substitutions: number;
  deletions: number;
  insertions: number;
  correct: number;
  referenceWordCount: number;
  hypothesisWordCount: number;
  wer: number;
  accuracy: number;
}

/**
 * Normalizes text for speech recognition scoring:
 * - Lowercases text
 * - Strips punctuation (periods, commas, question marks, exclamation marks, quotes)
 * - Retains alphanumeric characters and spaces
 * - Normalizes contractions (e.g. "don't" -> "dont")
 */
export function normalizeTranscript(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'–—]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into word array after normalization.
 */
export function tokenizeWords(text: string): string[] {
  const norm = normalizeTranscript(text);
  return norm.length === 0 ? [] : norm.split(/\s+/).filter(Boolean);
}

/**
 * Calculates Word Error Rate (WER) using standard dynamic programming matrix.
 */
export function calculateWer(reference: string, hypothesis: string): WerBreakdown {
  const ref = tokenizeWords(reference);
  const hyp = tokenizeWords(hypothesis);

  const n = ref.length;
  const m = hyp.length;

  if (n === 0) {
    const wer = m === 0 ? 0 : 1.0;
    return {
      substitutions: 0,
      deletions: 0,
      insertions: m,
      correct: 0,
      referenceWordCount: 0,
      hypothesisWordCount: m,
      wer,
      accuracy: m === 0 ? 1.0 : 0,
    };
  }

  // Cost matrix: dp[i][j] = minimum edit distance between ref[0..i-1] and hyp[0..j-1]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) {
    dp[i][0] = i; // Deletion cost
  }
  for (let j = 0; j <= m; j++) {
    dp[0][j] = j; // Insertion cost
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]; // Match
      } else {
        const subCost = dp[i - 1][j - 1] + 1; // Substitution
        const delCost = dp[i - 1][j] + 1;     // Deletion
        const insCost = dp[i][j - 1] + 1;     // Insertion
        dp[i][j] = Math.min(subCost, delCost, insCost);
      }
    }
  }

  // Backtrack to count substitutions, deletions, and insertions
  let i = n;
  let j = m;
  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let correct = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1]) {
      correct++;
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      substitutions++;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      deletions++;
      i--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      insertions++;
      j--;
    } else {
      // Tie-break fallback
      if (i > 0 && j > 0) {
        substitutions++;
        i--;
        j--;
      } else if (i > 0) {
        deletions++;
        i--;
      } else {
        insertions++;
        j--;
      }
    }
  }

  const rawWer = (substitutions + deletions + insertions) / n;
  const wer = Math.round(rawWer * 1000) / 1000;
  const accuracy = Math.max(0, Math.round((1 - wer) * 1000) / 1000);

  return {
    substitutions,
    deletions,
    insertions,
    correct,
    referenceWordCount: n,
    hypothesisWordCount: m,
    wer,
    accuracy,
  };
}

