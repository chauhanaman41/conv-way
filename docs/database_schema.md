# Database Schema: Conv-way (Cloudflare D1 / SQLite + FTS5)

## 1. Design Principles
To operate well within Cloudflare D1's free tier limits (5 GB storage, 5,000,000 rows read/day, 100,000 rows written/day):
1. **Window-Level Granularity (Not Line-Level):** Transcripts are stored as **one row per 600–800 word window** rather than one row per 2-second caption line. A 2-hour podcast requires only $\approx 30$ rows instead of $3,600+$ rows, cutting D1 write consumption by $>99\%$.
2. **Zero Dense Vector Bloat:** Full-text search uses SQLite's native **FTS5** extension with `bm25()` ranking plus **Evon v3.3** reranking, keeping storage at $\approx 0.2\text{ MB}$ per 2-hour video.
3. **LRU Cache Eviction:** `last_accessed_at` and `access_count` columns allow automated cleanup of least-recently-used transcripts if database size approaches 4.0 GB.

---

## 2. Entity-Relationship Diagram

```
┌──────────────────────────┐       1:N       ┌───────────────────────────────┐
│          videos          │────────────────▶│      transcript_windows       │
│──────────────────────────│                 │───────────────────────────────│
│ PK video_id (TEXT)       │                 │ PK id (INTEGER)               │
│    title (TEXT)          │                 │ FK video_id (TEXT)            │
│    channel_title (TEXT)  │                 │    window_index (INTEGER)     │
│    duration_sec (INTEGER)│                 │    start_sec (REAL)           │
│    language (TEXT)       │                 │    end_sec (REAL)             │
│    caption_status (TEXT) │                 │    word_count (INTEGER)       │
│    window_count (INTEGER)│                 │    cues_json (TEXT)           │
│    access_count (INTEGER)│                 │    plain_text (TEXT)          │
└────────────┬─────────────┘                 │    rolling_summary (TEXT)     │
             │                               └───────────────┬───────────────┘
             │ 1:N                                           │ 1:1 Mirror
             ▼                                               ▼
┌──────────────────────────┐                 ┌───────────────────────────────┐
│      way_questions       │                 │   transcript_fts (FTS5)       │
│──────────────────────────│                 │───────────────────────────────│
│ PK id (TEXT / UUID)      │                 │    window_id (UNINDEXED)      │
│ FK video_id (TEXT)       │                 │    video_id (UNINDEXED)       │
│    window_index (INTEGER)│                 │    window_index (UNINDEXED)   │
│    language (TEXT)       │                 │    plain_text (INDEXED)       │
│    question_text (TEXT)  │                 └───────────────────────────────┘
│    normalized_q (TEXT)   │
│    trigger_sec (REAL)    │                 ┌───────────────────────────────┐
│    answer_video_id (TEXT)│                 │         credit_ledger         │
│    answer_start_sec(REAL)│                 │───────────────────────────────│
│    answer_end_sec (REAL) │                 │ PK id (INTEGER)               │
│    source_type (TEXT)    │                 │    date_utc (TEXT)            │
│    hit_count (INTEGER)   │                 │    service (TEXT)             │
└──────────────────────────┘                 │    operation (TEXT)           │
                                             │    units_consumed (REAL)      │
┌──────────────────────────┐                 │    estimated_credits (REAL)   │
│      search_cache        │                 │    created_at (TEXT)          │
│──────────────────────────│                 └───────────────────────────────┘
│ PK query_hash (TEXT)     │
│    normalized_query(TEXT)│                 ┌───────────────────────────────┐
│    language (TEXT)       │                 │      calibration_rates        │
│    response_json (TEXT)  │                 │───────────────────────────────│
│    expires_at (TEXT)     │                 │ PK service_op (TEXT)          │
└──────────────────────────┘                 │    credits_per_unit (REAL)    │
                                             │    unit_type (TEXT)           │
                                             │    updated_at (TEXT)          │
                                             └───────────────────────────────┘
```

---

## 3. SQL DDL Migrations (`migrations/0001_initial_schema.sql`)

