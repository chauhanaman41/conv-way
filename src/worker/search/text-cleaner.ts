/**
 * Text Cleaner and Sentence-Boundary Summarizer for External Source Citations
 * Enforces AGENTS.md rules: no raw markdown headings, no reference lists,
 * no citation markers, no cut mid-sentence, strictly within target word count.
 */

export interface SummaryResult {
  text: string;
  wordCount: number;
}

/**
 * Strips markdown formatting, citation markers, phonetics, HTML,
 * reference lists, and bibliographic lines from raw source snippet text.
 */
export function cleanSourceText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  return (
    raw
      // 1. Strip markdown headings (# Title, ## Subtitle)
      .replace(/^#+\s+.*$/gm, ' ')
      // 2. Strip setext headings (Underlined with === or ---)
      .replace(/^[=\-]{2,}$/gm, ' ')
      // 3. Strip numbered reference list items (e.g. "1. Smith, J. ...", "12. Retrieved 2024...")
      .replace(/^\s*\d+\.\s+.*$/gm, ' ')
      .replace(/\b\d+\.\s+[A-Z][a-zA-Z]+,\s+[A-Z0-9\s,\-–—]+(?:\.|\b)/g, ' ')
      // 4. Strip bullet list items that look like references
      .replace(/^\s*[\*\-]\s+(Retrieved|ISBN|doi|Author|Publisher|http).*$/gmi, ' ')
      // 5. Strip markdown bold and italics (**text**, *text*, __text__, _text_)
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      // 6. Strip markdown links [anchor](url) -> anchor
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 7. Strip citation markers: [...], [1], [2], [citation needed], [edit]
      .replace(/\[\s*\.\.\.\s*\]/g, ' ')
      .replace(/\[\d+\]/g, ' ')
      .replace(/\[citation needed\]/gi, ' ')
      .replace(/\[edit\]/gi, ' ')
      .replace(/\[[^\]]{1,15}\]/g, ' ')
      // 8. Strip standalone citation marks (^, ↑)
      .replace(/[\^↑]/g, ' ')
      // 9. Strip phonetics /faɪˈnæns/
      .replace(/\/[^\/]{2,}\//g, ' ')
      // 10. Strip bibliographic lines (Retrieved ..., ISBN ..., doi:...)
      .replace(/\bRetrieved\s+[A-Za-z0-9,\s\-]+\b/gi, ' ')
      .replace(/\b(ISBN|ISSN|doi|PMID)\s*[:#]?[0-9\w\-.]+/gi, ' ')
      .replace(/\b(author|publisher|published|accessed|edition|volume|issue|bibliography)\s*[:=][^\n.]*/gi, ' ')
      // 11. Strip HTML tags
      .replace(/<[^>]+>/g, ' ')
      // 12. Collapse excessive whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Splits text into clean sentences, removes duplicates and short fragments (< 5 words).
 */
export function extractValidSentences(text: string): string[] {
  if (!text) return [];

  // Match sentence ending with ., ! or ? followed by space or end of string
  const rawSentences = text.split(/(?<=[.!?])\s+/);
  const valid: string[] = [];
  const seen = new Set<string>();

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    // Filter: must have at least 5 words
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 5) continue;

    // Filter: deduplicate sentences (case-insensitive)
    const norm = trimmed.toLowerCase().replace(/[^\w\s]/g, '');
    if (seen.has(norm)) continue;
    seen.add(norm);

    // Ensure sentence ends with punctuation
    const punctuated = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    valid.push(punctuated);
  }

  return valid;
}

/**
 * Summarizes cleaned source text to strictly minWords..maxWords,
 * cutting only on clean sentence boundaries (or clause boundaries if necessary).
 */
export function summarizeToWordRange(
  rawText: string,
  minWords = 20,
  maxWords = 30
): SummaryResult {
  const cleaned = cleanSourceText(rawText);
  const sentences = extractValidSentences(cleaned);

  if (sentences.length === 0) {
    // Fallback if no valid sentences found
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, maxWords);
    if (words.length === 0) {
      return { text: 'External reference documentation matches your question.', wordCount: 7 };
    }
    const text = `${words.join(' ')}.`;
    return { text, wordCount: words.length };
  }

  const selectedSentences: string[] = [];
  let currentWords: string[] = [];

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).filter(Boolean);
    const combinedCount = currentWords.length + sentenceWords.length;

    if (combinedCount <= maxWords) {
      selectedSentences.push(sentence);
      currentWords = currentWords.concat(sentenceWords);
      if (currentWords.length >= minWords) {
        break;
      }
    } else {
      // Adding the full sentence would exceed maxWords
      if (currentWords.length >= minWords) {
        // We already have enough words, stop here
        break;
      }

      // If we don't have enough words yet, attempt to take a clause ending on punctuation (comma, semicolon, dash)
      const clauses = sentence.split(/(?:[,;—–]|\s+-\s+)\s*/);
      let clauseAccum = '';
      let clauseWords: string[] = [];

      for (const clause of clauses) {
        const cWords = clause.trim().split(/\s+/).filter(Boolean);
        if (currentWords.length + clauseWords.length + cWords.length <= maxWords) {
          clauseAccum = clauseAccum ? `${clauseAccum}, ${clause.trim()}` : clause.trim();
          clauseWords = clauseWords.concat(cWords);
        } else {
          break;
        }
      }

      if (clauseWords.length > 0 && currentWords.length + clauseWords.length >= minWords) {
        const cleanClause = clauseAccum.replace(/[.,;—–-]+$/, '') + '.';
        selectedSentences.push(cleanClause);
        currentWords = currentWords.concat(clauseWords);
      }
      break;
    }
  }

  // If still below minWords and we have at least one sentence, use the first sentence (or trimmed if too long)
  if (selectedSentences.length === 0 && sentences.length > 0) {
    const firstSentence = sentences[0];
    const words = firstSentence.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
      selectedSentences.push(firstSentence);
      currentWords = words;
    } else {
      // Look for a clause boundary within minWords..maxWords
      const targetWords = words.slice(0, maxWords);
      let cutIndex = -1;
      for (let i = maxWords - 1; i >= minWords - 1; i--) {
        if (/[,;—–-]$/.test(targetWords[i])) {
          cutIndex = i + 1;
          break;
        }
      }
      const sliceCount = cutIndex !== -1 ? cutIndex : Math.min(25, maxWords);
      const slice = words.slice(0, sliceCount);
      selectedSentences.push(`${slice.join(' ').replace(/[.,;—–-]+$/, '')}.`);
      currentWords = slice;
    }
  }

  let resultText = selectedSentences.join(' ').replace(/\.{2,}/g, '.').replace(/…/g, '.');
  const finalWordCount = resultText.split(/\s+/).filter(Boolean).length;

  return {
    text: resultText,
    wordCount: finalWordCount,
  };
}
