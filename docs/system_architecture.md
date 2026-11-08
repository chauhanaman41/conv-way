# System Architecture: Conv-way

## 1. High-Level System Overview
Conv-way uses an edge-native, serverless architecture hosted on **Cloudflare Pages**, **Cloudflare Workers**, **Cloudflare D1 (SQLite + FTS5)**, and **Cloudflare KV**, paired with a lightweight React browser client that orchestrates dual YouTube IFrame players, WebRTC/Web Audio voice processing, and an in-memory LIFO playback call stack.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER CLIENT (React + Vite)                          │
│                                                                                  │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  ┌─────────────────┐  │
│  │  Audio & Voice Layer    │  │  Playback Orchestrator   │  │   "Way" Panel   │  │
│  │ • WebRTC AEC / NoiseSup │  │ • Main YT IFrame Player  │  │ • Window Cache  │  │
│  │ • Web Audio VAD & Duck  │  │ • PiP YT IFrame Player   │  │ • Timestamp     │  │
│  │ • Web Speech API (Free) │  │ • LIFO State Call Stack  │  │   Reveal Gate   │  │
│  └────────────┬────────────┘  └─────────────┬────────────┘  └────────┬────────┘  │
└───────────────┼─────────────────────────────┼────────────────────────┼───────────┘
                │ HTTPS / REST                │ IFrame API             │ HTTPS
                ▼                             ▼                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE EDGE NETWORK (CDN + Workers)                      │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                        API Gateway & Router (Hono)                         │  │
│  │  • Input Validation (Zod)   • Rate Limiter   • Edge Cache Headers          │  │
│  └──────┬──────────────────┬───────────────────────┬───────────────────┬──────┘  │
│         │                  │                       │                   │         │
│         ▼                  ▼                       ▼                   ▼         │
│  ┌──────────────┐  ┌───────────────┐      ┌─────────────────┐  ┌──────────────┐  │
│  │  Discovery   │  │  Transcript   │      │ Query & "Way"   │  │    Credit    │  │
│  │   Service    │  │   Ingestion   │      │  Orchestrator   │  │   Governor   │  │
│  │ (Top 20 Cron │  │  & Windowing  │      │ • FTS5 Search   │  │ • Daily Cap  │  │
│  │  & YT Search)│  │   (600-800w)  │      │ • Evon Rerank   │  │ • Step-down  │  │
│  └──────┬───────┘  └───────┬───────┘      └────────┬────────┘  └──────┬───────┘  │
│         │                  │                       │                  │          │
│         └──────────────────┴───────────┬───────────┴──────────────────┘          │
│                                        ▼                                         │
│         ┌─────────────────────────────────────────────────────────────┐          │
│         │        Cloudflare D1 (SQLite + FTS5) & Cloudflare KV        │          │
│         │ • videos, transcript_windows, transcript_fts                │          │
│         │ • way_questions, credit_ledger, quota_counters              │          │
│         └─────────────────────────────────────────────────────────────┘          │
└─────────┬──────────────────────────────┬──────────────────────────────┬──────────┘
          │                              │                              │
          ▼                              ▼                              ▼
