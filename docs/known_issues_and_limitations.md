# Known Issues, Constraints & Operational Risks: Conv-way

In accordance with Section 7 (*Development Honesty and Transparency*) of `AGENTS.md`, this document tracks real architectural constraints, third-party quota ceilings, and unresolved dependencies.

---

## 1. External API & Quota Constraints

### KI-01: Unofficial YouTube Transcript Providers & Free-Tier Limits
* **Severity:** High (Architectural Constraint)
* **Description:** The official YouTube Data API v3 does not allow downloading caption tracks for arbitrary third-party videos not owned by the developer. Conv-way uses a swappable server-side `TranscriptAdapter` calling **Supadata** (100 free credits/month at 1 req/sec) and falling back to **TranscriptAPI** (100 free credits). Together, these free tiers permit indexing roughly $\approx 200$ new videos over the 37-day review window ($\approx 5$ new un-cached videos per day).
* **Mitigation Implemented in Design:**
  1. Transcripts are fetched **only** after a viewer has actively watched a video for $\ge 2.0\text{ seconds}$.
  2. Every fetched transcript is permanently stored and indexed in the shared Cloudflare D1 database so it is never fetched twice.
  3. The Home Screen directs viewers to the shared Top 20 Trending Podcasts, maximizing cache reuse across viewers.
  4. When the daily new-transcript budget is reached (or a video lacks captions), the UI honestly reports `TRANSCRIPT_UNAVAILABLE` in the **Way** panel while keeping playback, cross-video D1 search, and verified AI fallback operational.

### KI-02: Unpublished Gnani Credit Rates Prior to Calibration Batch
* **Severity:** Medium (Pending Pre-Submission Calibration)
* **Description:** Gnani does not publicly list exact per-call credit deduction rates for **Prisma v3.0** and **Evon v3.3** against the 3,000-credit pool (which must last 37 days until December 15, 2026, yielding $\approx 81$ credits/day or $\approx 73$ credits/day after a $10\%$ reserve).
* **Mitigation:** `calibration_rates` in D1 is seeded with conservative baseline weights, and the `POST /api/admin/calibrate` endpoint is designed to run a bounded calibration batch (10 Prisma clips + 20 Evon calls, hard-stopped at $\le 60$ credits) before the November 10 submission to record exact empirical rates.

### KI-03: YouTube Data API v3 Default Quota (10,000 Units/Day)
* **Severity:** Medium
* **Description:** `search.list` costs 100 units per call on YouTube Data API v3, limiting uncached external YouTube searches to $\approx 90$ per day after reserving 100 units for the daily Top 20 Trending Podcasts job.
* **Mitigation:** All searches check D1's `transcript_fts` and `search_cache` first. If the 90-search daily cap is reached, cross-video answers gracefully restrict themselves to videos already indexed in D1.

---

## 2. Browser & Hardware Limitations

### KI-04: Mobile Browser Ambient Microphone & Speaker Echo Constraints
* **Severity:** Medium (Platform Limitation)
* **Description:** Mobile Safari (iOS) and Chrome (Android) restrict continuous background microphone capture, and playing video audio over phone speakers without headphones can pollute ambient speech detection despite WebRTC `echoCancellation: true`.
* **Mitigation:** **Push-to-Talk** is the default baseline across all devices, and video playback defaults to **Auto-Pause** (or $15\%$ ducking with headphones) while the user speaks. Ambient **Conv-way Mode** is an explicit opt-in toggle recommended for headphone users.

### KI-05: Browser Native `Web Speech API` Availability
* **Severity:** Low
* **Description:** Browser-native `SpeechRecognition` is supported in Chrome, Edge, and Safari, but is unavailable or restricted in Firefox and certain Android WebViews, and has varying accuracy on code-switched Indian languages.
* **Mitigation:** The client voice pipeline automatically detects `SpeechRecognition` support and error events, falling back transparently to `POST /api/voice/transcribe` (**Gnani Prisma v3.0**) for unsupported browsers and Indian-language queries.