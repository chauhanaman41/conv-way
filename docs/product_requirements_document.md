# Product Requirements Document (PRD): Conv-way

**Version:** 1.0.0  
**Date:** November 8, 2026  
**Product Name:** Conv-way (Pronounced *"CON-WAY"*)  
**Tagline:** *Don't pause your curiosity, let the video follow it.*

---

## 1. Executive Summary & Objective
Conv-way is a responsive, zero-sign-in web application that transforms passive YouTube video watching into a real-time, non-linear interactive conversation. While watching any YouTube video, a viewer can ask spontaneous questions out loud (via Push-to-Talk or ambient voice detection), type a query, or tap a pre-computed contextual question in the **Way** side panel. Conv-way saves the viewer's exact playback position in a session stack, finds the single most accurate answering video segment across the active video or all of YouTube, plays *only* that segment (seeking in-player or opening a Picture-in-Picture player for external videos), and hands control back to the viewer to dive deeper, ask a follow-up, or return seamlessly to their exact original timestamp.

---

## 2. Core Engineering & Product Philosophy (Non-Negotiable)
1. **Production-Grade Reality:** Every feature in Conv-way operates on real data, real transcripts, live YouTube IFrame API interactions, real Cloudflare D1 full-text indexes, and live Gnani AI (Prisma, Evon, Timbre) and YouTube Data API v3 calls.
2. **Zero Hardcoded or Mock Data:** No static transcript arrays, fake trending lists, simulated AI responses, or decorative buttons. If an API quota is exhausted or captions are unavailable, the UI displays an honest, actionable degraded state while keeping core video playback intact.
3. **Best Answer on YouTube Wins:** Answers are video segments with a real speaker and channel behind them—never scraped web articles. Only when no video segment answers the question, or when a speaker's claim is contradicted by verified web sources, does Conv-way provide a 30–40 word labeled AI fallback backed by a live retrieved citation URL.

---

## 3. Target Audience & Supported Platforms
* **Target Audience:** Any YouTube viewer watching podcasts, technical interviews, lectures, tutorials, panels, or documentaries. Zero account registration, zero sign-in, and zero user-supplied API keys required.
* **Supported Platforms:**
  * **Desktop Browsers (Primary):** Chrome, Edge, Safari, Firefox (side-by-side player and **Way** panel layout; supports Push-to-Talk and opt-in Ambient Conv-way Mode).
  * **Mobile Browsers (Primary):** Mobile Safari (iOS) and Chrome (Android) (mobile-first stacked layout, bottom-sheet **Way** panel, touch-friendly one-handed Push-to-Talk and return controls).

---

## 4. Functional Requirements

### 4.1 Discovery & Home Screen (Zero Sign-In)
* **Top 20 Trending Podcasts:** Displays a shared global list of the Top 20 trending podcasts fetched and cached daily via a Cloudflare Cron Trigger using a server-side YouTube Data API key.
* **Live YouTube Search & Direct URL Paste:** Users can search YouTube directly (cached by normalized query in D1/KV) or paste any valid YouTube video URL/ID to begin watching immediately.

### 4.2 Lazy Transcript Ingestion & Indexing (2-Second Rule)
* **Watch Confirmation Gate:** Transcript fetching and indexing **must not** trigger on page load. The client tracks actual playback time and triggers backend ingestion only after the user has actively watched the video for $\ge 2.0$ seconds.
* **Swappable Transcript Adapter:** Calls Supadata API (primary) and falls back to TranscriptAPI (secondary) on failure or HTTP 429/quota exhaustion.
* **Windowed Storage:** Transcripts are grouped into speech windows of $600\text{--}800$ spoken words (roughly $2\text{--}6$ minutes of dialogue, with a ~2-minute fast-start first window and 30-second overlaps) and indexed in Cloudflare D1 using SQLite FTS5.
* **Uncaptioned Video Handling:** If a video lacks usable captions or the daily transcript budget is exhausted, **Way** displays a clear 1-line notice (*"Captions unavailable for this video; in-video Way questions disabled"*), while cross-video search, AI fallback, and playback stack remain fully operational.

