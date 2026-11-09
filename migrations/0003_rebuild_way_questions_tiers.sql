-- Migration 0003: Rebuild way_questions table to support TIER_A_MODEL and TIER_B_KEYPHRASE in source_type CHECK constraint
CREATE TABLE IF NOT EXISTS way_questions_new (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    window_index INTEGER NOT NULL CHECK (window_index >= 0),
    language TEXT NOT NULL DEFAULT 'en',
    question_text TEXT NOT NULL,
    normalized_q TEXT NOT NULL,
    trigger_sec REAL NOT NULL CHECK (trigger_sec >= 0),
    answer_video_id TEXT NOT NULL,
    answer_video_title TEXT,
    answer_channel_title TEXT,
    speaker_name TEXT,
    answer_start_sec REAL NOT NULL CHECK (answer_start_sec >= 0),
    answer_end_sec REAL NOT NULL CHECK (answer_end_sec > answer_start_sec),
    confidence_score REAL NOT NULL DEFAULT 0.9 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    source_type TEXT NOT NULL CHECK (source_type IN ('PREDICTED', 'LEARNED_LIVE', 'EMPTY_PLACEHOLDER', 'TIER_A_MODEL', 'TIER_B_KEYPHRASE')) DEFAULT 'PREDICTED',
    moderation_status TEXT NOT NULL CHECK (moderation_status IN ('APPROVED', 'PENDING', 'FLAGGED')) DEFAULT 'APPROVED',
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_hit_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

INSERT INTO way_questions_new (
    id, video_id, window_index, language, question_text, normalized_q,
    trigger_sec, answer_video_id, answer_video_title, answer_channel_title,
    speaker_name, answer_start_sec, answer_end_sec, confidence_score,
    source_type, moderation_status, hit_count, last_hit_at, created_at
)
SELECT 
    id, video_id, window_index, language, question_text, normalized_q,
    trigger_sec, answer_video_id, answer_video_title, answer_channel_title,
    speaker_name, answer_start_sec, answer_end_sec, confidence_score,
    source_type, moderation_status, hit_count, last_hit_at, created_at
FROM way_questions;

DROP TABLE way_questions;

ALTER TABLE way_questions_new RENAME TO way_questions;

CREATE INDEX IF NOT EXISTS idx_way_lookup ON way_questions(video_id, window_index, language, trigger_sec ASC);
CREATE INDEX IF NOT EXISTS idx_way_normalized ON way_questions(video_id, normalized_q);

