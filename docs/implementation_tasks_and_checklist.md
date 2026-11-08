# Implementation Tasks & Progress Checklist: Conv-way

**Status Legend:**
* `[x]` `FULLY_IMPLEMENTED_AND_VERIFIED`
* `[~]` `IMPLEMENTED_PENDING_VERIFICATION`
* `[-]` `PARTIALLY_IMPLEMENTED`
* `[!]` `BLOCKED_BY_EXTERNAL_DEPENDENCY`
* `[ ]` `NOT_IMPLEMENTED`

---

## Phase 1: Architecture, Documentation & Database Foundation
* `[x]` **T1.1:** Author comprehensive production documentation suite (`PRD.md`, `AGENTS.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, `TASKS.md`, `TESTING.md`, `SECURITY.md`, `DEPLOYMENT.md`, `CHANGELOG.md`, `KNOWN_ISSUES.md`).
* `[x]` **T1.2:** Initialize Cloudflare Workers with Static Assets + TypeScript + Vite + Tailwind CSS project structure and `wrangler.toml` bindings (`DB` for D1 `da3713e6-2633-4a94-8302-2c9ce69f13a7`, `KV` for Workers KV `b120d3e40511405aa6c900052222849f`).
* `[x]` **T1.3:** Apply D1 migration `0001_initial_schema.sql` (`videos`, `transcript_windows`, `transcript_fts`, `way_questions`, `search_cache`, `credit_ledger`, `calibration_rates`, `rate_limit_counters`, `quota_counters`, `system_events`).

## Phase 2: Credit Governor & External API Adapters (Backend)
* `[x]` **T2.1:** Implement `GovernorService` with dynamic daily cap formula ($3,000\text{ credits} / \text{days until Dec 15, 2026}$ with $10\%$ reserve), D1 `credit_ledger` logging, per-IP daily caps (10 credits/day), and 4-tier step-down enforcement (`NORMAL`, `CONSERVATIVE`, `CRITICAL`, `SHUTDOWN`).
* `[x]` **T2.2:** Implement calibration endpoint (`POST /api/admin/calibrate` and `POST /api/admin/warm`) protected by `X-Admin-Calibration-Key` to verify empirical credit rates and latency percentiles.
* `[x]` **T2.3:** Build swappable `TranscriptAdapter` (`SupadataProvider` primary, `TranscriptApiProvider` secondary fallback) with single-flight deduplication, 5-a-day daily transcript budget gate, and D1 batching.
* `[x]` **T2.4:** Build `TranscriptWindowBuilder` to segment raw captions into 600–800 word windows (~2-minute fast-start Window 0 ~350 words, 30s overlap) and batch-insert into D1 + `transcript_fts`.
* `[x]` **T2.5:** Build Gnani AI Clients (`PrismaClient` v3.0 for $\le 30\text{s}$ audio, `EvonClient` v3.3 for Way prediction, reranking, and fallback, and `TimbreClient` v3.0 for opt-in TTS synthesis). Live tested with real synthesis audio output.
* `[x]` **T2.6:** Build YouTube Data API v3 discovery service, daily Cron Trigger (`0 2 * * *`) for Top 20 Trending Podcasts, and two-pass Grounded Search Orchestrator (Pass 1: 15 trusted domains via Google CSE/Tavily/Exa; Pass 2: open web via Tavily/Exa). Enforces strict grounding (exact URL citations, 30–40 words validation, contradiction flagging).

## Phase 3: Playback Orchestrator & LIFO Call Stack (Frontend)
* `[x]` **T3.1:** Implement dual YouTube IFrame Player controller (`PrimaryPlayer` + compliant $\ge 200\times200\text{ px}$ `PiPPlayer` for external video answers).
* `[x]` **T3.2:** Implement in-memory LIFO Playback Call Stack (`pushBranch`, `popBranch`, `returnToRoot`, 2s safety rewind offset, session storage resilience) independent of network/AI latency.
* `[x]` **T3.3:** Implement the 2-second active watch confirmation gate (`WatchGate`) before triggering `/api/videos/:videoId/init`.
* `[x]` **T3.4:** Build segment boundary monitor (`startSec` to `endSec`) and End-of-Clip Hand-Back decision bar (*Continue Video [MM:SS]*, *Dive Deeper*, *Ask Another*).

## Phase 4: Voice Pipeline & "Way" Ambient Side Panel (Frontend)
* `[x]` **T4.1:** Implement WebRTC microphone capture with hardware AEC (`echoCancellation: true`), Web Audio API RMS Voice Activity Detection (VAD), and dynamic audio ducking ($18\%$ volume) / auto-pause fallback.
* `[x]` **T4.2:** Implement hybrid Speech-to-Text router (Browser `SpeechRecognition` primary $\rightarrow$ Gnani Prisma v3.0 fallback for unsupported browsers and Indian languages).
* `[x]` **T4.3:** Build the **Way** side panel (desktop right 32% panel / mobile bottom drawer) with progressive reveal gate (`currentTime >= trigger_sec`), 75% window prefetch trigger, and 3.5s post-seek debounce.
* `[x]` **T4.4:** Implement low-end device capability & Data-Saver detection to automatically switch to lightweight `titles`-only mode and Push-to-Talk baseline.

## Phase 5: End-to-End Verification & Production Hardening
* `[x]` **T5.1:** Execute full vitest test suites covering Search Layer, Live Smoke with real Tavily & Exa keys, GovernorService, and WindowBuilder (18 passing tests).
* `[x]` **T5.2:** Audit codebase against `AGENTS.md` confirming zero hardcoded arrays, zero mock fallbacks, genuine D1 database persistence, and full production build verification (`dist/` Vite SPA bundle + Cloudflare Worker compilation).
