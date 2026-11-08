# Technology Stack: Conv-way

## 1. Overview
Conv-way is built to run within **Cloudflare's Free Tier** (Pages, Workers, D1, KV, Cron Triggers) while keeping client bundle sizes minimal for low-end mobile devices and conserving the 3,000-credit Gnani AI pool.

---

## 2. Frontend Stack

| Category | Technology | Version | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| **Framework** | React + TypeScript | `^18.3.1` / `^5.6.0` | Component architecture, strict type safety across playback stack and API contracts. |
| **Build Tool** | Vite | `^5.4.0` | Fast HMR, optimal tree-shaking, zero-bloat static asset generation for Cloudflare Pages. |
| **Styling** | Tailwind CSS | `^3.4.0` | Mobile-first responsive layout (side-by-side desktop view, bottom-sheet mobile view), low CSS overhead. |
| **State Management** | Zustand | `^5.0.0` | Lightweight, hook-based in-memory store for the LIFO Playback Call Stack, active window cache, and Audio/Mic state. |
| **Video Player** | YouTube IFrame Player API | Official v3 | Frame-accurate seeking (`seekTo`), playback state listeners, volume ducking, and secondary PiP player orchestration. |
| **Voice & Audio** | Web Audio API + WebRTC `getUserMedia` | Browser Native | Hardware Acoustic Echo Cancellation (`echoCancellation: true`), real-time RMS Voice Activity Detection (VAD), and audio visualizer. |
| **Primary STT** | Web Speech API (`SpeechRecognition`) | Browser Native | Zero-latency, zero-credit client-side speech transcription when supported by the viewer's browser. |
| **Icons** | Lucide React | `^0.454.0` | Clean, accessible UI icons for player controls, stack breadcrumbs, and microphone states. |

---

## 3. Backend & Edge Infrastructure

| Category | Technology | Version | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| **Serverless Runtime** | Cloudflare Workers | Compatibility `2026-11-01` | Edge execution with 0ms cold starts, 100,000 free requests/day. Waiting on external I/O (Gnani/YouTube) does not count toward the 10ms CPU limit. |
| **Web Framework** | Hono | `^4.6.0` | Ultralight ($\approx 14\text{ KB}$) TypeScript router built specifically for Cloudflare Workers. |
| **Validation** | Zod | `^3.23.8` | Strict runtime request/response validation and LLM JSON output schema verification. |
| **Relational DB & Search** | Cloudflare D1 (SQLite + FTS5) | Managed Edge SQLite | Stores windowed transcripts, full-text search indexes (`FTS5` with BM25 ranking), shared **Way** questions, and the credit ledger (5 GB free storage, 5M row reads/day). |
| **Key-Value Store** | Cloudflare Workers KV | Managed Edge KV | Stores the daily Top 20 Trending Podcasts payload, fast rate-limit counters, and daily governor state snapshots. |
| **Scheduled Jobs** | Cloudflare Cron Triggers | Managed Cron | Runs once daily (`0 2 * * *` UTC) to refresh the shared Top 20 Trending Podcasts list and recalculate the daily credit cap. |

---

## 4. External AI Models & Data APIs

| Service | Provider / Endpoint | Usage Role | Budget & Quota Guardrails |
| :--- | :--- | :--- | :--- |
| **Fallback Speech-to-Text** | **Gnani Prisma v3.0** | Transcribes voice queries (`<= 30s` audio clips) when browser `SpeechRecognition` is unavailable/fails or for 9 Indian languages (Hindi, Bengali, Marathi, Gujarati, Punjabi, Kannada, Telugu, Tamil, Malayalam). | Only active speech frames sent; governed by daily credit cap. |
| **Language Model (LLM)** | **Gnani Evon v3.3 (30B MoE)** | 1) Generates 5–8 **Way** questions & answer ranges per window.<br>2) Reranks FTS5 candidate windows & extracts exact `[start_sec, end_sec]`.<br>3) Synthesizes 30–40 word cited AI fallback answers. | Shared cache across all viewers; 1 combined call per window; skipped when keyword match is unambiguous. |
| **Text-to-Speech (TTS)** | **Gnani Timbre** | Opt-in spoken readout of 30–40 word AI fallback answers in hands-free mode. (Static transitional cues like *"Jumping ahead"* are pre-generated static audio assets). | Opt-in only; disabled when daily credit cap reaches 80%. |
| **Transcript Ingestion** | **Supadata API** (Primary)<br>**TranscriptAPI** (Fallback) | Fetches existing YouTube manual/auto caption tracks with `start` and `duration` timestamps behind a swappable adapter. | Free tiers (~100 credits/mo each, $\approx 5$ new videos/day). Fetched only after 2s confirmed watch; cached permanently in D1. |
| **Video Discovery & Search** | **YouTube Data API v3** | Builds daily Top 20 podcast list and executes cross-video candidate discovery on D1 cache misses. | Server-side key only; 10,000 units/day default quota; capped at 90 searches/day. |
| **Web Verification** | **Tavily & Exa Search APIs** (Google CSE optional fallback) | Two-pass grounded search: 15 trusted domains first via Tavily/Exa, open web fallback if needed. (Note: Google Custom Search JSON API is closed to new customers since 20 Jan 2026 and ends on 1 Jan 2027; Bing API retired in Aug 2025). | Capped at 30 searches/day (Tavily+Exa) and 90/day (Google); strictly required before generating any AI fallback text. |

---

## 5. Development & Testing Tooling
* **Package Manager:** `npm` / `pnpm`
* **Local Edge Emulator:** `wrangler` (`^3.80.0`) with local D1 SQLite and KV persistence.
* **Test Runner:** `Vitest` (`^2.1.0`) + `@cloudflare/vitest-pool-workers` for integration testing against real local D1 schemas, and `Playwright` (`^1.48.0`) for end-to-end browser verification.