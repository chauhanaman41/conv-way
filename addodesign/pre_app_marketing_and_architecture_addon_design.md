# Add-On UI/UX Specification: Pre-App Editorial Showcase, Scroll Architecture & Active Construction Loop (`Addon_design.md`)

**Version:** 1.1.0  
**Date:** November 8, 2026  
**Extends:** `DESIGN.md` (Desktop System), `MOBILE_DESIGN.md` (Mobile-First System) & `KNOWN_ISSUES.md`  
**Aesthetic Direction:** *Midnight Gallery Wall with Hot Pink Markers* (`#000000` Obsidian Canvas, `#efe6d8` Parchment, `#ffa1f7` Neon Petal, `#4dff00` Acid Lime Dot)  
**Objective:** Present a high-impact, scroll-driven editorial narrative above the live application workspace—explaining **what Conv-way is**, **its core features**, **how each feature is implemented**, **the production tech stack**, and an honest **GIF-style "Active Construction / Evolving Build" showcase** highlighting what is still being fixed and calibrated before the user enters the live player.

---

## 1. Architectural Concept: "The Gallery Walk Before the Workspace"

Rather than dropping a first-time visitor coldly into a utility dashboard, the root page (`/`) acts as a continuous vertical **Midnight Gallery Walk** divided into two macro zones on the same `#000000` Obsidian canvas:

1. **Zone A — The Editorial, Engineering & Construction Exhibition (`Sections 00 — 05`):**
   Positioned at the top of the document. It markets the product vision, demonstrates the non-linear playback call stack as the user scrolls, breaks down every feature and how we implement it under the hood, exposes the real production tech stack, and features a **stepped 8-FPS GIF-style "Under Construction" module** that transparently communicates current engineering limitations and ongoing fixes.
2. **Zone B — The Live Conv-way Application (`Section 06 // LIVE WORKSPACE`):**
   The **Discovery Home (Top 20 Trending Podcasts + Search/URL Paste)** and **Active Watch + Way Workspace** from `DESIGN.md` and `MOBILE_DESIGN.md` are pushed down below Zone A as the culminating destination of the scroll.

### Fast-Track Navigation Rule (Never Trap Returning Users)
* The Minimal Header Bar (`height: 64px` desktop / `52px` mobile) remains pinned at the top with a Ghost Text Link `[SKIP TO LIVE APP ↓]` (`Geist Mono 400`, `13px`, `#aca69c`) that smoothly scrolls (`element.scrollIntoView({ behavior: 'smooth' })`) directly to `#live-workspace`.
* If a user arrives via a deep link with a video parameter (`/?v=zIwLWfaAg-8`), the page automatically scrolls past Zone A directly into `#live-workspace` while keeping Zone A accessible by scrolling up.

---

## 2. Shared Typographic, Numbering & Spacing System

Every section in Zone A strictly follows the **Akash Tyagi** gallery-wall rhythm:

* **Universal Canvas:** `#000000` (Obsidian) — zero cards with gray fills, zero `box-shadow`, zero linear/radial gradients.
* **Section Vertical Rhythm:**
  * **Desktop (`>= 1024px`):** `200px` vertical silence between major numbered sections; `104px` gap between a Section Header and its content block.
  * **Tablet (`768px – 1023px`):** `128px` between sections; `64px` header-to-content gap.
  * **Mobile (`320px – 767px`):** `96px` between sections; `48px` header-to-content gap.
* **Editorial Section Header Pattern (Two-Part Split):**
  * Left: `01 // THE PARADOX` set in `Geist Pixel Triangle 400` (`30px` desktop / `20px` mobile, `#efe6d8`, letter-spacing `-0.033em`).
  * Right: `PROBLEM & VISION` set in `Geist Pixel Triangle 400` (`30px` desktop / `16px` mobile, `#736e68`, letter-spacing `-0.033em`).
  * Bottom border: `1px solid #605c56` (Charcoal hairline).