### 4.3 Multi-Modal Question Input
1. **Push-to-Talk (Default Baseline):** Hold or tap-to-speak button on all devices. Ducks video volume to $15\text{--}20\%$ (or pauses if no headphones/AEC are detected) while recording.
2. **Conv-way Mode (Opt-In Ambient Voice):** Uses client-side Web Audio API + WebRTC Acoustic Echo Cancellation (`echoCancellation: true`, `noiseSuppression: true`) and Voice Activity Detection (VAD) to detect speech hands-free.
3. **Speech-to-Text Routing:** Uses browser native `Web Speech API` (`SpeechRecognition`) first at zero credit cost. Automatically falls back to **Gnani Prisma v3.0** (`<= 30s` audio clips) when native recognition is unsupported, fails, or when Indian/mixed-language speech is selected.
4. **Text Input:** Always-available text input bar.
5. **Way Panel Tap:** One-tap execution of pre-computed questions for the current playback window.

### 4.4 The "Way" Ambient Side Panel
* **Quiet by Design:** Never interrupts playback or overlays the video. Shows skeleton placeholders while the first window prepares.
* **Window-Ahead Prediction:** Uses **Gnani Evon v3.3** to generate 5–8 predicted questions and verified timestamp answer ranges `[start_sec, end_sec]` for the active window (600–800 words). Triggers preparation for the next window only when playback crosses $75\%$ of the current window.
* **Timestamp Gating:** Each question is tagged with the exact timestamp (`trigger_sec`) it relates to and is revealed in the UI *only* when the playhead reaches or passes `trigger_sec`.
* **Shared Learning Cache:** Live user questions that miss the prepared list but resolve to a valid answer segment are normalized and saved to the shared D1 database for future viewers.

### 4.5 Answer Retrieval, Playback Orchestration & LIFO Call Stack
* **LIFO Playback Stack:** Maintained in browser memory:
  $$\text{Call Stack} = [T_{\text{origin}}, T_{\text{branch\_1}}, \dots, T_{\text{branch\_n}}]$$
  Each entry records `{ videoId, timestamp, playbackRate, volume, branchId, queryText }`.
* **Lookup Hierarchy:**
  1. Check current window's prepared **Way** questions (keyword match $\rightarrow$ optional Evon disambiguation).
  2. Search active video's FTS5 transcript windows in D1 + rerank top candidates via **Evon v3.3**.
  3. Search across indexed transcripts in D1 and YouTube Data API v3 (within daily quota budget) for external video answers.
  4. **Verified AI Fallback:** If no video segment answers the query, or if a speaker's claim is contradicted by research, perform a live Web Search API lookup and generate a $30\text{--}40$ word response via **Evon v3.3** citing the retrieved URL. **Rule:** No retrieved source URL = no AI answer generated.
* **Playback Execution:**
  * **In-Video Answer:** Saves return point (`push()`), shows visible *"Return point saved at [MM:SS]"* pill, seeks main YouTube player to `start_sec`, and monitors playback until `end_sec`.
  * **External Video Answer:** Pauses main video, opens a compliant Picture-in-Picture (PiP) YouTube player (`>= 200x200 px`), plays `[start_sec, end_sec]`, and displays source metadata (Video Title, Channel Name, Time Range).
* **End-of-Clip Hand-Back (No Auto-Return):** When the playhead reaches `end_sec`, playback pauses and presents three explicit user choices:
  1. **Continue original video** (`pop()` to immediate parent or return to root $T_{\text{origin}}$).
  2. **Dive deeper** (expands search across current video and YouTube, pushing a new branch onto the stack).
  3. **Ask another question** (initiates voice/text input).

### 4.6 Credit & Quota Governor
* Enforces a strict daily budget from the 3,000 Gnani credit pool ($\approx 81$ credits/day, or $\approx 73$ credits/day after a $10\%$ reserve, dynamically recalculated daily through December 15, 2026) and YouTube Data API quota (10,000 units/day).
* Logs every API call to D1 and steps down gracefully at $80\%$ and $100\%$ thresholds without breaking video playback or cached **Way** interactions.

---

## 5. Success Metrics
* **Position Restoration Accuracy:** $\ge 95\%$ exact timestamp restoration across single and nested detours.
* **Answer Segment Relevance:** $\ge 90\%$ accuracy on curated benchmark queries.
* **In-Video Query Latency:** $< 2.0\text{ seconds}$ from end of speech/text submission to playhead seek.
* **Resilience:** $100\%$ preservation of main video playback state during any external AI or transcript API failure.