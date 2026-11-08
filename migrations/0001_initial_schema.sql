PRAGMA foreign_keys = ON;

-- 1. Videos Table: Tracks metadata, caption status, and ingestion concurrency leases
CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel_title TEXT NOT NULL,
    channel_id TEXT,
    thumbnail_url TEXT,
    duration_sec INTEGER NOT NULL CHECK (duration_sec >= 0),
    language TEXT NOT NULL DEFAULT 'en',
    caption_status TEXT NOT NULL CHECK (caption_status IN ('READY', 'NO_CAPTIONS', 'BUDGET_DEFERRED', 'PENDING', 'PROCESSING', 'FAILED')) DEFAULT 'PENDING',
    transcript_provider TEXT CHECK (transcript_provider IN ('SUPADATA', 'TRANSCRIPT_API', 'NONE')) DEFAULT 'NONE',
    window_count INTEGER NOT NULL DEFAULT 0,
    access_count INTEGER NOT NULL DEFAULT 1,
    lease_expires_at TEXT,
    last_accessed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_lru ON videos(last_accessed_at ASC, access_count ASC);
CREATE INDEX IF NOT EXISTS idx_videos_caption_status ON videos(caption_status);

-- 2. Transcript Windows Table: 600-800 word chunks with timestamped cue arrays
CREATE TABLE IF NOT EXISTS transcript_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    window_index INTEGER NOT NULL CHECK (window_index >= 0),
    start_sec REAL NOT NULL CHECK (start_sec >= 0),
    end_sec REAL NOT NULL CHECK (end_sec >= start_sec),
    word_count INTEGER NOT NULL CHECK (word_count > 0),
    plain_text TEXT NOT NULL,
    -- JSON array of compact cues: [{"t": 1455.2, "d": 3.4, "w": "The physics don't allow..."}]
    cues_json TEXT NOT NULL,
    rolling_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(video_id, window_index),
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_windows_video_time ON transcript_windows(video_id, start_sec, end_sec);

-- 3. External-Content FTS5 Virtual Table (Zero duplicate plain_text storage)
CREATE VIRTUAL TABLE IF NOT EXISTS transcript_fts USING fts5(
    plain_text,
    content='transcript_windows',
    content_rowid='id',
    tokenize = 'porter unicode61 remove_diacritics 2'
);

