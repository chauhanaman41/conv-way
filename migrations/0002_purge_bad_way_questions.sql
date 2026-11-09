-- Migration 0002: Purge heuristic template questions and add failure_reason column if missing
DELETE FROM way_questions WHERE question_text LIKE 'What does the speaker explain regarding%';