```sql
PRAGMA foreign_keys = ON;

-- 1. Videos Table: Metadata and transcript readiness state
CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel_title TEXT NOT NULL,
    channel_id TEXT,
    thumbnail_url TEXT,
    duration_sec INTEGER NOT NULL CHECK (duration_sec >= 0),
    language TEXT NOT NULL DEFAULT 'en',
    caption_status TEXT NOT NULL CHECK (caption_status IN ('READY', 'NO_CAPTIONS', 'BUDGET_DEFERRED', 'PENDING')) DEFAULT 'PENDING',
    transcript_provider TEXT CHECK (transcript_provider IN ('SUPADATA', 'TRANSCRIPT_API', 'NONE')) DEFAULT 'NONE',
    window_count INTEGER NOT NULL DEFAULT 0,
    access_count INTEGER NOT NULL DEFAULT 1,
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

-- 3. FTS5 Virtual Table for fast BM25 full-text search across windows
CREATE VIRTUAL TABLE IF NOT EXISTS transcript_fts USING fts5(
    window_id UNINDEXED,
    video_id UNINDEXED,
    window_index UNINDEXED,
    plain_text,
    tokenize = 'porter unicode61'
);

-- Triggers to keep FTS5 synchronized with transcript_windows
CREATE TRIGGER IF NOT EXISTS trg_transcript_windows_ai AFTER INSERT ON transcript_windows BEGIN
    INSERT INTO transcript_fts(rowid, window_id, video_id, window_index, plain_text)
    VALUES (new.id, new.id, new.video_id, new.window_index, new.plain_text);
END;

CREATE TRIGGER IF NOT EXISTS trg_transcript_windows_ad AFTER DELETE ON transcript_windows BEGIN
    DELETE FROM transcript_fts WHERE rowid = old.id;
END;

-- 4. Way Questions Table: Predicted and learned questions + verified answer time ranges
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
    answer_start_sec REAL NOT NULL CHECK (answer_start_sec >= 0),
    answer_end_sec REAL NOT NULL CHECK (answer_end_sec > answer_start_sec),
    confidence_score REAL NOT NULL DEFAULT 0.9 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    source_type TEXT NOT NULL CHECK (source_type IN ('PREDICTED', 'LEARNED_LIVE')) DEFAULT 'PREDICTED',
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_hit_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_way_lookup ON way_questions(video_id, window_index, language, trigger_sec ASC);
CREATE INDEX IF NOT EXISTS idx_way_normalized ON way_questions(video_id, normalized_q);

-- 5. Search & Answer Cache: Shared cache for live queries and YouTube searches
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

-- 6. Credit & Quota Ledger: Tracks every Gnani, Supadata, TranscriptAPI, YouTube, and Web Search call
CREATE TABLE IF NOT EXISTS credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_utc TEXT NOT NULL, -- YYYY-MM-DD
    service TEXT NOT NULL CHECK (service IN ('GNANI_PRISMA', 'GNANI_EVON', 'GNANI_TIMBRE', 'SUPADATA', 'TRANSCRIPT_API', 'YOUTUBE_DATA', 'WEB_SEARCH')),
    operation TEXT NOT NULL,
    units_consumed REAL NOT NULL CHECK (units_consumed >= 0),
    estimated_credits REAL NOT NULL CHECK (estimated_credits >= 0),
    http_status INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_date_service ON credit_ledger(date_utc, service);

-- 7. Calibration Rates Table: Stores empirically measured Gnani credit rates from the calibration batch
CREATE TABLE IF NOT EXISTS calibration_rates (
    service_op TEXT PRIMARY KEY, -- e.g., 'PRISMA_PER_AUDIO_MIN', 'EVON_WAY_WINDOW', 'EVON_RERANK', 'EVON_FALLBACK', 'TIMBRE_PER_CHAR'
    credits_per_unit REAL NOT NULL CHECK (credits_per_unit >= 0),
    unit_type TEXT NOT NULL,
    measured_sample_size INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Seed baseline conservative estimates (updated by /api/admin/calibrate)
INSERT OR IGNORE INTO calibration_rates (service_op, credits_per_unit, unit_type, measured_sample_size) VALUES
    ('PRISMA_PER_AUDIO_MIN', 0.50, 'minutes', 0),
    ('EVON_WAY_WINDOW', 0.25, 'calls', 0),
    ('EVON_RERANK', 0.15, 'calls', 0),
    ('EVON_FALLBACK', 0.20, 'calls', 0),
    ('TIMBRE_PER_100_CHARS', 0.10, '100_chars', 0);
```

---

## 4. Cloudflare KV Key Namespaces
* `trending:top20:global`: Stores the daily JSON array of Top 20 trending podcasts (TTL: `86400` seconds).
* `governor:daily:{YYYY-MM-DD}`: Fast edge snapshot of `{ gnaniCreditsUsed, gnaniDailyCap, ytUnitsUsed, transcriptsFetchedToday }` updated on writes and read by workers in $< 1\text{ ms}$.
* `ratelimit:ip:{hashed_ip}:{minute_bucket}`: Per-viewer abuse prevention counter (TTL: `120` seconds).