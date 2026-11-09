import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');
import { usePlaybackStore, AnswerClip } from '../../src/client/stores/playbackStore';
import {
  generateTierBKeyphraseQuestions,
  validateWayQuestion,
  generateTierAModelQuestions,
} from '../../src/worker/services/way-generator';
import { QueryOrchestrator } from '../../src/worker/services/query';
import { SearchOrchestrator } from '../../src/worker/search/orchestrator';
import { SpeechWindow } from '../../src/worker/transcript/types';
import { buildDiveDeeperQuery } from '../../src/worker/search/query-rewriter';
import { formatSpeechUtterance } from '../../src/client/utils/speech-formatter';

describe('Audit Fixes Acceptance Tests (Steps 1 to 7)', () => {
  // =========================================================================
  // BUG 1: Stop the Insert Crash (Schema & Tiers)
  // =========================================================================
  describe('Bug 1: way_questions Table Rebuild & Tier Storage', () => {
    it('accepts TIER_A_MODEL and TIER_B_KEYPHRASE in source_type, rejecting invalid strings', () => {
      const db = new DatabaseSync(':memory:');
      const initialSql = fs.readFileSync('migrations/0001_initial_schema.sql', 'utf8');
      db.exec(initialSql);

      // Check if migration 0003 exists and apply it
      const migrationFile = 'migrations/0003_rebuild_way_questions_tiers.sql';
      expect(fs.existsSync(migrationFile), 'Migration 0003 must exist').toBe(true);

      const migrationSql = fs.readFileSync(migrationFile, 'utf8');
      db.exec(migrationSql);

      // Seed a parent video row
      db.exec(`INSERT INTO videos (video_id, title, channel_title, duration_sec, caption_status, window_count)
               VALUES ('test_vid', 'Test Title', 'Test Channel', 300, 'READY', 2)`);

      const insertStmt = db.prepare(`
        INSERT INTO way_questions (
          id, video_id, window_index, question_text, normalized_q,
          trigger_sec, answer_video_id, answer_start_sec, answer_end_sec,
          confidence_score, source_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // TIER_A_MODEL must succeed
      expect(() => {
        insertStmt.run(
          'wq_1', 'test_vid', 0, 'What is Tier A?', 'what is tier a',
          10, 'test_vid', 10, 25, 0.95, 'TIER_A_MODEL'
        );
      }).not.toThrow();

      // TIER_B_KEYPHRASE must succeed
      expect(() => {
        insertStmt.run(
          'wq_2', 'test_vid', 0, 'What is Tier B?', 'what is tier b',
          20, 'test_vid', 20, 35, 0.90, 'TIER_B_KEYPHRASE'
        );
      }).not.toThrow();

      // PREDICTED must still succeed
      expect(() => {
        insertStmt.run(
          'wq_3', 'test_vid', 0, 'What is Predicted?', 'what is predicted',
          30, 'test_vid', 30, 45, 0.90, 'PREDICTED'
        );
      }).not.toThrow();

      // Invalid tier must fail the CHECK constraint
      expect(() => {
        insertStmt.run(
          'wq_4', 'test_vid', 0, 'What is Invalid?', 'what is invalid',
          40, 'test_vid', 40, 55, 0.90, 'INVALID_UNKNOWN_TIER'
        );
      }).toThrow(/CHECK constraint failed/);
    });
  });

  // =========================================================================
  // BUG 2: Playhead Sync in Zustand Store
  // =========================================================================
  describe('Bug 2: Playhead Synchronization in Playback Store', () => {
    beforeEach(() => {
      usePlaybackStore.setState({
        currentVideo: {
          videoId: 'Rni7Fz7208c',
          title: 'Musk x Kamath',
          channelTitle: 'Nikhil Kamath',
          thumbnailUrl: '',
          durationSec: 6846,
          captionStatus: 'READY',
          windowCount: 34,
        },
        currentTime: 6845.0, // initial time at 01:54:05
        callStack: [],
        activeAnswerClip: null,
      });
    });

    it('sets currentTime to seek target on pushBranch, popBranch and returnToRoot', () => {
      const store = usePlaybackStore.getState();

      const clipJump: AnswerClip = {
        videoId: 'Rni7Fz7208c',
        videoTitle: 'Musk x Kamath',
        channelTitle: 'Nikhil Kamath',
        startSec: 2025.0, // 33:45
        endSec: 2085.0,
        isExternalVideo: false,
        breadcrumbSummary: 'Elon discussion at 33:45',
      };

      // 1. pushBranch should update currentTime to clip.startSec (2025.0)
      store.pushBranch('Question branching to 33:45', clipJump);
      let state = usePlaybackStore.getState();
      expect(state.callStack.length).toBe(1);
      expect(state.callStack[0].returnTimestamp).toBe(6843.0); // 6845 - 2s
      expect(state.currentTime).toBe(2025.0); // MUST be updated to seek target

      // 2. popBranch should update currentTime to returnTimestamp (6843.0)
      store.popBranch();
      state = usePlaybackStore.getState();
      expect(state.callStack.length).toBe(0);
      expect(state.currentTime).toBe(6843.0); // MUST be restored to returnTimestamp

      // 3. returnToRoot should restore root returnTimestamp
      usePlaybackStore.setState({ currentTime: 500.0 });
      store.pushBranch('Branch 1', { ...clipJump, startSec: 1000.0 });
      expect(usePlaybackStore.getState().currentTime).toBe(1000.0);
      store.returnToRoot();
      expect(usePlaybackStore.getState().currentTime).toBe(498.0); // 500 - 2s
    });
  });

  // =========================================================================
  // BUG 3: Question Quality (Tier A validation & Tier B fragment rejection)
  // =========================================================================
  describe('Bug 3: Question Quality & Fragment Rejection', () => {
    it('validates question length <= 110, ends with ?, no timestamps, no ellipsis', () => {
      expect(validateWayQuestion('What about Starlink?')).toBe(true);
      // Exceeds 110 chars
      expect(validateWayQuestion('What do they say about ' + 'very long question '.repeat(10) + '?')).toBe(false);
      // Does not end with ?
      expect(validateWayQuestion('What about Starlink')).toBe(false);
      // Ellipsis
      expect(validateWayQuestion('What about Starlink...?')).toBe(false);
      // Contains timestamp
      expect(validateWayQuestion('What about Starlink at 110:57?')).toBe(false);
    });

    it('rejects fragments ("theres", "some major", "point increasing") and produces clean noun phrases', () => {
      const dirtyWindow: SpeechWindow = {
        windowIndex: 0,
        startSec: 44.5,
        endSec: 219.1,
        cuesJson: JSON.stringify([
          { t: 149.6, d: 3.0, w: 'essentially what percentage' },
          { t: 165.4, d: 2.0, w: 'theres some major' },
          { t: 165.7, d: 2.0, w: 'some major event' },
          { t: 195.6, d: 2.0, w: 'theres theres certainly' },
          { t: 202.9, d: 2.0, w: 'point increasing amounts' },
          { t: 205.0, d: 4.0, w: 'young entrepreneurs building innovative technology companies' },
        ]),
      };

      const questions = generateTierBKeyphraseQuestions(dirtyWindow);

      // Must not generate questions with conversational fragments
      for (const q of questions) {
        const text = q.questionText.toLowerCase();
        expect(text).not.toContain('theres');
        expect(text).not.toContain('some major');
        expect(text).not.toContain('point increasing');
        expect(text).not.toContain('essentially what percentage');
        expect(validateWayQuestion(q.questionText)).toBe(true);
      }

      // Should retain clear topic
      expect(questions.some((q) => q.questionText.toLowerCase().includes('entrepreneurs'))).toBe(true);
    });
  });

  // =========================================================================
  // BUG 4: In-Video Relevance & Generic-Word Matching
  // =========================================================================
  describe('Bug 4: In-Video Search Strict Relevance & NOT_DISCUSSED', () => {
    it('rejects Kamath closing segment (6826-6849) for location query and returns NOT_DISCUSSED', async () => {
      const mockEnv: any = {
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
            all: vi.fn().mockResolvedValue({
              // FTS returns closing credits with "taking", "Elon", etc.
              results: [
                {
                  id: 28,
                  video_id: 'Rni7Fz7208c',
                  window_index: 28,
                  start_sec: 6833.6,
                  end_sec: 6849.7,
                  word_count: 50,
                  plain_text: 'And, thank you so much, Elon, for taking the time. Sometimes, they take these answers out of context.',
                  cues_json: JSON.stringify([
                    { t: 6833.6, d: 1.9, w: 'And, thank you so much, Elon, for taking the time.' },
                    { t: 6843.4, d: 3.0, w: 'Sometimes, they take these answers out of context.' },
                  ]),
                  video_title: 'WTF is with Elon Musk? | Nikhil Kamath | People by WTF Ep 16',
                  channel_title: 'Nikhil Kamath',
                  rank: -6.2,
                },
              ],
            }),
          }),
        },
      };

      const orchestrator = new QueryOrchestrator(mockEnv);
      const res = await orchestrator.ask({
        videoId: 'Rni7Fz7208c',
        currentPlayheadSec: 50,
        questionText: 'location of this podcast taking place',
      });

      // Must not match closing segment (6826 to 6849)
      if (res.answerClip) {
        expect(res.answerClip.startSec).not.toBeCloseTo(6826.8, 0);
        expect(res.answerClip.startSec).not.toBeCloseTo(6843.4, 0);
      }
      // Must return NOT_DISCUSSED
      expect(res.resolutionType).toBe('NOT_DISCUSSED');
      expect(res.clarificationPrompt).toContain('Not discussed in this video');
    });
  });

  // =========================================================================
  // BUG 5: Dive Deeper Query Formulation
  // =========================================================================
  describe('Bug 5: Clean Dive Deeper Query Formulation', () => {
    it('generates query with no digits, no "tell me more", and no "undefined"', () => {
      const originalQuestion = 'Where does Starlink manufacture antennas?';
      const clipSummary = 'Segment answering "starlink antenna manufacturing" (110:57 - 112:30)';
      const transcriptCues = [
        { t: 6657, d: 3, w: 'We build the phased array antennas at our factory in Bastrop Texas.' }
      ];

      const query = buildDiveDeeperQuery(originalQuestion, clipSummary, transcriptCues);

      expect(query).not.toMatch(/\d+/); // No digits (no 11057 11230)
      expect(query.toLowerCase()).not.toContain('tell me more');
      expect(query.toLowerCase()).not.toContain('undefined');
      expect(query.toLowerCase()).toContain('starlink');
    });
  });

  // =========================================================================
  // BUG 6: Answer Card Structured Output & Relevance Filter
  // =========================================================================
  describe('Bug 6: Structured Refusal & Pre-Model Relevance Gate', () => {
    it('returns answerable: false when model indicates refusal and filters irrelevant sources', () => {
      const orchestrator = new SearchOrchestrator({} as any);

      // Relevance check: source must share rare terms with question
      const question = 'Where was this Kamath podcast filmed?';
      const irrelevantSources = [
        { title: 'Tell Me More - Wikipedia', url: 'https://en.wikipedia.org/wiki/Tell_Me_More', snippet: 'NPR radio show hosted by Michel Martin' },
        { title: 'List of Time Team Podcast episodes', url: 'https://en.wikipedia.org/wiki/List_of_Time_Team', snippet: 'Archaeology episodes list' }
      ];

      const relevantSources = orchestrator.filterRelevantSources(question, irrelevantSources);
      expect(relevantSources.length).toBe(0);

      // Structured refusal check
      const refusalModelOutput = {
        answerable: false,
        answer: "I couldn't find any information about the location of this podcast in the provided search results.",
        sourceIds: []
      };

      const grounded = orchestrator.validateStructuredAnswer(refusalModelOutput, irrelevantSources);
      expect(grounded).toBeNull(); // Refusal is not returned as a verified answer
    });
  });

  // =========================================================================
  // BUG 7: Speech Input Populates Text Input Box
  // =========================================================================
  describe('Bug 7: Speech Input Populates Input Field', () => {
    it('sets input field value upon speech recognition release', () => {
      const result = formatSpeechUtterance('elon musk and starlink', 0.92);
      expect(result.text).toBe('elon musk and starlink');
      expect(result.confidence).toBe(0.92);

      const emptyResult = formatSpeechUtterance('', 0);
      expect(emptyResult.placeholder).toBe('Nothing recognized');
    });
  });
});
