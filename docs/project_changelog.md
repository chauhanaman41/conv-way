# Changelog: Conv-way

All notable architectural, documentation, and implementation changes to the Conv-way project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-11-08
### Added
* **End-to-End Backend Edge Worker (`src/worker/`):**
  * Built complete Hono REST application mounting `/api/discovery/trending`, `/api/discovery/search`, `/api/videos/resolve`, `/api/videos/:videoId/init`, `/api/videos/:videoId/status`, `/api/videos/:videoId/way`, `/api/videos/:videoId/way/:questionId`, `/api/query/ask`, `/api/voice/transcribe`, `/api/system/status`, `/api/admin/calibrate`, and `/api/admin/warm`.
  * Implemented HMAC-SHA256 salted IP hashing and D1-backed rate limiting middleware (`rate_limit_counters`).
  * Implemented 4-Tier Credit Governor (`GovernorService`) with daily cap formula ($3,000$ credits pool with $10\%$ reserve), per-IP caps (10 credits/day), and D1 `credit_ledger` logging.
  * Implemented `YouTubeDiscoveryService` with 90-search/day quota tracking and daily Top 20 caching.
  * Implemented `WayService` with 24-hour CDN edge caching, 60s active watch gate, and Evon prediction.
  * Implemented `QueryOrchestrator` with 5-stage retrieval pipeline: prepared match ($\ge 0.65$ token overlap) $\rightarrow$ in-video FTS5 BM25 match + Evon rerank $\rightarrow$ cross-video search $\rightarrow$ grounded AI fallback (Tavily/Exa + Evon 30–40 words + Timbre TTS) $\rightarrow$ honest `NO_VERIFIED_MATCH`.
  * Added Cloudflare Worker scheduled Cron Trigger handler (`0 2 * * *`) for daily trending refresh and LRU cache eviction.
  * Configured Worker Static Assets to serve Vite SPA directly from Cloudflare's Edge CDN.
* **React SPA Client (`src/client/`):**
  * Fully applied *Midnight Gallery Wall with Hot Pink Markers* design specification: Obsidian `#000000`, Parchment `#efe6d8`, Bone `#aca69c`, Ash `#736e68`, Charcoal `#605c56` hairlines, Acid Lime `#4dff00` status dot, and single primary Neon Petal `#ffa1f7` pill CTA.
  * Embedded official Parchment logo emblem (28px height) in header alongside monospace `CONV-WAY` wordmark.
  * Implemented in-memory LIFO Call Stack (`usePlaybackStore`) with 2s safety rewind, crash-resilient `sessionStorage` sync, and Hand-Back decision bar (`CONTINUE VIDEO`, `DIVE DEEPER`, `ASK ANOTHER`).
  * Implemented `PrimaryPlayer` with 2-second active watch confirmation gate before triggering caption ingestion.
  * Implemented TOS-compliant $\ge 200\times200\text{ px}$ `PiPPlayer` for cross-video segments.
  * Implemented Web Audio API RMS Voice Activity Detection (VAD), dynamic audio ducking (18% volume), and hybrid Speech-to-Text router (Native Web Speech primary $\rightarrow$ Gnani Prisma v3.0 fallback).
  * Implemented `WayPanel` with progressive timestamp reveal (`currentTime >= trigger_sec`), 75% prefetch, and 3.5s seek debounce.
  * Implemented `AiFallbackCard` with real source citation links and optional Gnani Timbre audio playback.
* **Verification & Testing:**
  * 18 unit and live smoke tests passing across `tests/search/`, `tests/worker/governor.test.ts`, and `tests/worker/window-builder.test.ts`.
  * Full typecheck passing with zero errors across both client and worker (`npm run typecheck`).
  * Production build verified (`dist/` generated with 185 kB JS, 20 kB CSS).

---

## [0.1.0] — 2026-11-08
### Added
* **Product Requirements (`PRD.md`):** Formalized complete product specification derived from the *Conv-way Product Vision Document v0.3* and *Conv-way Case Study*, establishing the zero-sign-in YouTube overlay model, LIFO playback call stack, Picture-in-Picture external video answers, the **Way** ambient predicted-questions panel, and the 3,000-credit Gnani governor.
* **Agent Engineering Standards (`AGENTS.md`):** Established non-negotiable production rules prohibiting hardcoded data, mock readings, fake fallbacks, and decorative UI controls.
* **System Architecture (`ARCHITECTURE.md`):** Defined the end-to-end edge architecture across React/Vite client, Web Audio/WebRTC voice layer, Cloudflare Workers (Hono), Cloudflare D1 (SQLite + FTS5), and external adapters (Supadata, TranscriptAPI, Gnani Prisma v3.0, Evon v3.3, Timbre, YouTube Data API v3, and two-pass Grounded Search via Tavily, Exa, and Google CSE).
* **Technology Stack (`TECH_STACK.md`):** Documented exact framework versions, browser native speech capabilities, and Cloudflare Free Plan resource budgets.
* **Database Schema (`DATABASE_SCHEMA.md`):** Designed window-based D1 relational schema (`videos`, `transcript_windows`, `transcript_fts`, `way_questions`, `search_cache`, `credit_ledger`, `calibration_rates`) reducing row writes by $>99\%$ compared to line-by-line caption storage.
* **API Contracts (`API_DOCUMENTATION.md`):** Specified all REST endpoints, request/response schemas, 2-second watch confirmation gate, and structured error codes.
* **Testing & Verification Plan (`TESTING.md`):** Defined unit, D1 integration, and Playwright E2E test suites including the Musk x Kamath Episode 16 reference scenario.
* **Security, Deployment & Known Issues (`SECURITY.md`, `DEPLOYMENT.md`, `KNOWN_ISSUES.md`, `TASKS.md`):** Documented zero-account privacy protections, Worker secret configuration, calibration batch execution, and known platform constraints.