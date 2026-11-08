import { TranscriptCue, SpeechWindow, WindowCueCompact } from './types';

export class WindowBuilder {
  /**
   * Normalizes cues and removes repeated trailing rolling auto-caption fragments.
   */
  public static normalizeCues(rawCues: TranscriptCue[]): TranscriptCue[] {
    const cleaned: TranscriptCue[] = [];
    let lastText = '';

    for (const cue of rawCues) {
      const text = cue.text.trim();
      if (!text) continue;

      // Skip exact consecutive duplicate text
      if (text.toLowerCase() === lastText.toLowerCase()) {
        continue;
      }

      cleaned.push({
        start: Math.max(0, cue.start),
        duration: Math.max(0.1, cue.duration),
        text,
      });
      lastText = text;
    }

    // Sort chronologically by start timestamp
    return cleaned.sort((a, b) => a.start - b.start);
  }

  /**
   * Builds speech windows of 600-800 words (Window 0 is 300-450 words) with 30s overlap.
   */
  public static buildWindows(
    cues: TranscriptCue[],
    videoDurationSec?: number
  ): SpeechWindow[] {
    const normalized = this.normalizeCues(cues);
    if (normalized.length === 0) return [];

    const windows: SpeechWindow[] = [];
    let windowIndex = 0;
    let cuePointer = 0;

    const OVERLAP_SEC = 30.0;
    const WINDOW_0_TARGET_WORDS = 350; // fast start
    const SUBSEQUENT_TARGET_WORDS = 700; // 600-800 words

    while (cuePointer < normalized.length) {
      const targetWords = windowIndex === 0 ? WINDOW_0_TARGET_WORDS : SUBSEQUENT_TARGET_WORDS;
      const windowCues: TranscriptCue[] = [];
      let currentWordCount = 0;
      let startSec = normalized[cuePointer].start;
      let endSec = startSec;

      let i = cuePointer;
      while (i < normalized.length) {
        const cue = normalized[i];
        const cueWords = cue.text.split(/\s+/).filter(Boolean).length;

        windowCues.push(cue);
        currentWordCount += cueWords;
        endSec = cue.start + cue.duration;

        i++;

        // Stop if target reached or exceeded minimum bound
        if (currentWordCount >= targetWords) {
          break;
        }
      }

      if (windowCues.length === 0) break;

      // Clamp endSec to video duration if provided
      if (videoDurationSec && endSec > videoDurationSec) {
        endSec = videoDurationSec;
      }

      const plainText = windowCues.map((c) => c.text).join(' ');
      const compactCues: WindowCueCompact[] = windowCues.map((c) => ({
        t: Math.round(c.start * 10) / 10,
        d: Math.round(c.duration * 10) / 10,
        w: c.text,
      }));

      windows.push({
        windowIndex,
        startSec: Math.round(startSec * 10) / 10,
        endSec: Math.round(endSec * 10) / 10,
        wordCount: currentWordCount,
        plainText,
        cuesJson: JSON.stringify(compactCues),
      });

      windowIndex++;

      // Advance pointer with 30-second temporal overlap
      const overlapTargetSec = Math.max(startSec, endSec - OVERLAP_SEC);
      let nextPointer = i;
      for (let j = cuePointer; j < i; j++) {
        if (normalized[j].start >= overlapTargetSec) {
          nextPointer = j;
          break;
        }
      }

      // Ensure progress to prevent infinite loop
      if (nextPointer <= cuePointer) {
        nextPointer = cuePointer + 1;
      }

      cuePointer = nextPointer;
    }

    return windows;
  }
}

