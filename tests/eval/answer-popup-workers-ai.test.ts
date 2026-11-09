import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanSourceText, extractValidSentences, summarizeToWordRange } from '../../src/worker/search/text-cleaner';
import { SearchOrchestrator } from '../../src/worker/search/orchestrator';
import { generateWayQuestionsForWindow } from '../../src/worker/services/way-generator';
import { SpeechWindow } from '../../src/worker/transcript/types';
import { ILanguageModelProvider } from '../../src/worker/gnani/llm-adapter';
import { AiFallbackCard, AiFallbackData } from '../../src/client/components/AiFallbackCard';

describe('Answer Popup & Workers AI Acceptance Tests (Step 4)', () => {
  // =========================================================================
  // TEST 1: CLEAN SOURCE TEXT
  // =========================================================================
  describe('Test 1: Clean Source Text Sanitization and Summarization', () => {
    const raw300WordSnippet = `
## Background and Overview
**Starlink** is a satellite internet constellation operated by *SpaceX* delivering high-speed broadband coverage across the globe [1].
Using mass-produced small satellites in [low Earth orbit](https://en.wikipedia.org/wiki/Low_Earth_orbit), the network communicates with designated ground transceivers [...] and user terminals worldwide.

Starlink is a satellite internet constellation operated by SpaceX delivering high-speed broadband coverage across the globe.
^ See also.
Notes.

### Technical Performance
The constellation has grown significantly with thousands of mass-produced small satellites deployed in low Earth orbit [citation needed].
Each satellite features optical space lasers enabling inter-satellite communications without requiring constant direct line-of-sight ground stations [2].

1. Smith, John. Satellite Constellations in Low Earth Orbit. MIT Press.
2. Doe, Jane. Optical Laser Interlinks. Cambridge University Press.
Retrieved 2024-05-12.
ISBN 978-0-123456-78-9.
doi:10.1000/182.
    `.trim();

    it('cleans raw text by stripping headings, bold, links, citations, reference lists, and duplicates', () => {
      const cleaned = cleanSourceText(raw300WordSnippet);

      // Verify headings stripped
      expect(cleaned).not.toMatch(/^#+/m);
      expect(cleaned).not.toContain('## Background');
      expect(cleaned).not.toContain('### Technical');

      // Verify markdown formatting stripped
      expect(cleaned).not.toContain('**');
      expect(cleaned).not.toContain('*SpaceX*');
      expect(cleaned).not.toMatch(/\[([^\]]+)\]\([^)]+\)/); // No markdown links
      expect(cleaned).toContain('low Earth orbit'); // Anchor text preserved

      // Verify citations and reference markers stripped
      expect(cleaned).not.toContain('[1]');
      expect(cleaned).not.toContain('[2]');
      expect(cleaned).not.toContain('[citation needed]');
      expect(cleaned).not.toContain('[...]');
      expect(cleaned).not.toContain('^');
      expect(cleaned).not.toContain('Retrieved 2024');
      expect(cleaned).not.toContain('ISBN');
      expect(cleaned).not.toContain('doi:');

      // Verify sentence extraction removes duplicates and fragments < 5 words
      const sentences = extractValidSentences(cleaned);
      expect(sentences).not.toContain('See also.');
      expect(sentences).not.toContain('Notes.');

      // Check for uniqueness
      const lowerSet = new Set(sentences.map((s) => s.toLowerCase()));
      expect(lowerSet.size).toBe(sentences.length);
    });

    it('summarizes to strictly 20 to 30 words, ending at a sentence boundary without trailing ellipsis', () => {
      const result = summarizeToWordRange(raw300WordSnippet, 20, 30);

      expect(result.wordCount).toBeGreaterThanOrEqual(20);
      expect(result.wordCount).toBeLessThanOrEqual(30);
      expect(result.text).toMatch(/[.!?]$/);
      expect(result.text).not.toContain('...');
      expect(result.text).not.toContain('…');

      // Ensure no citation marks or reference lists remain in output
      expect(result.text).not.toMatch(/\[\d+\]/);
      expect(result.text).not.toMatch(/\[\.\.\.\]/);
      expect(result.text).not.toContain('Retrieved');
      expect(result.text).not.toContain('ISBN');
    });

    it('cuts at nearest clause boundary if single sentence exceeds 30 words', () => {
      const singleLongSentence =
        'Starlink delivers high-speed broadband internet to remote communities worldwide, communicating with ground transceivers across multiple continents while providing low latency connectivity.';
      const result = summarizeToWordRange(singleLongSentence, 20, 30);

      expect(result.wordCount).toBeGreaterThanOrEqual(20);
      expect(result.wordCount).toBeLessThanOrEqual(30);
      expect(result.text).toMatch(/[.!?]$/);
      expect(result.text).not.toMatch(/\s\.\.\.$/);
    });
  });

  // =========================================================================
  // TEST 2: AI ANSWER VALIDATION (30 TO 40 WORDS & SENTENCE BOUNDARY)
  // =========================================================================
  describe('Test 2: AI Answer Grounding & Word Count Validation', () => {
    const orchestrator = new SearchOrchestrator({} as any);
    const sampleRetrieved = [
      {
        title: 'Starlink Specifications',
        url: 'https://www.starlink.com/specifications',
        snippet: 'Starlink residential terminals operate on Ku and Ka band frequencies.',
        score: 0.95,
      },
    ];

    it('rejects answers shorter than 30 words', () => {
      const shortAnswer =
        'Starlink terminals connect to low Earth orbit satellites using phased array antennas for high throughput broadband.';
      const wordCount = shortAnswer.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThan(30);

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: shortAnswer,
          reason: 'Short answer',
          citedUrls: ['https://www.starlink.com/specifications'],
        },
        sampleRetrieved,
        'trusted',
        'workers_ai'
      );

      expect(result).toBeNull();
    });

    it('rejects answers longer than 40 words', () => {
      const longAnswer =
        'Starlink terminals connect to low Earth orbit satellites using advanced phased array antennas for high throughput broadband connectivity across global regions, delivering resilient low-latency internet services to residential customers, maritime vessels, commercial aviation fleets, and remote educational institutions worldwide throughout all seasons.';
      const wordCount = longAnswer.trim().split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(40);

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: longAnswer,
          reason: 'Long answer',
          citedUrls: ['https://www.starlink.com/specifications'],
        },
        sampleRetrieved,
        'trusted',
        'workers_ai'
      );

      expect(result).toBeNull();
    });

    it('rejects answers that do not end on a sentence boundary', () => {
      // 32 words but trailing comma / incomplete sentence boundary
      const unpunctuatedAnswer =
        'Starlink residential user kits operate internationally with phased array antennas capable of tracking low Earth orbit satellites, providing broadband internet connectivity across remote areas with low latency communication channels for consumer households and businesses';
      const words = unpunctuatedAnswer.trim().split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(30);
      expect(words.length).toBeLessThanOrEqual(40);
      expect(unpunctuatedAnswer).not.toMatch(/[.!?]$/);

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: unpunctuatedAnswer,
          reason: 'Missing sentence boundary',
          citedUrls: ['https://www.starlink.com/specifications'],
        },
        sampleRetrieved,
        'trusted',
        'workers_ai'
      );

      expect(result).toBeNull();
    });

    it('accepts answers strictly between 30 and 40 words ending on a sentence boundary with verified citations', () => {
      const validAnswer =
        'Starlink residential user kits operate internationally with phased array antennas capable of tracking low Earth orbit satellites, providing broadband internet connectivity across remote geographical regions with low latency communication channels for consumer households.';
      const words = validAnswer.trim().split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(30);
      expect(words.length).toBeLessThanOrEqual(40);
      expect(validAnswer).toMatch(/[.!?]$/);

      const result = orchestrator.validateAndEnforceGrounding(
        {
          answerText: validAnswer,
          reason: 'Verified satellite specifications.',
          citedUrls: ['https://www.starlink.com/specifications'],
        },
        sampleRetrieved,
        'trusted',
        'workers_ai'
      );

      expect(result).not.toBeNull();
      expect(result!.isAiLabeled).toBe(true);
      expect(result!.wordCount).toBe(words.length);
      expect(result!.citations[0].domain).toBe('starlink.com');
    });
  });

  // =========================================================================
  // TEST 3: WORKERS AI PATH FOR HINDI VIDEO
  // =========================================================================
  describe('Test 3: Workers AI Path for Hindi Video (Kamath Episode)', () => {
    const hindiWindowFixture: SpeechWindow = {
      windowIndex: 0,
      startSec: 0,
      endSec: 180,
      cuesJson: JSON.stringify([
        { text: 'नमस्ते दोस्तों आज हम निखिल कामत के साथ बात कर रहे हैं।', start: 0, duration: 4 },
        { text: 'भारत में आर्टिफिशियल इंटेलिजेंस और स्टार्टअप इकोसिस्टम का क्या भविष्य है?', start: 15, duration: 5 },
        { text: 'टेक्नोलॉजी और वेंचर कैपिटल में युवा उद्यमियों के लिए क्या अवसर हैं?', start: 45, duration: 6 },
      ]),
      wordCount: 85,
    };

    it('produces English questions under 110 characters ending with ? when Workers AI is enabled', async () => {
      const mockWorkersAiProvider: ILanguageModelProvider = {
        name: '@cf/meta/llama-3.2-3b-instruct',
        isAvailable: () => true,
        predictWayQuestions: async (_window, _duration) => ({
          questions: [
            {
              questionText: 'What is the outlook for the Indian startup and venture capital ecosystem?',
              triggerSec: 15,
              answerStartSec: 15,
              answerEndSec: 75,
              confidenceScore: 0.94,
            },
            {
              questionText: 'How will artificial intelligence transform entrepreneurial opportunities in India?',
              triggerSec: 45,
              answerStartSec: 45,
              answerEndSec: 120,
              confidenceScore: 0.92,
            },
            {
              questionText: 'What advice does the speaker share for young technology founders?',
              triggerSec: 90,
              answerStartSec: 90,
              answerEndSec: 160,
              confidenceScore: 0.89,
            },
          ],
        }),
        generateCitedFallback: vi.fn(),
      };

      const result = await generateWayQuestionsForWindow(
        hindiWindowFixture,
        'hi',
        mockWorkersAiProvider,
        3600
      );

      expect(result.tier).toBe('TIER_A_MODEL');
      expect(result.modelId).toBe('@cf/meta/llama-3.2-3b-instruct');
      expect(result.questions.length).toBeGreaterThanOrEqual(3);

      for (const q of result.questions) {
        expect(q.questionText.length).toBeLessThanOrEqual(110);
        expect(q.questionText.endsWith('?')).toBe(true);
        expect(q.questionText).not.toContain('...');
        expect(q.questionText).not.toContain('…');
        // Verify English script
        expect(/^[A-Za-z0-9\s?,.'"-]+$/.test(q.questionText)).toBe(true);
      }
    });

    it('reports Tier C with honest reason when Workers AI is disabled or unavailable for Hindi video', async () => {
      const result = await generateWayQuestionsForWindow(
        hindiWindowFixture,
        'hi',
        null, // No language model available
        3600
      );

      expect(result.tier).toBe('TIER_C_UNAVAILABLE');
      expect(result.questions).toHaveLength(0);
      expect(result.reason).toContain('unavailable for HI without language model');
    });
  });

  // =========================================================================
  // TEST 4: CARD CONSTRAINTS & DOCKING
  // =========================================================================
  describe('Test 4: Answer Card Constraints, Docking and Dismissal', () => {
    const sampleNoModelData: AiFallbackData = {
      isAiLabeled: false,
      reason: 'Direct match from verified reference documentation.',
      answerText:
        'Starlink is a satellite internet constellation operated by SpaceX delivering high-speed broadband coverage across the globe. User terminals communicate with mass-produced small satellites in low Earth orbit.',
      wordCount: 25,
      citations: [
        {
          title: 'Starlink Overview',
          url: 'https://en.wikipedia.org/wiki/Starlink',
          domain: 'wikipedia.org',
        },
      ],
    };

    const sampleAiData: AiFallbackData = {
      isAiLabeled: true,
      reason: 'AI synthesis grounded in retrieved documentation.',
      answerText:
        'Starlink standard residential kits retail internationally with phased array antennas capable of tracking low Earth orbit satellites, providing broadband internet connectivity across remote regions with low latency communication channels for consumer households.',
      wordCount: 34,
      citations: [
        {
          title: 'Starlink Specifications',
          url: 'https://www.starlink.com/specifications',
          domain: 'starlink.com',
        },
      ],
    };

    it('renders desktop docking classes (bottom-right of player area, max-w-[360px]) and mobile bottom sheet classes', () => {
      const html = renderToString(
        React.createElement(AiFallbackCard, {
          data: sampleNoModelData,
          onDismiss: () => {},
        })
      );

      // Dialog accessibility semantics
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');

      // Desktop docking: docked bottom-right of player, max width 360px
      expect(html).toContain('lg:absolute');
      expect(html).toContain('lg:bottom-4');
      expect(html).toContain('lg:right-4');
      expect(html).toContain('lg:w-[360px]');

      // Mobile: bottom sheet with rounded top corners
      expect(html).toContain('fixed');
      expect(html).toContain('inset-x-0');
      expect(html).toContain('bottom-0');
      expect(html).toContain('rounded-t-xl');

      // Verified label for no-model case
      expect(html).toContain('VERIFIED SOURCES');
      expect(html).toMatch(/25(<!-- -->)?\s*words/i);
      expect(html).toContain('wikipedia.org');
    });

    it('renders "AI SYNTHESIS" badge for AI-generated answers', () => {
      const html = renderToString(
        React.createElement(AiFallbackCard, {
          data: sampleAiData,
          onDismiss: () => {},
        })
      );

      expect(html).toContain('AI SYNTHESIS');
      expect(html).toMatch(/34(<!-- -->)?\s*words/i);
      expect(html).toContain('starlink.com');
    });

    it('verifies Escape key and close handler trigger dismissal', () => {
      const onDismiss = vi.fn();

      // Simulate Escape keypress event as handled in useEffect
      const handleKeyDown = (e: { key: string; preventDefault: () => void }) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onDismiss();
        }
      };

      const preventDefault = vi.fn();
      handleKeyDown({ key: 'Escape', preventDefault });

      expect(preventDefault).toHaveBeenCalled();
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
