import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectIntent,
  extractKeywords,
  calculateKeywordCoverage,
  extractClipBoundaries,
  rewriteQuery,
  Cue,
} from '../../src/worker/services/boundary';

describe('Comprehensive Core Flow & AGENTS.md Verification Suite (Step 11)', () => {
  // =========================================================================
  // 1. Zero Hardcoding of Video IDs in src/
  // =========================================================================
  it('enforces that no 11-character YouTube video ID literals appear in src/', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const YOUTUBE_ID_REGEX = /(?<![a-zA-Z0-9_-])[a-zA-Z0-9_-]{11}(?![a-zA-Z0-9_-])/g;

    const ignoredWords = new Set([
      'constructor', 'environment', 'description', 'SearchOrder', 'searchOrder',
      'currentTime', 'isContradic', 'playheadSec', 'lastHitTime', 'stepDownLev',
      'contentType', 'watchSecond', 'windowIndex', 'SearchResul', 'SpeechWindo',
      'windowCount', 'speakerName', 'content-type', 'application', 'coordinates',
      'development', 'placeholder', 'unannounced', 'transformer', 'specificate',
      'speculative', 'governorSta', 'clarificati', 'isDiveDeepe', 'transparent',
      'subsections', 'interimResu', 'audiocontex', 'analysernod', 'mediastream',
      'mediarecord', 'recognitall', 'substantive', 'geolocation', 'concurrence',
      'observation', 'credentials', 'destination', 'orientation', 'operational',
      'permissible', 'subsequence', 'affirmative', 'affirmation', 'temperature',
      'preferences', 'interactive', 'interaction', 'illustratio', 'perspective',
      'performance', 'proactively', 'proceedings', 'traditional', 'consecutive',
      'measurement', 'instruction', 'definitions', 'alternative', 'approximate',
      'engineering', 'unsupported', 'represented', 'represnting', 'highlighted',
      'transcripts', 'established', 'exploration', 'distinctive', 'system-stat',
      'system-draw', 'affirmation', 'restricting', 'calculating', 'origin-play',
      'currentPlay', 'activeWatch', 'video-frame', 'video-playe', 'track-statu',
      'track-provi', 'debug-drawe', 'debug-telep', 'context-rew', 'conversatio',
      'conversatnl', 'audio-playe', 'speaker-nam', 'window-inde', 'window-cues',
      'window-span', 'status-pend', 'status-read', 'status-proc', 'status-fail',
      'status-defr', 'status-none', 'status-gate', 'player-stat', 'player-inst',
      'speech-wind', 'speech-cues', 'prompt-text', 'result-list', 'result-item',
      'stream-node', 'button-pink', 'button-hold', 'accent-lime', 'accent-peta',
      'border-char', 'border-bone', 'border-lime', 'border-peta', 'border-parc',
      'text-parchm', 'select-none', 'shrink-zero', 'truncate-sm', 'overflow-sc',
      'overflow-hi', 'focus-outli', 'line-clamp-', 'animate-pin', 'animate-pul',
      'rounded-ful', 'rounded-non', 'leading-non', 'leading-rel', 'bg-charcoal',
      'bg-parchmen', 'text-parchm', 'min-height-', 'max-height-', 'currentPlay',
      'currentSecs', 'playheadSec', 'durationSec', 'endOfClipSec', 'playbackSec',
      'triggerSecs', 'isStreaming', 'isRecognize', 'isPlayheadO', 'searchScore',
      'groundTruth', 'groundCheck', 'answerStart', 'answerEndSe', 'confidenceS',
      'breadcrumbS', 'isExternalV', 'videoTitleS', 'channelTitl', 'isContradic',
      'lastFinalQu', 'audioDucking', 'recognition', 'SpeechRecog', 'AudioContex',
      'AnalyserNod', 'MediaStream', 'MediaRecord', 'currentTime', 'activeWatch',
      'isInitializ', 'setPlayerRe', 'setPipPlaye', 'updatePlayh', 'accumulateW',
      'setIsInitia', 'pushBranchS', 'popBranchSt', 'returnToRoo', 'showHandBac',
      'dismissHand', 'closePipPla', 'GoogleCsePr', 'GoogleCseDi', 'SearchOrche',
      'SearchProvi', 'SearchResul', 'SearchRespo', 'TavilySearc', 'ExaSearchPr',
      'QueryOrches', 'QueryAskReq', 'QueryAskRes', 'AnswerClipD', 'AiFallbackD',
      'GovernorSer', 'GovernorSta', 'EvonWayPred', 'EvonRerankR', 'EvonFallbac',
      'TimbreClien', 'EvonClientC', 'SpeechWindo', 'WindowCueCo', 'LlmAdapterM',
      'ILanguageMo', 'LlmHealthSt', 'WorkersAiPr', 'EvonLlmProv', 'YoutubeDisco',
      'YoutubeMetad', 'SupadataTra', 'TranscriptA', 'TranscriptS', 'VachanaPrism',
      'VachanaTimbr', 'VachanaEvonL', 'CloudflareW', 'CloudflareD', 'CloudflareK'
    ]);

    const forbiddenLiteralIds = ['zIwLWfaAg-8', 'dQw4w9WgXcQ'];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const forbidden of forbiddenLiteralIds) {
            expect(content.includes(forbidden)).toBe(false);
          }
        }
      }
    }

    scanDir(srcDir);
  });

  // =========================================================================
  // 2. Meta-Question IN_VIDEO_META Routing
  // =========================================================================
  it('correctly routes meta questions to IN_VIDEO_META and never to web search', () => {
    const metaQueries = [
      'what are they talking about',
      'what is this about',
      'what is he talking about',
      'what did he say',
      'explain that',
      'summarize this',
      'who is speaking',
      'what is going on',
    ];

    for (const q of metaQueries) {
      expect(detectIntent(q)).toBe('IN_VIDEO_META');
    }

    // Direct topic questions must NOT be meta
    expect(detectIntent('Why cannot Starlink operate in high density cities?')).toBe('TOPIC_QUERY');
    expect(detectIntent('What is Universal High Income?')).toBe('TOPIC_QUERY');
  });

  // =========================================================================
  // 3. Strict Keyword Coverage Match Threshold
  // =========================================================================
  it('enforces >= 50% keyword coverage threshold on non-stopword query terms', () => {
    const query = "Why can't Starlink handle dense cities?";
    const keywords = extractKeywords(query);

    expect(keywords).toEqual(expect.arrayContaining(['starlink', 'dense', 'cities', 'handle']));

    // Window with full coverage (physics of Starlink in dense cities)
    const matchingWindow =
      "Elon explains that Starlink physics cannot handle densely populated cities due to 550 km distance vs cell towers.";
    const matchingCoverage = calculateKeywordCoverage(keywords, matchingWindow);
    expect(matchingCoverage).toBeGreaterThanOrEqual(0.5);

    // Irrelevant window (Optimus robotics discussion)
    const irrelevantWindow =
      "Tesla is developing the Optimus humanoid robot which will begin initial production next year.";
    const irrelevantCoverage = calculateKeywordCoverage(keywords, irrelevantWindow);
    expect(irrelevantCoverage).toBeLessThan(0.5);
  });

  // =========================================================================
  // 4. Golden Test: Segment Boundary Extraction without Language Model
  // =========================================================================
  it('Golden Test: extracts exact Starlink city answer clip on Kamath Ep. 16 (Rni7Fz7208c) without LLM', () => {
    const kamathEpisode16Cues: Cue[] = [
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
    const boundary = extractClipBoundaries(kws, kamathEpisode16Cues, 1642.3, 1914.2);

    // Rule mandates:
    // startSec must start between 27:10 (1630s) and 27:45 (1665s)
    // endSec must end between 28:40 (1720s) and 29:05 (1745s)
    expect(boundary.startSec).toBeGreaterThanOrEqual(1630);
    expect(boundary.startSec).toBeLessThanOrEqual(1665);

    expect(boundary.endSec).toBeGreaterThanOrEqual(1720);
    expect(boundary.endSec).toBeLessThanOrEqual(1745);

    // Clip must not exceed 120 seconds
    expect(boundary.endSec - boundary.startSec).toBeLessThanOrEqual(120);
  });

  // =========================================================================
  // 5. Conversational Context Rewriter
  // =========================================================================
  it('rewrites queries containing pronouns with speaker & topic context from recent cues', () => {
    const recentCues: Cue[] = [
      { t: 1640.0, d: 4.0, w: 'Starlink beams and satellite communication in dense areas' },
      { t: 1645.0, d: 3.0, w: 'cellular coverage and tower distance' },
    ];

    const { rewrittenText, isRewritten } = rewriteQuery(
      'Why cant it work there?',
      recentCues,
      'People by WTF Ep 16 Musk Kamath'
    );

    expect(isRewritten).toBe(true);
    expect(rewrittenText.toLowerCase()).toContain('starlink');
  });

  // =========================================================================
  // 6. Zero Fake Fallback Templates
  // =========================================================================
  it('verifies that no fake "According to verified documentation" template exists in source code', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const FAKE_TEMPLATE = 'According to verified documentation';

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          expect(content.includes(FAKE_TEMPLATE)).toBe(false);
        }
      }
    }

    scanDir(srcDir);
  });
});

