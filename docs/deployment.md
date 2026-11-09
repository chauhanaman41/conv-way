# Conv-way Cloudflare Free Plan Deployment & Production Runbook

This document details the configuration, limits, deployment procedure, and operational guardrails for running Conv-way on Cloudflare's Free Plan as a single Worker serving both the Vite React SPA and the Hono edge API.

---

## 1. Cloudflare Free Plan Limits Reference & Enforcement

Every limit below was verified against current Cloudflare documentation. Conv-way enforces these limits internally to guarantee operation entirely within the free tier without unexpected failures or billable overages.

| Feature / Resource | Free Plan Limit | Canonical Documentation Source | App Enforcement & Guardrails |
| :--- | :--- | :--- | :--- |
| **Worker Requests** | 100,000 req / day (resets 00:00 UTC) | [Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/) | Rate-limiter middleware on `/api/query`, `/api/voice`, `/init`, and `/way`. 24-hour KV edge cache for top 20 catalog. |
| **Worker CPU Time** | 10 ms CPU time per invocation | [Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/) | Pure JS execution measured at ~2.8 ms CPU time on 1,876-cue transcripts. Static assets served directly from edge cache without CPU cost. |
| **Worker Subrequests** | 50 subrequests per invocation | [Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/) | Maximum 1 external call for `/init`, bounded 2-pass search (`SEARCH_MAX_PER_QUESTION=2`), 1 AI call. Total subrequests per request ≤ 3. |
| **Wall-Clock Duration** | No hard limit for active HTTP connections | [Workers Platform Limits](https://developers.cloudflare.com/workers/platform/limits/) | Client streaming and bounded external timeouts (Supadata 10s timeout, search 8s timeout). |
| **Static Assets** | Free & unmetered bandwidth; max 25 MiB/file; 20k files/version | [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) | SPA bundle total size is ~275 KiB (HTML: 1.4 kB, CSS: 29.8 kB, JS: 244.8 kB). 3 asset files total in `./dist`. |
| **D1 Storage** | 5 GB total account storage; 500 MB max per DB | [D1 Platform Limits](https://developers.cloudflare.com/d1/platform/limits/) | `D1_STORAGE_LIMIT_MB = "400"` in `wrangler.toml` (100 MB safety buffer below the 500 MB database ceiling). |
| **D1 Rows Read** | 5,000,000 rows / day | [D1 Platform Limits](https://developers.cloudflare.com/d1/platform/limits/) | Indexed queries on `video_id`, `window_index`, `playhead_start`; tokenized FTS5 index scans. |
| **D1 Rows Written** | 100,000 rows / day | [D1 Platform Limits](https://developers.cloudflare.com/d1/platform/limits/) | `DAILY_TRANSCRIPT_FETCH_BUDGET = "5"` caps new video transcript ingestions per day (~1,250 window inserts max/day). |
| **D1 FTS5 Support** | Native SQLite FTS5 module enabled | [D1 Platform Limits](https://developers.cloudflare.com/d1/platform/limits/) | `transcript_fts` virtual table created and queried using SQLite `MATCH`. |
| **KV Storage** | 1 GB total storage | [Workers KV Limits](https://developers.cloudflare.com/kv/platform/limits/) | Top 20 cache is ~15 KB; quota counters < 100 bytes each. Total KV footprint < 1 MB. |
| **KV Reads** | 100,000 reads / day | [Workers KV Limits](https://developers.cloudflare.com/kv/platform/limits/) | 24-hour cache TTL on top 20 trending list; local client storage reduces redundant fetches. |
| **KV Writes** | 1,000 writes / day (1 write/sec per key) | [Workers KV Limits](https://developers.cloudflare.com/kv/platform/limits/) | Top 20 refresh writes once daily via scheduled cron; daily neuron counter writes lazily. |
| **Cron Triggers** | Up to 3 triggers per Worker; 1-min min interval (UTC) | [Cron Triggers Limits](https://developers.cloudflare.com/workers/configuration/cron-triggers/) | Exactly 1 cron configured: `crons = ["0 2 * * *"]` (executes daily at 02:00 UTC). |
| **Workers AI Neurons** | 10,000 Neurons / day (hard cap on Free plan) | [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) | `@cf/meta/llama-3.2-3b-instruct` (~15–20 neurons/inference). Daily KV neuron tracker steps down to no-model path at 9,500 neurons. |

---

## 2. Deployment Architecture in `wrangler.toml`

```toml
name = "conv-way"
main = "src/worker/index.ts"
compatibility_date = "2026-11-01"
compatibility_flags = ["nodejs_compat"]

# Single Worker serves Vite React SPA as static edge assets with SPA fallback
assets = { directory = "./dist", binding = "ASSETS", not_found_handling = "single-page-application" }

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "conv-way-db"
database_id = "da3713e6-2633-4a94-8302-2c9ce69f13a7"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "KV"
id = "b120d3e40511405aa6c900052222849f"
preview_id = "feeaa401eda844a2af7d1e0019bd6782"

[triggers]
# Daily at 02:00 UTC: Refresh Top 20 Trending Podcasts & clean expired counters
crons = ["0 2 * * *"]

[vars]
ENVIRONMENT = "production"
GNANI_TOTAL_CREDIT_BUDGET = "3000"
GNANI_BUDGET_END_DATE = "2026-12-15"
GNANI_RESERVE_RATIO = "0.10"
YOUTUBE_DAILY_SEARCH_BUDGET = "90"
DAILY_TRANSCRIPT_FETCH_BUDGET = "5"
D1_STORAGE_LIMIT_MB = "400"
SEARCH_ORDER_TRUSTED = "google_cse,tavily,exa"
SEARCH_ORDER_OPEN = "tavily,exa"
SEARCH_MAX_PER_QUESTION = "2"
SEARCH_DAILY_CAP = "30"
GOOGLE_CSE_ENABLED = "true"
GOOGLE_CSE_SUNSET = "2027-01-01"
GOOGLE_CSE_DAILY_CAP = "90"
SEARCH_CACHE_TTL_DAYS = "7"
LLM_WORKERS_AI_ENABLED = "true"
LLM_PROVIDER_ORDER = "workers_ai,evon"
WORKERS_AI_MODEL = "@cf/meta/llama-3.2-3b-instruct"
```

---

## 3. Owner Deployment Steps

The owner executes these commands in terminal. No API secrets are hardcoded in git.

### Step 1: Cloudflare Authentication
```bash
npx wrangler login
```
*(Verify account with `npx wrangler whoami`)*

### Step 2: D1 Database Setup (Already Created)
If not created yet:
```bash
npx wrangler d1 create conv-way-db
```
Apply migrations to remote D1:
```bash
npx wrangler d1 migrations apply conv-way-db --remote
```

### Step 3: Workers KV Namespace Setup (Already Created)
If not created yet:
```bash
npx wrangler kv namespace create CONV_WAY_KV
```

### Step 4: Configure Production Secrets
Set each secret via Wrangler (refer to `scripts/list-secrets.md`):
```bash
# Core Flow Required Secrets
npx wrangler secret put YOUTUBE_DATA_API_KEY
npx wrangler secret put SUPADATA_API_KEY
npx wrangler secret put TRANSCRIPT_API_FALLBACK_KEY
npx wrangler secret put ADMIN_CALIBRATION_SECRET
npx wrangler secret put IP_HASH_SALT

# Optional Search & Speech Secrets
npx wrangler secret put TAVILY_API_KEY
npx wrangler secret put EXA_API_KEY
npx wrangler secret put GNANI_API_KEY
npx wrangler secret put WEB_SEARCH_API_KEY
npx wrangler secret put WEB_SEARCH_CX
```

### Step 5: Build Bundle
```bash
npm run build
```

### Step 6: Deploy to Cloudflare
```bash
npx wrangler deploy
```

---

## 4. Post-Deployment Verification Checklist

1. **SPA & Homepage Loading:**
   - Open `https://conv-way.<your-subdomain>.workers.dev`.
   - Ensure the navbar, brand title "CONV-WAY", and Top 20 trending list render cleanly.
   - Verify browser DevTools console has 0 errors.
   - Verify `?debug=1` does NOT open the debug telemetry drawer in production without an admin key.

2. **Video & Way Panel State:**
   - Click on an indexed video or paste a YouTube URL.
   - Verify `GET /api/videos/:id/state` returns valid JSON with `captionStatus: "READY"` and `windowCount > 0`.
   - Confirm Way questions load in English in the side panel.

3. **In-Video Search & Grounded Web Search:**
   - Ask an in-video question: Verify the relevant timestamp clip plays with the small player docked.
   - Ask an out-of-video question: Verify the card returns "Not discussed in this video" or a grounded 30–40 word answer with source links.

4. **Security & Admin Route Protection:**
   - Request `GET /api/admin/calibration` without `X-Admin-Calibration-Key`. Expect HTTP 401 Unauthorized.
   - Request `POST /api/admin/calibrate` without secret. Expect HTTP 401 Unauthorized.

---

## 5. Budget Guardrails & What Happens When Limits Are Hit

| Limit Hit | App Behavior & Honest Message | Recovery Action |
| :--- | :--- | :--- |
| **Daily Transcript Budget (5 / day)** | `/init` returns HTTP 429 with `captionStatus: "BUDGET_DEFERRED"`. UI displays: *"Daily transcript budget limit reached (5 new transcripts per day). Try again tomorrow."* | Resets automatically at 00:00 UTC. Previously indexed videos continue to work without consuming budget. |
| **Workers AI Neurons (10,000 / day)** | KV tracker blocks AI runs at 9,500 neurons. Way questions automatically fall back to Tier B keyphrase stems. Search questions fall back to clean 20–30 word summaries. | Resets automatically at 00:00 UTC. |
| **Search Daily Cap (30 queries / day)** | Search orchestrator returns cached results if available, or returns `answerable: false` with notice: *"Search quota exceeded for today."* | Resets at 00:00 UTC, or owner can adjust `SEARCH_DAILY_CAP` in `wrangler.toml`. |
| **Rate Limiter (e.g. 15 queries / min)** | Returns HTTP 429 with `Retry-After` header and message: *"Rate limit exceeded. Please wait X seconds before retrying."* | Client waits for the rate limit window to expire. |
| **D1 Storage Limit (400 MB)** | System logs warning in D1 `system_events`. Ingestion halts to prevent database lockup. | Clean up old transcript windows or upgrade to Workers Paid ($0.75/GB-mo). |

