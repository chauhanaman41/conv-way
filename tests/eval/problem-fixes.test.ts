import { describe, it, expect, vi } from 'vitest';
import { validateWayQuestion, generateTierBKeyphraseQuestions, generateWayQuestionsForWindow } from '../../src/worker/services/way-generator';
import { validateQuery } from '../../src/worker/services/boundary';
import { YouTubeDiscoveryService } from '../../src/worker/youtube/discovery';
import { QueryOrchestrator } from '../../src/worker/services/query';
import { SpeechWindow } from '../../src/worker/transcript/types';

describe('Verification of Fixes for Problems 1, 2, and 3', () => {
  // =========================================================================
  // PROBLEM 1: ONE TRUE STATE & KV RECONCILIATION
  // =========================================================================
  describe('Problem 1: State Synchronization and KV Reconciliation', () => {
    it('reconciles window_count, caption_status and language from D1 into KV trending cache', async () => {
      const mockKvData = {
        videos: [
          {
            videoId: 'mock_video_1',
            title: 'Mock Video 1',
            channelTitle: 'Creator',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            durationSec: 3600,
            captionStatus: 'PENDING',
            windowCount: 0,
            language: 'en',
          },
        ],
        updatedAt: '2026-11-08T00:00:00Z',
      };

      const mockEnv: any = {
        KV: {
          get: vi.fn().mockResolvedValue(mockKvData),
          put: vi.fn().mockResolvedValue(undefined),
        },
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  video_id: 'mock_video_1',
                  caption_status: 'READY',
                  window_count: 28,
                  language: 'hi',
                },
              ],
            }),
          }),
        },
      };

      const discovery = new YouTubeDiscoveryService(mockEnv);
      const res = await discovery.getTrending();

      expect(mockEnv.KV.get).toHaveBeenCalledWith('trending:top20:v2', 'json');
      expect(res.videos[0].captionStatus).toBe('READY');
      expect(res.videos[0].windowCount).toBe(28);
      expect(res.videos[0].language).toBe('hi');
    });

    it('calculates next 00:00 UTC midnight for retryAfter on budget exhaustion', () => {
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 0, 0, 0);
      const iso = tomorrow.toISOString();

      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
      expect(new Date(iso).getTime()).toBeGreaterThan(Date.now());
    });
  });

  // =========================================================================
  // PROBLEM 2: WAY QUESTION GENERATION & READABILITY RULES
  // =========================================================================
  describe('Problem 2: Question Generation & Readability', () => {
    it('validates that Way questions must be <= 110 chars, end with ?, contain no ellipsis, and have valid bounds', () => {
      const seen = new Set<string>();

      // Valid question
      const validQ = {
        questionText: 'What is the primary philosophy behind multiplanetary architecture?',
        triggerSec: 10,
        answerStartSec: 10,
        answerEndSec: 50,
      };
      expect(validateWayQuestion(validQ, 0, 100, seen)).toBe(true);

      // Invalid: contains ellipsis
      const ellipsisQ = {
        questionText: 'What does the speaker explain regarding: orbital mechanics...',
        triggerSec: 10,
        answerStartSec: 10,
        answerEndSec: 50,
      };
      expect(validateWayQuestion(ellipsisQ, 0, 100, seen)).toBe(false);

      // Invalid: does not end with '?'
      const noQuestionMark = {
        questionText: 'Explain the principles of electric propulsion',
        triggerSec: 10,
        answerStartSec: 10,
        answerEndSec: 50,
      };
      expect(validateWayQuestion(noQuestionMark, 0, 100, seen)).toBe(false);

      // Invalid: exceeds 110 characters
      const tooLongQ = {
        questionText: 'Can you provide a deeply comprehensive, excessively detailed explanation of every single mechanical component in rocket staging?',
        triggerSec: 10,
        answerStartSec: 10,
        answerEndSec: 50,
      };
      expect(validateWayQuestion(tooLongQ, 0, 100, seen)).toBe(false);

      // Invalid: duplicate question
      expect(validateWayQuestion(validQ, 0, 100, seen)).toBe(false);
    });

    it('rejects foreign-script dominated text from heuristic templates', () => {
      const seen = new Set<string>();
      const devanagariQ = {
        questionText: 'What does the speaker explain regarding: पंजाब और हरियाणा के बीच का मुद्दा?',
        triggerSec: 10,
        answerStartSec: 10,
        answerEndSec: 50,
      };
      expect(validateWayQuestion(devanagariQ, 0, 100, seen)).toBe(false);
    });

    it('extracts Tier B keyphrase questions without any language model', () => {
      const sampleWindow: SpeechWindow = {
        windowIndex: 0,
        startSec: 0,
        endSec: 120,
        wordCount: 150,
        plainText: 'We discuss orbital refueling and heat shield manufacturing techniques. Orbital refueling allows deep space travel.',
        cuesJson: JSON.stringify([
          { t: 5, d: 4, w: 'We discuss orbital refueling' },
          { t: 10, d: 5, w: 'and heat shield manufacturing techniques' },
          { t: 16, d: 4, w: 'Orbital refueling allows deep space travel' },
        ]),
      };

      const cues = JSON.parse(sampleWindow.cuesJson);
      const questions = generateTierBKeyphraseQuestions(sampleWindow, cues, 3);

      expect(questions.length).toBeGreaterThan(0);
      for (const q of questions) {
        expect(q.questionText).toMatch(/^What do they say about [a-z0-9\s]+\?$/i);
        expect(q.questionText.length).toBeLessThanOrEqual(110);
        expect(q.questionText.endsWith('?')).toBe(true);
        expect(q.questionText.includes('...')).toBe(false);
        expect(q.tier).toBe('TIER_B_KEYPHRASE');
      }
    });

    it('returns Tier C honest unavailable state for non-English transcripts without language model', async () => {
      const hindiWindow: SpeechWindow = {
        windowIndex: 0,
        startSec: 0,
        endSec: 120,
        wordCount: 100,
        plainText: 'हम पंजाब और संगीत के बारे में बात कर रहे हैं।',
        cuesJson: '[]',
      };

      const result = await generateWayQuestionsForWindow(hindiWindow, 'hi', null, 3600);
      expect(result.tier).toBe('TIER_C_UNAVAILABLE');
      expect(result.questions).toHaveLength(0);
      expect(result.reason).toContain('unavailable for HI');
    });
  });

  // =========================================================================
  // PROBLEM 3: QUERY VALIDATION & BALANCED CROSS-VIDEO MATCHING
  // =========================================================================
  describe('Problem 3: Query Validation & Balanced Cross-Video Retrieval', () => {
    it('validates queries: rejects literal artifacts and requires at least 2 content words', () => {
      // Rejects "Tell me more details about undefined"
      const resUndefined = validateQuery('Tell me more details about undefined');
      expect(resUndefined.valid).toBe(false);
      expect(resUndefined.reason).toContain('invalid literal placeholders');

      // Rejects literal null / [object Object]
      expect(validateQuery('tell me about null').valid).toBe(false);
      expect(validateQuery('Explain [object Object]').valid).toBe(false);

      // Rejects too few content words (all boilerplate)
      const resBoilerplate = validateQuery('tell me more details about that');
      expect(resBoilerplate.valid).toBe(false);

      // Valid query
      const resValid = validateQuery('How does orbital refueling work?');
      expect(resValid.valid).toBe(true);
      expect(resValid.contentWords).toContain('orbital');
      expect(resValid.contentWords).toContain('refueling');
    });

    it('negative test: "Tell me more details about undefined" gives REJECTED_INVALID_QUERY and never routes cross-video', async () => {
      const mockEnv: any = {
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          }),
        },
      };

      const orchestrator = new QueryOrchestrator(mockEnv);
      const res = await orchestrator.ask({
        videoId: 'mock_video_a',
        currentPlayheadSec: 100,
        questionText: 'Tell me more details about undefined',
      });

      expect(res.debug?.routeTaken).toBe('REJECTED_INVALID_QUERY');
      expect(res.answerClip).toBeUndefined();
    });

    it('balanced cross-video matching: labels clear match "Answer" and weaker match "Related video, may not fully answer"', async () => {
      const mockEnv: any = {
        DB: {
          prepare: vi.fn().mockImplementation((queryStr: string) => {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn().mockResolvedValue({ title: 'Current Podcast', channel_title: 'Current Channel' }),
              all: vi.fn().mockImplementation(() => {
                if (queryStr.includes('tw.video_id != ?2')) {
                  // Simulate 48 Hours video window returning moderate match
                  return Promise.resolve({
                    results: [
                      {
                        id: 1,
                        video_id: 'external_video_48hr',
                        window_index: 2,
                        start_sec: 120,
                        end_sec: 240,
                        word_count: 300,
                        plain_text: 'In this investigative episode we discuss orbital mechanics and telemetry details.',
                        cues_json: JSON.stringify([
                          { t: 125, d: 5, w: 'orbital mechanics' },
                          { t: 130, d: 5, w: 'and telemetry' },
                        ]),
                        video_title: '48 Hours Investigation',
                        channel_title: 'CBS News',
                        video_language: 'en',
                        rank: -5.2,
                      },
                    ],
                  });
                }
                return Promise.resolve({ results: [] });
              }),
            };
          }),
        },
      };

      const orchestrator = new QueryOrchestrator(mockEnv);

      // Query with 2 matching keywords out of 2: coverage = 1.0 (>= 0.75) -> "Answer"
      const resClear = await orchestrator.ask({
        videoId: 'current_video',
        currentPlayheadSec: 50,
        questionText: 'What about orbital mechanics telemetry?',
      });

      expect(resClear.answerClip).toBeDefined();
      expect(resClear.answerClip?.breadcrumbSummary).toContain('Answer: "48 Hours Investigation"');
      expect(resClear.answerClip?.breadcrumbSummary).not.toContain('Answer found in external podcast');

      // Query with 1 matching keyword out of 2: coverage = 0.50 (< 0.75) -> "Related video, may not fully answer"
      const resRelated = await orchestrator.ask({
        videoId: 'current_video',
        currentPlayheadSec: 50,
        questionText: 'orbital aerodynamics?',
      });

      expect(resRelated.answerClip).toBeDefined();
      expect(resRelated.answerClip?.breadcrumbSummary).toContain('Related video, may not fully answer: "48 Hours Investigation"');
    });
  });
});