┌───────────────────┐        ┌───────────────────────┐      ┌──────────────────────┐
│  YouTube Data API │        │   Transcript Adapter  │      │   Gnani AI Suite     │
│  & Web Search API │        │ • Primary: Supadata   │      │ • Prisma v3.0 (STT)  │
│ • Server API Key  │        │ • Fallback:           │      │ • Evon v3.3 (LLM)    │
│ • Quota Guarded   │        │   TranscriptAPI       │      │ • Timbre (TTS)       │
└───────────────────┘        └───────────────────────┘      └──────────────────────┘
```

---

## 2. Core Component Responsibilities

### 2.1 Client-Side Architecture (`src/client/`)
1. **Playback Orchestrator & LIFO Call Stack (`PlaybackManager`):**
   * Wraps two instances of the YouTube IFrame Player API:
     * **Primary Player:** Plays the main video selected by the viewer.
     * **PiP (Picture-in-Picture) Player:** Mounted on demand ($\ge 200\times200\text{ px}$ to comply with YouTube TOS) when an answering segment comes from an external YouTube video while the primary player is paused.
   * Maintains the in-memory **LIFO Call Stack**:
     $$\text{Stack Entry} = \{ \text{videoId}, \text{returnTimestamp}, \text{playbackRate}, \text{volume}, \text{branchId}, \text{questionText} \}$$
   * Monitors current playback time via a `200ms` local polling loop when playing an answer clip `[start_sec, end_sec]`. The moment `currentTime >= end_sec`, the player pauses and triggers the **Hand-Back Decision Bar** (*Continue Original*, *Dive Deeper*, *Ask Another*).
2. **Watch Confirmation Gate (`WatchGate`):**
   * Listens to `YT.PlayerState.PLAYING`. Accumulates real elapsed playing time. Once elapsed time reaches $\ge 2.0\text{ seconds}$, dispatches `POST /api/videos/:videoId/init` to fetch/index the transcript and warm Window 0.
3. **Ambient Audio & Voice Layer (`AudioPipeline`):**
   * Requests microphone stream with `{ echoCancellation: true, noiseSuppression: true, autoGainControl: true }`.
   * Connects an `AudioContext` + `AnalyserNode` to calculate real-time RMS energy and frequency band activity in the human voice spectrum ($85\text{ Hz}\text{--}3000\text{ Hz}$) for local Voice Activity Detection (VAD).
   * Executes dynamic **Audio Ducking** (`player.setVolume(18)`) or **Auto-Pause** (when headphones are not detected) during active speech.
   * Streams speech to browser `SpeechRecognition` (`webkitSpeechRecognition` / `SpeechRecognition`) first. If unavailable, unsupported for the active language, or returning an error/empty result, records a WebM/WAV blob ($\le 30\text{ seconds}$) and sends it to `POST /api/voice/transcribe` (Gnani Prisma v3.0).
4. **The "Way" Controller (`WayController`):**
   * Tracks local playhead position without per-second network calls.
   * Reveals cached questions for the current window as `currentTime >= question.trigger_sec`.
   * Requests the next window (`GET /api/videos/:videoId/way?windowIndex=N+1`) only when playback passes $75\%$ of the current window's time range, and pauses all background fetching if the video is paused or the browser tab is hidden (`document.visibilityState === 'hidden'`).
   * After a manual user seek, waits $3.5\text{ seconds}$ (debounce) to confirm the viewer stays at the new position before requesting the window covering that timestamp.

---

### 2.2 Backend Edge Architecture (`src/worker/`)
1. **Transcript Ingestion & Windowing Service (`TranscriptService`):**
   * Implements the `ITranscriptProvider` interface with `SupadataProvider` (primary) and `TranscriptApiProvider` (fallback).
   * Groups raw caption cues into **Speech Windows** of $600\text{--}800$ words (Window 0 is sized to ~300–400 words / ~2 minutes for fast initial load), with a 30-second context overlap between consecutive windows.
   * Persists windows into D1 `transcript_windows` and populates the `transcript_fts` FTS5 virtual table in a single batch write.
2. **Way Window Generator (`WayService`):**
   * Checks D1 `way_questions` for `(video_id, window_index, language)`. If present, returns cached rows with `Cache-Control: public, max-age=86400, s-maxage=604800` so Cloudflare's Edge CDN serves subsequent viewers without invoking the Worker.
   * On cache miss (and if permitted by the Credit Governor), sends the window transcript plus rolling summary to **Gnani Evon v3.3** in a single structured prompt to generate 5–8 candidate questions with exact quote anchors and `[start_sec, end_sec]` ranges.
   * Verifies that every predicted `[start_sec, end_sec]` exists within the indexed transcript and is $\le$ video duration before inserting into D1.
3. **Query Resolution Engine (`QueryOrchestrator`):**
   * **Step 1 (Prepared Match):** Compares the live user question against prepared `way_questions` in the active window using normalized token overlap. If high confidence, returns the cached range immediately ($0$ AI credits).
   * **Step 2 (In-Video FTS5 + Evon Rerank):** Queries `transcript_fts` for the active video. If a single window has a dominant BM25 score and exact phrase match, resolves directly; otherwise calls **Evon v3.3** to select the exact `[start_sec, end_sec]` clip boundaries inside the matching window.
   * **Step 3 (Cross-Video Search):** Queries `transcript_fts` across all stored videos in D1. If no strong match and YouTube Search budget allows, calls YouTube Data API v3 `search.list`, fetches up to 1 candidate transcript (if transcript budget allows), and extracts the exact segment.
   * **Step 4 (Verified Web Search AI Fallback):** If no video segment answers the question (or a claim appears contradicted), executes two-pass grounded search: Pass 1 queries a curated trusted-domain list (via Tavily and Exa, with optional Google CSE), and Pass 2 queries the open web via Tavily/Exa if trusted sources are insufficient. (Note: Google's Custom Search JSON API is closed to new customers since 20 Jan 2026 and ends on 1 Jan 2027, so Google is optional and auto-disables; Bing's API was retired in Aug 2025). Calls **Evon v3.3** to write a 30–40 word answer strictly grounded in the retrieved URLs.
4. **Credit & Quota Governor (`GovernorService`):**
   * Computes daily credit allowance dynamically:
     $$\text{Daily Cap} = \frac{\text{Remaining Pool Credits}}{\max(1, \lceil \text{Days Until Dec 15, 2026} \rceil)} \times 0.90$$
   * Tracks real credit consumption in `credit_ledger` and daily API units in `quota_counters`.
   * Enforces priority tiers:
     * `< 80%` of daily cap: Full operation (Live Queries + Way Generation + AI Fallback + Opt-in Timbre TTS).
     * `80% - 99%` of daily cap: Suppress speculative next-window **Way** generation for single-viewer videos; prioritize live queries.
     * `>= 100%` of daily cap: Hard stop on paid model calls; serve cached **Way** windows, FTS5 keyword search, and browser native STT.