* **Index Numbering Convention:**
  * All feature rows, implementation stages, tech stack nodes, and construction items use bracketed monospace indices (`[01]`, `[02]`, `[03]`, $\dots$) in `Geist Mono 500` (`13px`, `#aca69c`), turning `#ffa1f7` (Neon Petal) when that item enters the active scroll viewport focal zone.

---

## 3. Section-by-Section Content & Scroll Interaction Blueprint

### Sticky Left Index Rail (Desktop `>= 1280px`)
While scrolling through `Sections 00 — 05`, a minimal `140px`-wide sticky index rail sits in the left margin (`top: 120px`), displaying the active section coordinates in `Geist Mono 400` (`12px`):

```
● 00 // MANIFESTO
  01 // PARADOX
  02 // FEATURES
  03 // PIPELINE
  04 // TECH STACK
  05 // CONSTRUCTION
  06 // LIVE APP ↓
```

* The active section displays the `8px` Acid Lime (`#4dff00`) status dot and `#efe6d8` text; inactive sections use `#736e68` (Ash). Clicking any coordinate jumps directly to that section.

---

### `00 // HERO & PRODUCT MANIFESTO`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [🐧] CONV-WAY            ● SYSTEM READY · [SKIP TO APP ↓]  12:41 IST · EN    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [64px vertical silence]                                                     │
│                                                                              │
│  ┌──────────┐   DON'T PAUSE YOUR CURIOSITY,                                  │
│  │  DUAL    │   LET THE VIDEO FOLLOW IT.                                     │
│  │ PENGUIN  │                                                                │
│  │  MARK    │   AMBIENT MULTI-MODAL INTELLIGENCE FOR                         │
│  │ (#efe6d8)│   NON-LINEAR YOUTUBE PLAYBACK // 2026                          │
│  └──────────┘                                                                │
│                                                                              │
│  [104px vertical separation]                                                 │
│                                                                              │
│  [00.1] WHAT IS CONV-WAY?                [00.2] LIVE ORCHESTRATION STATUS    │
│  Conv-way is a zero-sign-in web app      ● ZERO SIGN-IN · PUBLIC YOUTUBE API │
│  that lets you talk to any YouTube       ● 2.0s WATCH CONFIRMATION GATE      │
│  video while it plays. Ask a question    ● LIFO PLAYHEAD CALL STACK READY    │
│  out loud or tap the quiet "Way"                                             │
│  panel: Conv-way saves your exact        [   LAUNCH LIVE WORKSPACE (#ffa1f7)]│
│  timestamp, plays only the answering                                         │
│  video clip, and brings you right back.  ↓ SCROLL TO EXPLORE ARCHITECTURE    │
└──────────────────────────────────────────────────────────────────────────────┘
```

* **Brand Integration:** Displays the **Dual-Penguin Silhouette SVG** (`48px × 64px` in `#efe6d8` Parchment; inner baby penguin in negative `#000000` space, symbolizing the parent video timeline and the nested clarification detour).
* **Single Primary CTA Rule:** The `"LAUNCH LIVE WORKSPACE ↓"` button is the **only** filled `#ffa1f7` (Neon Petal) pill on the Hero screen (`border-radius: 40px`, `padding: 12px 24px`, `#000000` text, `Geist 500 13px`).

---

### `01 // THE PASSIVE CONSUMPTION PARADOX` — `PROBLEM & VISION`

Explains *why* Conv-way exists using a **Scroll-Triggered Timeline Detour Visualizer**.

#### Content Columns:
* **Left Column (`[01] LINEAR FRICTION — OLD WAY`):**
  Lists the 5-step context-switching penalty of traditional video players in `Geist Mono 13px #736e68`:
  1. `01. Pause video manually at [00:24:22]`
  2. `02. Open new browser tab & lose visual focus`
  3. `03. Type search query & sift through unverified text`
  4. `04. Scrub back to find original timestamp`
  5. `05. Result: Mental fatigue & abandoned curiosity`
* **Right Column (`[02] NON-LINEAR GRAPH — CONV-WAY`):**
  Lists the 4 Core Principles of Conv-way in `Geist 500 14px #efe6d8`:
  * **Best Answer on YouTube Wins:** Matches meaning & key terms across the current video and all of YouTube.
  * **A Face Behind Every Answer:** Video segments with named speakers first—never scraped articles.
  * **Never Lose Your Place:** LIFO Call Stack preserves your exact millisecond before any detour.
  * **Viewer Always in Control:** Explicit Hand-Back at the end of every answer clip.

#### Scroll Interaction #1 — The Mechanical LIFO Call Stack Scrubber:
Below the two columns sits a full-width (`100%`) flat architectural diagram driven by the user's scroll position (`IntersectionObserver` + scroll ratio $p \in [0, 1]$ through Section `01`):

```
SCROLL PROGRESS: [45%] ──► EXECUTING DETOUR: PUSH(1465s) -> SEEK(1661s)
────────────────────────────────────────────────────────────────────────────────
MAIN TIMELINE:  00:00 ───────────◈ [00:24:25 SAVED]  · · · · · · · · · 02:02:25
                                 │
                                 └──► [BRANCH 1: 00:27:41 — 00:28:51] ● PLAYING
                                      "Elon explains 550 km beam cone physics"
                                      │
                                      └──► [POP(1465s) -> RESUME 00:24:25]
```

* **Scroll $0\% \rightarrow 30\%$:** The playhead dot (`#4dff00`) moves along the primary timeline from `00:23:33` to `00:24:22` and displays the spoken query: *"Wait, why can't Starlink handle dense cities?"*
* **Scroll $30\% \rightarrow 70\%$:** A `#ffa1f7` (Neon Petal) anchor diamond `◈` locks at `00:24:25` (`push(1465)`), and a `1px solid #ffa1f7` orthogonal branch line extends down to the answering segment `[00:27:41 — 00:28:51]`.
* **Scroll $70\% \rightarrow 100\%$:** The branch completes at `00:28:51`, triggers the Hand-Back decision state, pops the stack (`pop()`), and reconnects to `00:24:25`.

---

### `02 // CORE CAPABILITIES` — `06 PRODUCTION FEATURES`

A 6-row editorial index where each feature is presented with its exact product rule and an interactive micro-preview.

```
02 // CORE CAPABILITIES                                 06 PRODUCTION FEATURES
──────────────────────────────────────────────────────────────────────────────
[104px vertical separation]

[01] AMBIENT AUDIO ISOLATION & DUCKING                 WEBRTC AEC + GAIN NODE
     Speak without pausing. Primary video volume attenuates to 18% on headphone
     setups or auto-pauses on mobile speakers to prevent acoustic echo.
     ─────────────────────────────────────────────────────────────────────────
[02] FOUR WAYS TO ASK                                  PTT · VAD · TEXT · WAY
     Push-to-Talk baseline on every device, opt-in continuous Conv-way VAD mode,
     direct text input, or one-tap questions in the quiet Way side panel.
     ─────────────────────────────────────────────────────────────────────────
[03] "WAY" PREDICTED QUESTIONS PANEL                   600–800 WORD WINDOWS
     Pre-computes 5–8 questions one 4-minute speech window ahead. Questions
     remain hidden until the playhead reaches their exact spoken timestamp.
     ─────────────────────────────────────────────────────────────────────────
[04] IN-VIDEO SEEK & EXTERNAL PICTURE-IN-PICTURE       >= 200x200 PX COMPLIANT
     Plays only the exact [start_sec, end_sec] answer. In-video answers seek
     the main player; cross-video answers open a YouTube-compliant PiP frame.
     ─────────────────────────────────────────────────────────────────────────
[05] LIFO PLAYHEAD CALL STACK & HAND-BACK              NESTED DETOUR MEMORY
     Supports multi-hop "Dive Deeper" follow-ups: Stack = [T_origin, T_b1, T_bn].
     Never auto-returns abruptly; hands control back to the viewer after each clip.
     ─────────────────────────────────────────────────────────────────────────
[06] VERIFIED 30–40 WORD AI FALLBACK                   CITATION-GATED SYNTHESIS
     When no video clip answers the query or a claim is contradicted by research,
     Evon v3.3 synthesizes a 30–40 word answer citing a live retrieved web URL.
```

#### Scroll Interaction #2 — Active Row Inspection & Live Demo Trigger:
* As each row `[01]` through `[06]` crosses the center $40\%$ band of the viewport, its left index `[0X]` shifts from `#aca69c` (Bone) to `#ffa1f7` (Neon Petal) and expands a single-line `Geist Mono 12px` technical proof strip showing the real math/rule:
  * Row `[01]` Proof: `AudioConstraint: { echoCancellation: true, noiseSuppression: true } · DuckTarget: 18%`
  * Row `[03]` Proof: `WindowSize: 600–800 words (~4 min) · PrefetchTrigger: 75% playhead · SeekDebounce: 3.5s`
  * Row `[05]` Proof: `CallStack = [T_origin, T_branch_1, ..., T_branch_n] · Action: [CONTINUE] | [DIVE DEEPER] | [ASK]`
* Clicking any row's `[TRY IN PLAYER ↓]` Ghost Text Link scrolls to `#live-workspace` and highlights that exact control on the player.

---

### `03 // HOW WE IMPLEMENT IT` — `END-TO-END ENGINEERING PIPELINE`

This section markets *how* the engineering works under the hood—proving to technical reviewers and users that Conv-way is a frugal, real-data system built for Cloudflare's edge and Gnani's AI suite.

#### Scroll-Stepped 5-Stage Architecture Pipeline:
Rendered as a 2-column sticky scroll-story on desktop (left column pins an interactive data-packet diagram; right column scrolls through the 5 engineering stages) and a vertical timeline on mobile:

| Stage Index | Engineering Mechanism | How We Implement It (Displayed in UI) | Saves / Guarantees |
| :--- | :--- | :--- | :--- |
| **`STAGE 01`** | **2-Second Watch Confirmation Gate** | Client monitors `YT.PlayerState.PLAYING`. `POST /api/videos/:id/init` is blocked (`400 WATCH_THRESHOLD_NOT_MET`) until `watchedSeconds >= 2.0`. | Zero wasted transcript fetches on bounced clicks. |
| **`STAGE 02`** | **Swappable Transcript Adapter & Windowing** | Worker calls **Supadata API** (primary) $\rightarrow$ **TranscriptAPI** (fallback). Captions are chunked into **600–800 word windows** (~30 rows per 2-hour podcast instead of 3,600+ lines) and indexed into **Cloudflare D1 SQLite FTS5** (`bm25()`). | Cuts D1 database row writes by $>99\%$; $\approx 0.2\text{ MB}$ per 2-hour video. |
| **`STAGE 03`** | **Hybrid Zero-Credit-First Voice Routing** | Voice queries route to the browser's native `Web Speech API` (`SpeechRecognition`) first at **0 credit cost**. Automatically falls back to **Gnani Prisma v3.0** ($\le 30\text{s}$ audio clips) for unsupported browsers or 9 Indian languages (`hi`, `bn`, `mr`, `gu`, `pa`, `kn`, `te`, `ta`, `ml`). | Preserves Gnani credit pool while supporting multilingual Indian speech. |
| **`STAGE 04`** | **Shared "Way" Cache & Learned Queries** | **Gnani Evon v3.3 (30B MoE)** predicts 5–8 questions and `[start_sec, end_sec]` ranges per window, verified against the transcript. Cached in D1 + Cloudflare Edge CDN (`s-maxage=604800`). Live questions that miss the cache are normalized and saved (`LEARNED_LIVE`) for all future viewers. | One viewer's compute serves every subsequent viewer watching the same video. |
| **`STAGE 05`** | **3,000-Credit Governor & Step-Downs** | Dynamically enforces $\text{Daily Cap} = \frac{\text{Remaining Pool}}{\text{Days Left}} \times 0.90$ ($\approx 73\text{ credits/day}$). Steps down speculative prefetching at $80\%$ and switches strictly to cached **Way** + FTS5 + browser STT at $100\%$. | $100\%$ uptime of core video playback and restoration even at zero AI credits. |

---

### `04 // PRODUCTION TECH STACK` — `EDGE & AI INFRASTRUCTURE`

Presents the complete technology stack from `TECH_STACK.md` as an interactive architectural specification table.

```
04 // PRODUCTION TECH STACK                            CLOUDFLARE + GNANI AI
──────────────────────────────────────────────────────────────────────────────
[104px vertical separation]

LAYER                 TECHNOLOGY                     PRODUCTION ROLE & BUDGET
──────────────────────────────────────────────────────────────────────────────
[01] CLIENT RUNTIME   React 18 · TypeScript · Vite   LIFO Call Stack + Dual YT IFrame
                      Tailwind CSS · Zustand 5       Zero on-device model downloads
──────────────────────────────────────────────────────────────────────────────
[02] AUDIO & VOICE    WebRTC AEC + Web Audio API     85Hz–3000Hz RMS VAD + 18% Ducking
                      Web Speech API + Gnani Prisma  Free native STT -> Prisma v3.0
──────────────────────────────────────────────────────────────────────────────
[03] EDGE COMPUTE     Cloudflare Pages + Workers     Hono Router · Zod · 0ms Cold Start
                      Cloudflare Cron Triggers       100,000 req/day · Daily Top 20 Job
──────────────────────────────────────────────────────────────────────────────
[04] DATA & SEARCH    Cloudflare D1 (SQLite + FTS5)  BM25 Window Search · 5GB Free Storage
                      Cloudflare Workers KV          Edge Governor & Rate-Limit Snapshots
──────────────────────────────────────────────────────────────────────────────
[05] AI & CITATIONS   Gnani Evon v3.3 · Timbre TTS   Way Prediction · Rerank · 30-40w AI
                      Supadata · YT Data API v3      Swappable Captions · Verified URLs
```

#### Scroll Interaction #3 — Live Browser & Edge Capability Probe:
Directly beneath the Tech Stack table sits a **Live Client & Edge Telemetry Bar** populated from real runtime APIs (never hardcoded):
* `BROWSER STT SUPPORT:` Reads `Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)` $\rightarrow$ displays `● NATIVE WEB SPEECH READY (0 CREDITS)` or `○ FALLBACK TO GNANI PRISMA V3.0`.
* `WEBRTC ECHO CANCELLATION:` Reads `navigator.mediaDevices.getSupportedConstraints().echoCancellation` $\rightarrow$ displays `● HARDWARE AEC SUPPORTED`.
* `DEVICE & NETWORK TIER:` Reads `navigator.connection?.effectiveType` and `Save-Data` $\rightarrow$ displays `● FULL MODE` or `● DATA-SAVER LIGHT MODE`.
* `EDGE GOVERNOR STATUS:` Reads live `GET /api/system/status` $\rightarrow$ displays real D1 latency (`ms`) and current Governor step-down state (`NORMAL` | `CONSERVE_80` | `CACHED_ONLY_100`).

---

### `05 // UNDER CONSTRUCTION` — `EVOLVING BUILD & ACTIVE FIXES (GIF-STYLE KINETIC MODULE)`

To set honest expectations before the viewer enters the live workspace—and to honor Section 7 of `AGENTS.md` (*Development Honesty and Transparency*)—Section `05` features a dedicated **GIF-Style Kinetic Construction Module** that visually and textually communicates: *"Conv-way is an active work in progress; several subsystems are still being calibrated, rate-limited, and fixed."*

```
05 // UNDER CONSTRUCTION                               ACTIVE FIXES // v0.1.0-BETA
──────────────────────────────────────────────────────────────────────────────
/// WORK IN PROGRESS · REAL DATA ONLY · ACTIVE ENGINEERING CALIBRATION ///
──────────────────────────────────────────────────────────────────────────────
[64px vertical separation]

┌───────────────────────────────────────┐  [05.1] WHY THIS SECTION EXISTS
│ FRAME 07/12 · 8 FPS · [GIF LOOP]      │  Conv-way is a live engineering build,
│                                       │  not a polished mock prototype. Because
│        ╔═════════════════════╗        │  every feature runs on real APIs and
│        ║  CRANE // RIG 01    ║        │  strict free-tier quotas, several areas
│        ╚══════════╤══════════╝        │  are still being fixed and calibrated:
│                   │ (1px #ffa1f7)     │
│              ┌────┴────┐              │  [FIX 01] TRANSCRIPT QUOTA CEILING
│              │ [WIN 06]│◄── WELDING   │  Supadata & TranscriptAPI free tiers
│              └─────────┘    SPARKS *  │  limit new un-cached videos to ~5/day
│     [🐧]      ┌─────────┐             │  at 1 req/sec. Reuse the Top 20 list!
│   PENGUIN     │ [WIN 05]│             │  ─────────────────────────────────────
│   FOREMAN     ├─────────┤             │  [FIX 02] GNANI CREDIT CALIBRATION
│   WATCHING    │ [WIN 04]│             │  3,000-credit pool (~73 credits/day cap)
│               └─────────┘             │  is undergoing empirical rate tuning.
│  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  │  ─────────────────────────────────────
│  STATUS: ASSEMBLING TIMELINE GRAPH... │  [FIX 03] MOBILE SPEAKER ECHO (VAD)
└───────────────────────────────────────┘  Ambient VAD works best with headphones;
                                           mobile speakers default to Push-to-Talk.
```

#### Visual & Technical Specification of the "GIF-Like" Construction Loop:
To look like a classic looping mechanical GIF while staying 100% faithful to the **Akash Tyagi** aesthetic (zero raster blur, zero cheesy yellow clipart, pure `#000000` Obsidian canvas with `#efe6d8` Parchment and `#ffa1f7` Neon Petal):

1. **Stepped 8-FPS Frame Rate (`steps(8, end)`):**
   * The animation is built as an inline SVG + CSS/Canvas frame loop locked to **`8 frames per second`** (`animation-timing-function: steps(8, end)`), giving it the unmistakable tactile cadence of an editorial retro-tech GIF.
   * A live frame counter in the top-left corner of the frame box ticks through `FRAME 01/08 · 8 FPS · LIVE BUILD` in `Geist Mono 400 11px #736e68`.
2. **What the Looping Animation Depicts (4-Second Cycle):**
   * **Frames 01–03 (The Hoist):** A `1px solid #aca69c` wireframe gantry crane lowers a glowing `#ffa1f7` (Neon Petal) transcript block labeled `[WINDOW 06 · 680W]` onto a stack of indexed blocks (`[WIN 04]`, `[WIN 05]`), while the **Conv-way Dual-Penguin** stands on the left wearing a wireframe surveyor's hard-hat outline (`1px solid #efe6d8`).
   * **Frames 04–06 (The Weld & Calibration):** Where `[WINDOW 06]` meets the stack, pixel-art sparks (`4px × 4px` squares in `#ffa1f7` Neon Petal and `#4dff00` Acid Lime) burst outward, and a horizontal calibration laser line scans across the penguin and stack.
   * **Frames 07–08 (The Glitch & Re-Alignment):** One block tilts slightly with a monospace tag `[FIXING TIMESTAMP DRIFT...]`, the crane nudges it flush into alignment (`[ALIGNED · 1661.0s]`), and the loop repeats seamlessly.
3. **Architectural Hazard Marquee Strip:**
   * Above and below the construction module runs a `28px`-tall architectural ticker (`border-top: 1px solid #605c56`, `border-bottom: 1px solid #605c56`) with diagonal `45deg` hairline ticks in `#605c56` and `#ffa1f7` that translates horizontally as the user scrolls:
     `/// UNDER ACTIVE CONSTRUCTION · REAL API QUOTAS IN EFFECT · EXPECT ROUGH EDGES WHILE WE CALIBRATE ///`
4. **Interactive "Known Issues & Fix Progress" Ledger (Right Column):**
   * Pulls directly from `KNOWN_ISSUES.md` (`KI-01` through `KI-05`) and displays each item with an honest status badge:
     * `[KI-01 · MITIGATED]` **Unofficial Caption APIs & ~5 New Videos/Day Free Limit:** Cached permanently in D1 after 2s watch; Top 20 podcasts pre-warmed.
     * `[KI-02 · IN CALIBRATION]` **Gnani Prisma & Evon Credit Deduction Rates:** Capped at $\approx 73\text{ credits/day}$ with automatic step-down to browser STT.
     * `[KI-03 · QUOTA GUARDED]` **YouTube Data API 10,000 Unit Daily Ceiling:** Capped at 90 external searches/day; D1 FTS5 searched first.
     * `[KI-04 · HARDWARE LIMIT]` **Mobile Speaker Echo on Ambient Voice:** Push-to-Talk + Auto-Pause enforced as safe mobile baseline.
     * `[KI-05 · BROWSER VARIANCE]` **Firefox / WebView Native Speech Gaps:** Automatic fallback to `POST /api/voice/transcribe` (Gnani Prisma v3.0).

---

## 4. Section `06 // LIVE WORKSPACE` — Transition into the Application

Immediately below Section `05 // UNDER CONSTRUCTION` (separated by `200px` desktop / `96px` mobile vertical silence) sits the live application anchor `#live-workspace`:

```
06 // LIVE WORKSPACE                                  TRY CONV-WAY NOW // LIVE
──────────────────────────────────────────────────────────────────────────────
```

* **Scroll Handoff Behavior:**
  * As `#live-workspace` reaches the top of the viewport, the Sticky Left Index Rail fades out (`opacity: 0`) so the full `1400px` width is dedicated to the **Discovery Grid** and the **68% / 32% Watch + Way Workspace** (`DESIGN.md`).
  * On mobile viewports (`< 1024px`), scrolling into `#live-workspace` activates the **Bottom Navigation Bar** (`01 // HOME`, `02 // SEARCH & URL`, `03 // PLAYER`) and **Persistent Mini-Player** defined in `MOBILE_DESIGN.md`, with an added fourth utility link `[↑ ARCHITECTURE]` so mobile users can scroll back up to the exhibition at any time.

---

## 5. Responsive & Performance Rules for Zone A

1. **Zero Layout Shift (`CLS = 0`):** The GIF-style SVG construction canvas has an explicit aspect ratio (`aspect-ratio: 4 / 3`, `min-height: 280px`) reserved in CSS so it never causes layout jumps while scrolling on mobile (`320px+`) or desktop.
2. **Battery & Off-Screen Pause (`IntersectionObserver`):** When the GIF-style Construction Loop in Section `05` or the Timeline Scrubber in Section `01` scrolls out of the viewport (`isIntersecting === false`), its CSS/requestAnimationFrame loop pauses automatically (`animation-play-state: paused`) so zero CPU/GPU cycles are wasted while the viewer watches a YouTube video in Section `06`.
3. **Reduced Motion & Low-End Device Respect:** If `prefers-reduced-motion: reduce` or `navigator.connection?.saveData === true` is detected, the 8-FPS construction loop renders its static `FRAME 05/08 (WELDING)` blueprint frame with all text callouts intact.