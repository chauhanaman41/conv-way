# Testing Strategy & Verification Plan: Conv-way

## 1. Testing Philosophy
In compliance with `AGENTS.md`:
* No feature is marked complete based solely on compilation or UI rendering.
* Every feature must be verified end-to-end across **Frontend Interaction $\rightarrow$ Worker Execution $\rightarrow$ D1 Persistence $\rightarrow$ YouTube Player State Restoration**.
* Mock fixtures are strictly confined to `/tests/unit/` and `/tests/fixtures/` and are excluded from production builds.

---

## 2. Test Layers

### 2.1 Unit Tests (`Vitest`)
* **Transcript Windowing (`windowBuilder.test.ts`):**
  * Verify Window 0 contains $300\text{--}450$ words ($\approx 2$ minutes) for fast start.
  * Verify subsequent windows contain $600\text{--}800$ words and stay within $[120\text{s}, 360\text{s}]$ bounds.
  * Verify 30-second overlap between window $N$ and window $N+1$.
  * Verify timestamp validation rejects any segment where `end_sec <= start_sec` or `end_sec > video.duration_sec`.
* **LIFO Playback Call Stack (`playbackStack.test.ts`):**
  * Verify `push()` records `{ videoId, timestamp, playbackRate, volume, branchId }`.
  * Verify nested questions ($T_{\text{origin}} \rightarrow T_{\text{branch\_1}} \rightarrow T_{\text{branch\_2}}$) restore in exact LIFO order on `pop()`, and `returnToOrigin()` jumps directly to $T_{\text{origin}}$ and clears the stack.
  * Verify failed AI requests leave the stack untouched.
* **Credit Governor Math (`governor.test.ts`):**
  * Verify daily cap recalculation from remaining pool divided by remaining days until December 15, 2026 with $10\%$ reserve.
  * Verify step-down transitions at $80.0\%$ and $100.0\%$ utilization.

### 2.2 Backend & Database Integration Tests (`@cloudflare/vitest-pool-workers`)
Runs against a real local D1 SQLite instance with FTS5 enabled:
* **IT-01 (2-Second Gate Enforcement):** Call `POST /api/videos/zIwLWfaAg-8/init` with `watchedSeconds: 1.2`. Assert `400 WATCH_THRESHOLD_NOT_MET` and zero rows written to D1.
* **IT-02 (Idempotent Window Persistence & FTS5):** Call `POST /api/videos/zIwLWfaAg-8/init` with `watchedSeconds: 2.5`. Assert `videos` and `transcript_windows` rows are created and `SELECT * FROM transcript_fts WHERE transcript_fts MATCH 'Starlink'` returns matching windows ranked by `bm25(transcript_fts)`.
* **IT-03 (Transcript Provider Failover):** Simulate HTTP 429 on `SupadataProvider`; verify `TranscriptAdapter` automatically switches to `TranscriptApiProvider`, logs both attempts in `credit_ledger`, and persists windows.
* **IT-04 (Shared Learning Cache):** Submit a live question on `/api/query/ask` that misses `way_questions` but resolves via FTS5 + Evon. Verify the new normalized question and `[start_sec, end_sec]` are inserted into `way_questions` with `source_type = 'LEARNED_LIVE'`, and a second identical request resolves with `cacheSource: "WAY_PREPARED_MATCH"` and `0` new Evon credits.
* **IT-05 (No-Citation Guard on AI Fallback):** When web search returns zero results for an obscure query, verify `/api/query/ask` returns `NO_VERIFIED_MATCH` and **never** fabricates an un-cited AI answer.

### 2.3 End-to-End Browser Verification (`Playwright`)

| Test ID | Scenario | Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **E2E-01** | **Reference Case Study: Musk x Kamath (Ep 16)** | 1. Open video at `00:24:15`.<br>2. Wait $>2\text{s}$ for init.<br>3. Ask *"Why can't Starlink handle dense cities with thousands of satellites?"* | Return point `00:24:17` saved in pill banner; player seeks to `00:27:41` (`1661s`); plays until `00:28:51` (`1731s`); pauses and displays Hand-Back controls; clicking *Continue* restores player to `00:24:17`. |
| **E2E-02** | **External Video Answer via PiP** | 1. Ask a technical question best answered by a different indexed video.<br>2. Observe PiP player. | Main video pauses at $T_{\text{origin}}$; PiP player ($\ge 200\times200\text{ px}$) mounts with external video title, channel name, and time range; plays clip and hands back control. |
| **E2E-03** | **Way Panel Progressive Reveal & 75% Prefetch** | 1. Play video from `00:00`.<br>2. Observe **Way** panel as playhead advances. | Only questions with `trigger_sec <= currentTime` are visible. Next window request fires only after playhead crosses $75\%$ of Window 0. |
| **E2E-04** | **Graceful Degradation on Uncaptioned Video** | 1. Load a video with `caption_status = 'NO_CAPTIONS'`. | **Way** shows 1-line notice (*"Captions unavailable for this video"*); video plays normally; asking a question still searches other indexed videos and verified web fallback. |