-- Triggers to maintain external-content FTS5 synchronization
CREATE TRIGGER IF NOT EXISTS trg_transcript_windows_ai AFTER INSERT ON transcript_windows BEGIN
    INSERT INTO transcript_fts(rowid, plain_text) VALUES (new.id, new.plain_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_transcript_windows_ad AFTER DELETE ON transcript_windows BEGIN
    INSERT INTO transcript_fts(transcript_fts, rowid, plain_text) VALUES('delete', old.id, old.plain_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_transcript_windows_au AFTER UPDATE ON transcript_windows BEGIN
    INSERT INTO transcript_fts(transcript_fts, rowid, plain_text) VALUES('delete', old.id, old.plain_text);
    INSERT INTO transcript_fts(rowid, plain_text) VALUES (new.id, new.plain_text);
END;

-- 4. Way Questions Table: Predicted and learned live questions + verified time ranges
CREATE TABLE IF NOT EXISTS way_questions (
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
    source_type TEXT NOT NULL CHECK (source_type IN ('PREDICTED', 'LEARNED_LIVE', 'EMPTY_PLACEHOLDER')) DEFAULT 'PREDICTED',
    moderation_status TEXT NOT NULL CHECK (moderation_status IN ('APPROVED', 'PENDING', 'FLAGGED')) DEFAULT 'APPROVED',
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_hit_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_way_lookup ON way_questions(video_id, window_index, language, trigger_sec ASC);
CREATE INDEX IF NOT EXISTS idx_way_normalized ON way_questions(video_id, normalized_q);

-- 5. Curated Channels Table: Dynamic source for Top 20 Trending Podcast discovery
CREATE TABLE IF NOT EXISTS curated_channels (
    channel_id TEXT PRIMARY KEY,
    channel_title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'podcasts',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    priority INTEGER NOT NULL DEFAULT 10,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_curated_active ON curated_channels(is_active, priority DESC);

-- Seed initial authoritative podcast channels (customizable via admin endpoint)
INSERT OR IGNORE INTO curated_channels (channel_id, channel_title, category, priority) VALUES
    ('UCvQECJukTDE2i6aCoAzS-NQ', 'Nikhil Kamath', 'business_tech', 100),
    ('UCzQUP1qoWDoEbmsQxvdjxgQ', 'Joe Rogan Experience', 'general_discussion', 90),
    ('UCcefcZRL2oaA_TsBiDDJ-tw', 'Lex Fridman', 'technology_science', 95),
    ('UC-lHJZR3Gqxm24_Vd_AJ5Yw', 'PewDiePie', 'culture', 50),
    ('UCnUYZLuoy1rq1aVMwx4aTzw', 'Huberman Lab', 'health_science', 85);

-- 6. Search & Answer Cache: Shared cache for live queries and YouTube searches
CREATE TABLE IF NOT EXISTS search_cache (
    query_hash TEXT PRIMARY KEY,
    normalized_query TEXT NOT NULL,
    video_context_id TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    response_json TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_search_cache_expiry ON search_cache(expires_at);

-- 7. Credit & Quota Ledger: Detailed per-call tracking with hashed client IP defense
CREATE TABLE IF NOT EXISTS credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_utc TEXT NOT NULL, -- YYYY-MM-DD
    ip_hash TEXT NOT NULL,  -- SHA-256(client_ip + IP_HASH_SALT)
    service TEXT NOT NULL CHECK (service IN ('GNANI_PRISMA', 'GNANI_EVON', 'GNANI_TIMBRE', 'SUPADATA', 'TRANSCRIPT_API', 'YOUTUBE_DATA', 'WEB_SEARCH')),
    operation TEXT NOT NULL,
    units_consumed REAL NOT NULL CHECK (units_consumed >= 0),
    estimated_credits REAL NOT NULL CHECK (estimated_credits >= 0),
    http_status INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_date_service ON credit_ledger(date_utc, service);
CREATE INDEX IF NOT EXISTS idx_ledger_ip_date ON credit_ledger(date_utc, ip_hash);

-- 8. Quota & State Counters Table: Fast daily aggregation without KV writes
CREATE TABLE IF NOT EXISTS quota_counters (
    date_utc TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    count_value REAL NOT NULL DEFAULT 0,
    last_updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (date_utc, metric_name)
);

-- 9. Rate Limit Counters Table: Persistent per-IP abuse prevention
CREATE TABLE IF NOT EXISTS rate_limit_counters (
    ip_hash TEXT NOT NULL,
    window_bucket TEXT NOT NULL, -- e.g., '2026-11-08T07:20' (minute) or '2026-11-08' (daily)
    endpoint_category TEXT NOT NULL, -- 'INIT_TRANSCRIPT', 'ASK_QUERY', 'VOICE_TRANSCRIBE'
    request_count INTEGER NOT NULL DEFAULT 1,
    credits_used REAL NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (ip_hash, window_bucket, endpoint_category)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_expiry ON rate_limit_counters(expires_at);

-- 10. Calibration Rates Table: Stores empirical credit costs and latency percentiles
CREATE TABLE IF NOT EXISTS calibration_rates (
    service_op TEXT PRIMARY KEY, -- 'PRISMA_PER_AUDIO_MIN', 'EVON_WAY_WINDOW', 'EVON_RERANK', 'EVON_FALLBACK', 'TIMBRE_PER_100_CHARS'
    credits_per_unit REAL NOT NULL CHECK (credits_per_unit >= 0),
    unit_type TEXT NOT NULL,
    p50_latency_ms INTEGER NOT NULL DEFAULT 0,
    p95_latency_ms INTEGER NOT NULL DEFAULT 0,
    measured_sample_size INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Standardized baseline seeds (updated by /api/admin/calibrate)
INSERT OR IGNORE INTO calibration_rates (service_op, credits_per_unit, unit_type, p50_latency_ms, p95_latency_ms, measured_sample_size) VALUES
    ('PRISMA_PER_AUDIO_MIN', 0.50, 'minutes', 450, 950, 0),
    ('EVON_WAY_WINDOW', 0.25, 'calls', 680, 1400, 0),
    ('EVON_RERANK', 0.15, 'calls', 320, 750, 0),
    ('EVON_FALLBACK', 0.20, 'calls', 510, 1100, 0),
    ('TIMBRE_PER_100_CHARS', 0.10, '100_chars', 400, 850, 0);

-- 11. System Observability & Metrics Table: Real data telemetry for SLA tracking
CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK (event_type IN ('PLAYBACK_RESTORE', 'HAND_BACK_DECISION', 'WRONG_HIT_REPORT', 'QUERY_RESOLVED', 'CACHE_HIT', 'TRANSCRIPT_FETCH', 'RATE_LIMITED')),
    video_id TEXT,
    session_query_id TEXT,
    details_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type_time ON system_events(event_type, created_at DESC);

