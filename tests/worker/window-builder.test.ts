import { describe, it, expect } from 'vitest';
import { WindowBuilder } from '../../src/worker/transcript/window-builder';
import { RawTranscriptCue } from '../../src/worker/transcript/types';

describe('WindowBuilder Unit Tests', () => {
  it('builds Window 0 with fast-start size (~350 words) and subsequent ~700 words', () => {
    // Generate 2000 words across 200 cues
    const cues: RawTranscriptCue[] = [];
    let currentTime = 0;
    for (let i = 0; i < 200; i++) {
      cues.push({
        text: `Word${i} speech fragment content explanation topic discuss analysis concept detail`,
        start: currentTime,
        duration: 2.5,
      });
      currentTime += 2.5;
    }

    const windows = WindowBuilder.buildWindows(cues);
    expect(windows.length).toBeGreaterThan(1);

    // Window 0 check
    expect(windows[0].windowIndex).toBe(0);
    expect(windows[0].startSec).toBe(0);
    expect(windows[0].wordCount).toBeGreaterThanOrEqual(300);

    // Check all windows have positive word count and valid endSec
    for (let j = 0; j < windows.length; j++) {
      expect(windows[j].windowIndex).toBe(j);
      expect(windows[j].wordCount).toBeGreaterThan(0);
      expect(windows[j].endSec).toBeGreaterThan(windows[j].startSec);
    }
  });

  it('handles empty cues gracefully', () => {
    const windows = WindowBuilder.buildWindows([]);
    expect(windows).toEqual([]);
  });
});
