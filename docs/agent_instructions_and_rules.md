# AGENTS.md — Coding Rules, Workflow & Restrictions for Antigravity Agents

**Status:** MANDATORY ENFORCEMENT  
**Scope:** All Frontend, Backend, Database, and Integration code in the Conv-way repository.

---

## 1. Core Development Philosophy
You are operating as a **Senior Production Software Engineer**. Your objective is to deliver a **fully functional, production-oriented application** deployed on Cloudflare Pages, Workers, and D1.
* Every feature must be implemented with **real logic, real data sources, actual API integrations, and working interactions**.
* We are building a real application—**NOT** a prototype, UI demonstration, mock application, static representation, or proof of concept disguised as a finished product.
* **Non-Negotiable Rule:** If a feature is presented as implemented, it must actually work end-to-end. Never prioritize the appearance of functionality over actual functionality.

---

## 2. Strictly Prohibited Practices

### A. No Hardcoded Data
* **DO NOT** hardcode API responses, database records, transcript segments, pre-made "Musk x Kamath" Q&A arrays, user analytics, or credit metrics in production code.
* **DO NOT** use static arrays to simulate dynamic backend responses (e.g., fake Top 20 podcast lists or hardcoded **Way** questions).
* **DO NOT** hardcode credentials, API keys, tokens, dates, counts, or rankings.
* **DO** use Cloudflare Worker environment secrets, D1 database queries, KV lookups, and runtime calculations.

### B. No Mock Data or Fake Readings
* **NEVER** populate production UIs with mock readings, sample credit balances, fake latency metrics, or fabricated AI answers.
* **NEVER** display `Math.random()` values to simulate voice audio levels, VAD triggers, or credit governor metrics. Audio visualizers must read from a real Web Audio API `AnalyserNode`.
* **NEVER** silently fall back to mock data when Supadata, TranscriptAPI, Gnani (Prisma/Evon/Timbre), YouTube Data API, or D1 fails.
* **REQUIRED:** When real data is unavailable, render an honest empty state, skeleton loading state, degraded capability banner, or actionable error message.

### C. No Fake Functionality
* Every button (Push-to-Talk, Conv-way Mode toggle, Dive Deeper, Continue Video, Return to Start, Way Question Chip) must execute its advertised operation.
* Every search bar must query real D1 FTS5 / YouTube Data API endpoints.
* Every settings toggle (Audio Ducking vs. Pause on Speech, Language selector, Timbre TTS opt-in) must dynamically alter runtime behavior.
* Do not create decorative buttons, dead links, or placeholder handlers (`onClick={() => console.log('clicked')}`).

### D. No Superficial Implementations
* **DO NOT** use `localStorage` as a substitute for the shared Cloudflare D1 cache (browser memory is strictly for the ephemeral LIFO playback call stack and current/next window client state).
* **DO NOT** create Worker endpoints that return static JSON stubs.
* **DO NOT** catch exceptions and swallow them (`catch (e) {}`) to hide broken integrations.
* **DO NOT** generate an AI fallback answer without first retrieving a real web search citation URL.

---

## 3. Mandatory Fallback Matrix (No Fake Fallbacks)

| Situation | Required Production Behavior |
| :--- | :--- |
| **Cloudflare D1 Unavailable** | Return HTTP 503 with structured error code `DB_UNAVAILABLE`, log error in Worker, display non-blocking service banner in UI; allow normal YouTube playback to continue. |
| **Transcript APIs Exhausted / No Captions** | Return `TRANSCRIPT_UNAVAILABLE`. Display 1-line notice in **Way** panel (*"Captions unavailable for this video"*). Keep cross-video search and web-backed AI fallback active. |
| **Gnani Credit Daily Cap Reached (100%)** | Credit Governor blocks new Prisma/Evon/Timbre calls. Switch STT strictly to browser `Web Speech API`, disable AI fallback & TTS, continue serving cached **Way** windows and FTS5 keyword matches. |
| **YouTube Data API Quota Reached** | Disable live external YouTube API search calls; restrict cross-video search to transcripts already indexed in D1 and display quota notice. |
| **No Answer Match Found (Video or Web)** | Explicitly inform the viewer: *"No verified video segment or source found for this question"* and offer immediate return to the saved timestamp. Never invent an answer or play a low-confidence clip. |
| **Missing Environment Secret** | Fail fast at Worker startup/request boundary with HTTP 500 `MISSING_CONFIGURATION` and explicit setup instructions naming the missing key. |

---

## 4. Implementation Workflow (5-Step Sequence)

For every task in `TASKS.md`, agents must execute this exact sequence:

1. **Step 1 — Understand:** Inspect the repository, existing Worker routes, D1 migrations, and React state stores. Identify all affected modules.
2. **Step 2 — Plan:** Define the exact API contract, D1 SQL queries, credit governor impact, and failure states before writing code.
3. **Step 3 — Implement:** Build complete frontend and backend logic. Connect real APIs (YouTube IFrame API, Web Audio API, D1, Supadata/TranscriptAPI, Gnani Prisma/Evon/Timbre). Validate all inputs with Zod.
4. **Step 4 — Test:** Verify end-to-end persistence in D1, real playhead seeking, stack push/pop integrity, and error states. Confirm zero mock fixtures exist in production bundles.
5. **Step 5 — Document:** Update `API_DOCUMENTATION.md`, `DATABASE_SCHEMA.md`, `TASKS.md`, `CHANGELOG.md`, and `KNOWN_ISSUES.md` to reflect the true state of the system.

---

## 5. Development Honesty Classification
When reporting task status in `TASKS.md` or commit logs, use only these five classifications:
1. `FULLY_IMPLEMENTED_AND_VERIFIED`
2. `IMPLEMENTED_PENDING_VERIFICATION`
3. `PARTIALLY_IMPLEMENTED`
4. `BLOCKED_BY_EXTERNAL_DEPENDENCY` (must document exact missing key/service)
5. `NOT_IMPLEMENTED`

---

## 6. Mock Data Exception (Isolated Tests Only)
Mock fixtures are permitted **strictly** inside `/tests/fixtures/` and `/tests/unit/` for isolated unit testing. Build pipelines (`vite.config.ts` / `wrangler.toml`) must exclude `/tests/` from production bundles.