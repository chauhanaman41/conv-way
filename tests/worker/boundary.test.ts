import { describe, it, expect } from 'vitest';
import {
  detectIntent,
  extractKeywords,
  calculateKeywordCoverage,
  extractClipBoundaries,
  Cue,
} from '../../src/worker/services/boundary';

describe('Boundary & Intent Extraction Service (Step 4 & 5)', () => {
  it('correctly detects meta-questions as IN_VIDEO_META', () => {
    expect(detectIntent('what are they talking about?')).toBe('IN_VIDEO_META');
    expect(detectIntent('what is this about')).toBe('IN_VIDEO_META');
    expect(detectIntent('explain that')).toBe('IN_VIDEO_META');
    expect(detectIntent('what did he mean')).toBe('IN_VIDEO_META');
    expect(detectIntent('who is speaking')).toBe('IN_VIDEO_META');
    expect(detectIntent('what is going on')).toBe('IN_VIDEO_META');
  });

  it('correctly detects topic-specific queries as TOPIC_QUERY', () => {
    expect(detectIntent('Why cant Starlink handle dense cities?')).toBe('TOPIC_QUERY');
    expect(detectIntent('How many satellites are in orbit?')).toBe('TOPIC_QUERY');
    expect(detectIntent('What is Universal High Income?')).toBe('TOPIC_QUERY');
  });

  it('calculates keyword coverage ratio accurately', () => {
    const kws = extractKeywords('Why cant Starlink handle dense cities');
    expect(kws).toContain('starlink');
    expect(kws).toContain('dense');
    expect(kws).toContain('cities');
    expect(kws).toContain('handle');

    const textWithAll = 'Starlink cannot handle densely populated cities due to physics and cell towers.';
    const coverageAll = calculateKeywordCoverage(kws, textWithAll);
    expect(coverageAll).toBeGreaterThanOrEqual(0.75);

    const unrelatedText = 'Tesla makes electric cars and Optimus robot.';
    const coverageUnrelated = calculateKeywordCoverage(kws, unrelatedText);
    expect(coverageUnrelated).toBeLessThan(0.2);
  });

  it('Golden Test: extracts exact Starlink city clip boundaries without LLM', () => {
    const sampleCues: Cue[] = [
      { t: 1642.3, d: 3.6, w: "and it can't work in a densely populated area with high buildings, maybe." },
      { t: 1647.1, d: 1.7, w: "But can that change, and tomorrow," },
      { t: 1648.9, d: 4.3, w: "it becomes really efficient in a densely populated city" },
      { t: 1653.3, d: 2.7, w: "where it is competitive with the local network providers?" },
      { t: 1657.0, d: 2.4, w: "Unfortunately, the physics don't allow for that." },
      { t: 1659.4, d: 2.4, w: "So, we're too far away." },
      { t: 1663.4, d: 4.1, w: "So, at 550 kilometres, even if we try to reduce it, which..." },
      { t: 1667.5, d: 2.8, w: "About as low as we can go is about 350 kilometres," },
      { t: 1670.4, d: 1.8, w: "still very far away." },
      { t: 1673.8, d: 2.6, w: "You can think of, like, a flashlight," },
      { t: 1676.6, d: 3.1, w: "which is, you know, this flashlight's got a cone" },
      { t: 1679.8, d: 4.0, w: "and that cone is coming at, you know..." },
      { t: 1683.9, d: 1.7, w: "today, it's 550 kilometres." },
      { t: 1685.7, d: 2.1, w: "In the future, we're trying to get down to 350 kilometres," },
      { t: 1687.9, d: 3.0, w: "but we can't beat something that's one kilometre away," },
      { t: 1691.0, d: 1.4, w: "which is the cell tower." },
      { t: 1692.5, d: 1.8, w: "Physics is not on our side here." },
      { t: 1694.4, d: 4.5, w: "So, it's not physically possible for Starlink" },
      { t: 1699.0, d: 2.8, w: "to serve densely populated cities." },
      { t: 1701.8, d: 3.0, w: "Like, you can serve a little bit, maybe 1% of the population." },
      { t: 1717.2, d: 4.4, w: "In cities, there's sometimes underserved areas for random reasons." },
      { t: 1721.7, d: 2.5, w: "And so, Starlink can serve, like I said," },
      { t: 1724.3, d: 4.8, w: "maybe 1% or 2% of a densely populated city." },
      { t: 1730.4, d: 2.8, w: "But it can be much more effective in, like I said," },
      { t: 1733.2, d: 3.5, w: "in rural areas where the Internet connection is much worse." },
      { t: 1736.8, d: 3.9, w: "And often, people either have, sometimes, no access to Internet" },
      { t: 1740.8, d: 3.6, w: "or it's extremely expensive or the quality is not very good." },
      { t: 1746.5, d: 1.6, w: "If I were to ask you to wager a guess, Elon," },
      { t: 1748.8, d: 4.9, w: "do you think India will go down the path of urbanisation like China did," },
    ];

    const kws = extractKeywords("Why can't Starlink handle dense cities?");
    const boundary = extractClipBoundaries(kws, sampleCues, 1642.3, 1914.2);

    // Rule mandates:
    // startSec must be between 27:10 (1630s) and 27:45 (1665s)
    // endSec must be between 28:40 (1720s) and 29:05 (1745s)
    expect(boundary.startSec).toBeGreaterThanOrEqual(1630);
    expect(boundary.startSec).toBeLessThanOrEqual(1665);

    expect(boundary.endSec).toBeGreaterThanOrEqual(1720);
    expect(boundary.endSec).toBeLessThanOrEqual(1745);

    // Ensure clip duration is capped at <= 120s
    expect(boundary.endSec - boundary.startSec).toBeLessThanOrEqual(120);
  });
});

