# Security, Privacy & Compliance Policy: Conv-way

## 1. Zero Sign-In & Viewer Privacy Architecture
Conv-way is designed as a privacy-first, zero-account overlay on YouTube:
1. **No User Accounts or PII Collection:** Conv-way does not collect names, email addresses, passwords, OAuth tokens, or persistent user identifiers.
2. **Viewer & Owner YouTube Account Isolation:** All YouTube Data API v3 calls are executed server-side using a dedicated Google Cloud project API key. No viewer's personal YouTube watch history or recommendation feed is accessed via API, and the application owner's personal YouTube account is never used.
3. **Anonymous Shared Cache:** When a live viewer question is added to the shared `way_questions` cache (`LEARNED_LIVE`), only the normalized question text, language, and verified video time range are stored. Client IP addresses, session IDs, and voice recordings are **never** persisted in D1.
4. **Ephemeral Voice Processing:** Voice audio captured during Push-to-Talk or Conv-way Mode is either processed locally via the browser's `Web Speech API` or sent over TLS 1.3 in $\le 30\text{s}$ buffers to Gnani Prisma v3.0 for immediate transcription and discarded immediately after the HTTP response.

---

## 2. Microphone & Hardware Transparency Rules
* **Explicit Permission:** Microphone access (`navigator.mediaDevices.getUserMedia`) is never requested on page load; it is requested only when the viewer presses **Push-to-Talk** or explicitly toggles **Conv-way Mode**.
* **Persistent Visual Indicator:** Whenever the microphone stream is active, the UI displays a high-contrast status badge (`IDLE` | `LISTENING` | `THINKING` | `PLAYING ANSWER` | `WAITING FOR YOU`) and an active hardware kill-switch button that immediately calls `MediaStreamTrack.stop()`.
* **Background Tab Cutoff:** If the user switches tabs or minimizes the browser on mobile while in ambient Conv-way Mode, active microphone streaming is paused or clearly indicated according to platform constraints.

---

## 3. Secret Management & Server-Side Key Protection
* **Strict Server-Side Isolation:** The following secrets must **only** exist in Cloudflare Worker encrypted secrets (`wrangler secret put`) and must **never** be referenced in `VITE_*` client environment variables or bundled into frontend JavaScript:
  * `YOUTUBE_DATA_API_KEY`
  * `SUPADATA_API_KEY`
  * `TRANSCRIPT_API_FALLBACK_KEY`
  * `GNANI_API_KEY` / `GNANI_ACCESS_TOKEN`
  * `GNANI_EVON_ENDPOINT_URL`
  * `TAVILY_API_KEY` / `EXA_API_KEY`
  * `WEB_SEARCH_API_KEY` / `WEB_SEARCH_CX` (Note: Google's Custom Search JSON API is closed to new customers since 20 Jan 2026 and ends on 1 Jan 2027; Google engine is optional and auto-disables. Bing's API was retired in Aug 2025).
  * `ADMIN_CALIBRATION_SECRET`
* **Startup Verification:** Worker endpoints validate required secrets at request time and fail cleanly with `500 MISSING_CONFIGURATION` if a required secret is unconfigured.

---

## 4. Input Validation, SQL Injection & Abuse Prevention
1. **Parameterized D1 Queries:** Every SQL query against Cloudflare D1 must use bound parameters (`db.prepare('SELECT ... WHERE video_id = ?1').bind(videoId)`). String concatenation in SQL or FTS5 `MATCH` expressions is strictly prohibited; FTS5 search terms are sanitized to strip special operator characters (`"`, `*`, `NEAR`, `OR`, `NOT`) before binding.
2. **Strict Schema Validation (Zod):** All incoming JSON payloads, query parameters, YouTube video IDs (`/^[a-zA-Z0-9_-]{11}$/`), and audio uploads (enforcing `<= 2 MB` size and `audio/webm` or `audio/wav` MIME types) are validated via Zod at the Hono middleware boundary.
3. **Edge Rate Limiting & Credit Governor:**
   * Per-IP rate limiting (hashed IP + salt stored in KV with a 2-minute TTL) caps individual viewers at 15 live questions per minute and 5 transcript initializations per 10 minutes.
   * The global **Credit Governor** prevents wallet exhaustion attacks by enforcing the daily Gnani credit cap ($\approx 73\text{--}81$ credits/day) and the 90 searches/day YouTube Data API budget.

---

## 5. YouTube Terms of Service & Embedded Player Compliance
* Both the Primary Player and the Picture-in-Picture (PiP) Player use the official YouTube IFrame Player API without modifying or obscuring YouTube branding, controls, or attribution.
* The PiP player enforces a minimum viewport dimension of $200\times200\text{ pixels}$ in accordance with YouTube Embedded Player requirements.
* The primary player is explicitly paused before the PiP player begins playing an external answer segment so two YouTube video streams never play simultaneously.
* Conv-way never downloads or extracts raw audio/video streams from YouTube.