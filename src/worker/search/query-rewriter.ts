import { extractKeywords, STOP_WORDS } from '../services/boundary';

/**
 * Builds a clean, focused external search query for "Dive Deeper" follow-ups.
 * Rules:
 * - No conversational filler prefixes (e.g. "Tell me more details about")
 * - No timestamps or digits (strips ranges like (110:57 - 112:30) and raw numbers)
 * - Combines the core topic of the original question with prominent keywords from the clip
 * - Never contains 'undefined', 'null', or placeholder artifacts
 */
export function buildDiveDeeperQuery(
  originalQuestion: string,
  clipSummary?: string,
  transcriptCues?: Array<{ t: number; d: number; w: string }>
): string {
  // Clean original question: strip leading question words and punctuation
  let cleanQ = (originalQuestion || '')
    .replace(/^(\s*tell\s+me\s+more\s+details\s+about\s*)+/i, '')
    .replace(/^(\s*tell\s+me\s+(more|about)\s*)+/i, '')
    .replace(/\b(undefined|null|nan)\b/gi, '')
    .trim();

  const qKeywords = extractKeywords(cleanQ);

  // Extract key topic from clip summary
  let summaryKeywords: string[] = [];
  if (clipSummary) {
    const strippedSummary = clipSummary
      .replace(/\(\s*\d{1,4}:\d{2}\s*-\s*\d{1,4}:\d{2}\s*\)/g, '') // strip timestamp ranges
      .replace(/\b\d{1,4}:\d{2}\b/g, '') // strip single timestamps
      .replace(/segment\s+answering/gi, '')
      .replace(/^"|"$/g, '');
    summaryKeywords = extractKeywords(strippedSummary);
  }

  // Extract top key phrases from cues if provided
  let cueKeywords: string[] = [];
  if (transcriptCues && Array.isArray(transcriptCues) && transcriptCues.length > 0) {
    const cueText = transcriptCues.map((c) => c.w).join(' ');
    cueKeywords = extractKeywords(cueText).slice(0, 4);
  }

  // Combine and deduplicate
  const combinedTokens = Array.from(
    new Set([...qKeywords, ...summaryKeywords, ...cueKeywords])
  ).filter((tok) => {
    // Reject digits, placeholders, stopwords
    if (/\d+/.test(tok)) return false;
    if (['undefined', 'null', 'segment', 'answering', 'details'].includes(tok.toLowerCase())) return false;
    return tok.length >= 3;
  });

  // Construct query without digits or filler
  const finalQuery = combinedTokens.slice(0, 8).join(' ').trim();
  return finalQuery || 'context details';
}

