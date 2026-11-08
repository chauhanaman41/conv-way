# UI/UX Design Specification: Conv-way (`DESIGN.md`)

**Version:** 1.0.0  
**Date:** November 8, 2026  
**Aesthetic Direction:** *Midnight Gallery Wall with Hot Pink Markers* (Inspired by Akash Tyagi)  
**Theme:** Pure Obsidian Dark (`#000000`)  
**Scope:** Complete Visual System, Responsive Layouts, Playback Orchestration States, Picture-in-Picture (PiP), LIFO Stack Breadcrumbs, and the **Way** Panel.

---

## 1. Design Philosophy & Editorial Principles

Conv-way rejects the cluttered, neon-gradient "AI dashboard" trope. Instead, it treats long-form video consumption as a **midnight gallery wall**: a pure `#000000` Obsidian canvas, warm sepia-toned Parchment typography (`#efe6d8`), monospace technical telemetry (`Geist Mono`), pixel-display editorial dividers (`Geist Pixel Triangle`), and a single chromatic action color—**Neon Petal (`#ffa1f7`)**—used strictly as functional punctuation.

### Core Rules of the Visual System
1. **True Zero-Elevation Flatness:** There are **zero** `box-shadow` stacks, **zero** background gradients, **zero** glassmorphism blurs (`backdrop-filter`), and **zero** outer glows. Surfaces are separated purely by `1px solid #605c56` (Charcoal) hairlines, tonal contrast, and generous whitespace.
2. **Single Primary Chromatic Action (`#ffa1f7`):** Across any active viewport state, only **one** element may wear the filled Neon Petal (`#ffa1f7`) pill surface:
   * **On Home/Discovery:** The `"WATCH VIDEO"` / `"SEARCH"` trigger.
   * **During Active Playback:** The `"HOLD TO SPEAK"` (Push-to-Talk) primary trigger.
   * **During End-of-Clip Hand-Back:** The `"CONTINUE VIDEO [MM:SS]"` return trigger.
   All secondary actions use flat hairline borders (`#aca69c` or `#605c56`) or Ghost Text Links.
3. **Edge-to-Edge Media Frames (`0px` Radius):** Both the Primary YouTube IFrame Player, the Picture-in-Picture (PiP) external player, and all Top 20 Podcast thumbnails render with sharp `0px` corners directly on the `#000000` canvas. Pill radii (`40px` and `1000px`) are reserved exclusively for interactive buttons and status dots.
4. **Text-Only Navigation (No Decorative Icons):** Headers, footers, and mode switches rely on crisp `Geist` and `Geist Mono` typography rather than icon clutter. The only non-typographic status shape is the `8px` Acid Lime (`#4dff00`) live indicator dot.
5. **Production Honesty in UI:** In compliance with `AGENTS.md`, no component ever renders simulated waveforms, random numbers, or fake states. Audio visualizers read directly from the Web Audio API `AnalyserNode`, and degraded states (missing captions, credit cap reached, quota exhausted) are communicated with calm, one-line typographic clarity.

---

## 2. Color Tokens & Surface Hierarchy

Every neutral carries a warm parchment/sepia undertone—cool blue-grays (`#cbd5e1`, `#1e293b`) and pure stark white (`#ffffff`) are strictly forbidden.

| Token Name | CSS Variable | Hex Value | Role in Conv-way |
| :--- | :--- | :--- | :--- |
| **Obsidian Canvas** | `--bg-obsidian` | `#000000` | Universal page background, player backdrop, PiP container surface, and inverted text color on `#ffa1f7` pill buttons. |
| **Parchment** | `--text-parchment` | `#efe6d8` | Primary body copy, video titles, active **Way** questions, transcribed user speech, and display headings. |
| **Bone** | `--text-bone` | `#aca69c` | Secondary text, channel names, speaker attributions, secondary button borders (`1px solid #aca69c`), and AI fallback reasoning text. |
| **Ash** | `--text-ash` | `#736e68` | Muted metadata, inactive timestamps, header clock, collapsed earlier-window labels, and hover underlines on Ghost Text Links. |
| **Charcoal** | `--border-charcoal` | `#605c56` | Structural `1px` hairline dividers, **Way** panel separators, skeleton loader bars, and input bottom borders. |
| **Neon Petal** | `--accent-petal` | `#ffa1f7` | The single primary Pill CTA fill per view, active LIFO branch marker, and `[AI SYNTHESIS]` verification badge label. |
| **Acid Lime** | `--signal-lime` | `#4dff00` | Exclusively for the `8px` live status dot (`SYSTEM READY`, `CONV-WAY AMBIENT ON`, `MIC LISTENING`) and subtle `8%` opacity highlight wash on the active **Way** question row. |

### CSS Custom Properties Declaration (`src/client/styles/tokens.css`)
```css
:root {
  /* Surfaces & Neutrals */
  --bg-obsidian: #000000;
  --text-parchment: #efe6d8;
  --text-bone: #aca69c;
  --text-ash: #736e68;
  --border-charcoal: #605c56;

  /* Chromatic Punctuation */
  --accent-petal: #ffa1f7;
  --signal-lime: #4dff00;
  --signal-lime-wash: rgba(77, 255, 0, 0.08);

  /* Typography Families */
  --font-sans: 'Geist', 'Inter', -apple-system, sans-serif;
  --font-display: 'Geist Pixel Triangle', 'Space Mono', monospace;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  /* Layout & Spacing (8px base unit) */
  --page-max-width: 1400px;
  --section-gap-desktop: 200px;
  --section-header-gap: 104px;
  --element-gap: 16px;

  /* Radii */
  --radius-media: 0px;
  --radius-button: 40px;
  --radius-pill: 1000px;
}
```

---

## 3. Typography & Type Scale

All font families enable OpenType features: `font-feature-settings: "blwf" 1, "cv03" 1, "cv04" 1, "cv09" 1, "cv11" 1;`.

| Role | Typeface | Weight | Size | Line Height | Letter Spacing | Color | Usage in Conv-way |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Section Header** | `Geist Pixel Triangle` | `400` | `30px` (`22px` mobile) | `1.33` | `-0.033em` (`-1px`) | `#efe6d8` (Left) / `#736e68` (Right) | All-caps section dividers (`TRENDING PODCASTS`, `WAY // WINDOW 06`, `PAUSED AT [00:24:15]`). |
| **Video Title / Lead** | `Geist` | `600` | `15px` | `1.33` | `-0.013em` (`-0.2px`) | `#efe6d8` | Active video title, Top 20 showcase titles, and live transcribed question readout. |
| **Body / Way Question** | `Geist` | `500` | `14px` | `1.23` | `-0.029em` | `#efe6d8` | **Way** predicted question items, 30–40 word AI fallback body text, and intro bio copy. |
| **UI Control / Pill CTA** | `Geist` | `500` | `13px` | `1.14` | `-0.031em` | `#000000` (on `#ffa1f7`) or `#efe6d8` | Primary Pill CTA text, Ghost Text Links, and Hand-Back decision buttons. |
| **Technical Telemetry** | `Geist Mono` | `400` / `500` | `13px` | `1.23` | `-0.031em` | `#aca69c` / `#736e68` | Timestamps (`[00:24:15]`), LIFO stack coordinates, speaker/channel labels, header clock, and credit governor state. |
| **Micro Caption** | `Geist Mono` | `400` | `12px` | `1.20` | `0px` | `#736e68` | Citation URLs, audio ducking percentage (`DUCK 18%`), and window word-count badges. |

---

## 4. Global Layout & Spatial Architecture

### 4.1 Minimal Header Bar (Universal Across Views)
A single-row static line (`height: 64px`, `max-width: 1400px`, `border-bottom: 1px solid #605c56`) with zero icons, zero logos, and zero hamburger menus:
* **Left:** Product identity `CONV-WAY` in `Geist 600` (`14px`, `#efe6d8`, tracking `-0.029em`). When watching a video, clicking `CONV-WAY` acts as a Ghost Text Link to return to the Discovery view.
* **Center-Right:** Live System Status Indicator—an `8px` Acid Lime (`#4dff00`) circle (`border-radius: 1000px`) paired with `Geist 500` (`13px`, `#efe6d8`) showing the real-time state:
  * `IDLE · READY`
  * `LISTENING · MIC ACTIVE`
  * `THINKING · ROUTING QUERY`
  * `PLAYING ANSWER · [MM:SS — MM:SS]`
  * `WAITING FOR YOU · HAND-BACK`
* **Far Right:** Local clock (`08:15 IST`), active language code (`LANG: EN`), and Credit Governor status (`CAP: NORMAL`) in `Geist Mono 400` (`13px`, `#736e68`).

---

### 4.2 View 1: Discovery & Home Screen (Gallery-Wall Rhythm)

The Home Screen follows the exact **Akash Tyagi** vertical rhythm (`max-width: 1400px`, `200px` vertical gaps between major sections):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CONV-WAY                               ● IDLE · READY    08:15 IST · LANG:EN │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [64px vertical silence]                                                     │
│                                                                              │
│  DON'T PAUSE YOUR CURIOSITY,             ● ZERO SIGN-IN · PUBLIC YOUTUBE API │
│  LET THE VIDEO FOLLOW IT.                                                    │
│                                          [Paste YouTube URL or search term_] │
│  Talk to any YouTube video while it      ─────────────────────────────────── │
│  plays. Conv-way jumps to the exact                                          │
│  answering moment and brings you         [      OPEN OR SEARCH  (#ffa1f7)  ] │
│  back to where you left off.                                                 │
│                                                                              │
│  [200px vertical gallery gap]                                                │
│                                                                              │
│  TRENDING PODCASTS                                    TOP 20 // 08 NOV 2026  │
│  ──────────────────────────────────────────────────────────────────────────  │
│  [104px vertical separation]                                                 │
│                                                                              │
│  ┌───────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │                                   │  │                                  │ │
│  │   EDGE-TO-EDGE VIDEO THUMBNAIL    │  │   EDGE-TO-EDGE VIDEO THUMBNAIL   │ │
│  │   (0px radius, no card border)    │  │   (0px radius, no card border)   │ │
│  │                                   │  │                                  │ │
│  └───────────────────────────────────┘  └──────────────────────────────────┘ │
│  [01] NIKHIL KAMATH · 02:02:25 · READY  [02] LEX FRIDMAN · 03:14:10 · READY  │
│  WTF is with Elon Musk? | People by      Dario Amodei: Anthropic, Claude &   │
│  WTF Ep 16                              the Future of AI                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

* **Two-Column Asymmetric Intro & Search Block:**
  * **Left Column (`55%` width):** Condensed 2-paragraph editorial statement in `Geist 500` (`14px`, `#efe6d8`, `16px` paragraph spacing).
  * **Right Column (`45%` width, `48px` column gap):** Holds the `8px` `#4dff00` live status indicator, a flat bottom-bordered search/URL input (`background: #000000`, `border-bottom: 1px solid #605c56`, `Geist Mono 13px`, `#efe6d8`), and the single filled `#ffa1f7` Pill CTA (`"OPEN OR SEARCH"`).
* **Section Header with Date Stamp:**
  * Left label: `TRENDING PODCASTS` in `Geist Pixel Triangle 400` (`30px`, `#efe6d8`, `-0.033em`).
  * Right label: `TOP 20 // DD MMM YYYY` in `Geist Pixel Triangle 400` (`30px`, `#736e68`, `-0.033em`).
  * Followed by `104px` of vertical whitespace before the Top 20 showcase grid.
* **Project Showcase Cards (Top 20 Podcasts):**
  * 2-column asymmetric gallery grid on desktop (`48px` horizontal gap, `104px` vertical row gap); 1-column full-bleed on mobile.
  * **Zero Card Chrome:** The high-resolution YouTube thumbnail sits edge-to-edge on `#000000` with `border-radius: 0px`.
  * Below the image (`16px` gap):
    * Line 1 (`Geist Mono 400`, `13px`, `#aca69c`): `[01] CHANNEL NAME · DURATION [HH:MM:SS] · CAPTION STATUS [READY / ON-DEMAND]`
    * Line 2 (`Geist 500`, `15px`, `#efe6d8`): Full episode title (hover reveals a `1px solid #736e68` underline).

---

### 4.3 View 2: Active Watch & Conversation View (Desktop & Mobile)

When a viewer selects a podcast or pastes a link, the viewport transitions into the **Watch Canvas** (`max-width: 1400px` centered on `#000000`).

#### Desktop Layout (`>= 1024px`) — Side-by-Side Asymmetric Split
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← CONV-WAY                       ● PLAYING ANSWER     08:15 IST · DUCK: 18%  │
├───────────────────────────────────────────────────┬──────────────────────────┤
│ [SAVED ORIGIN: 00:24:15] → [EXCERPT: 00:27:41]    │ WAY // 24:00 — 28:00     │
├───────────────────────────────────────────────────┤──────────────────────────┤
│                                                   │                          │
│                                                   │ [00:24:10]               │
│                                                   │ Why are Starlink         │
│           PRIMARY YOUTUBE IFRAME PLAYER           │ satellites orbiting at   │
│           (16:9 · 0px radius · Edge-to-Edge)      │ 550 km instead of GEO?   │
│                                                   │ ──────────────────────── │
│                                                   │ [00:24:22] ● ACTIVE      │
│                                                   │ Why can't Starlink serve │
│                                                   │ dense cities directly?   │
│                                                   │ ──────────────────────── │
├───────────────────────────────────────────────────┤ [EARLIER WINDOWS (6) +]  │
│ ELON MUSK · STARLINK BEAM CONE PHYSICS [27:41–28:51]                         │
│                                                   │                          │
│ [ CONTINUE VIDEO 00:24:15 (#ffa1f7) ] [DIVE DEEPER]│ [Ask a question...    ]  │
│ [ ASK ANOTHER ]   CONV-WAY AMBIENT: ○ OFF          │ ──────────────────────── │
└───────────────────────────────────────────────────┴──────────────────────────┘
```

* **Left Stage (`68%` width):**
  1. **LIFO Call Stack & Return-Point Strip (`height: 40px`):** Sits directly above the video frame so it is never obscured.
  2. **Primary YouTube IFrame Player (`16:9` aspect ratio, `0px` radius):** Edge-to-edge on the Obsidian canvas.
  3. **Orchestration Control Bar & Hand-Back Dock:** Directly below the player (`24px` top margin).
* **Right Stage — The "Way" Panel (`32%` width, separated by `1px solid #605c56` hairline and `32px` inner padding):**
  * Quietly lists predicted questions for the active 4-minute speech window.

#### Mobile Layout (`< 1024px`) — One-Handed Stacked Flow
1. **Top Bar (`48px`):** `← CONV-WAY` left, `8px` `#4dff00` status dot + state label right.
2. **Sticky Return-Point Strip (`36px`):** Always visible immediately above the video (`ORIGIN SAVED [00:24:15] · TAP TO RETURN`).
3. **Full-Bleed YouTube Player (`100vw`, `16:9`, `0px` radius):** Meets the viewport edges without horizontal padding.
4. **One-Handed Control & Hand-Back Bar:** Touch-friendly `48px` height pill targets (`Push to Talk` or `Continue Video [00:24:15]`, `Conv-way Mode` toggle, and inline text input).
5. **The "Way" Bottom Sheet / Scrollable Feed:** Sits directly below the controls with a `Geist Pixel Triangle` `20px` header (`WAY // QUESTIONS NOW`).

---

## 5. Detailed Specification of Deferred Components (`design.md` Mandate)

This section resolves every UI item explicitly deferred to `design.md` in Sections 8, 9, and 13 of the *Conv-way Product Vision Document*.

### 5.1 The "Way" Panel (Predicted Questions & Window Transitions)
* **Panel Header:** Set in `Geist Pixel Triangle 400` (`24px` desktop / `20px` mobile):
  * Left: `WAY` (`#efe6d8`)
  * Right: Active window time range, e.g., `24:00 — 28:00` (`#736e68`).
* **2-Second Watch Gate & Skeleton State:**
  * Before the viewer has watched for $\ge 2.0\text{ seconds}$ and while Window 0 is preparing, the panel displays 5 flat horizontal hairline bars (`height: 1px`, `background: #605c56`, spaced `40px` apart) with a `Geist Mono` `12px` `#736e68` label: `INDEXING TRANSCRIPT WINDOW 00...`. No pulsing gradients or spinners.
* **Progressive Timestamp Reveal (`currentTime >= trigger_sec`):**
  * Each window holds 5 to 8 predicted questions. A question remains hidden until the player's playhead reaches `question.trigger_sec`.
  * When revealed, a question appears as a flat typographic block separated by a `1px solid #605c56` bottom border (`padding: 16px 0`):
    * **Top Meta Line (`Geist Mono 400`, `12px`, `#736e68`):** `[00:24:22] · IN-VIDEO ANSWER [01:10]`
    * **Question Title (`Geist 500`, `14px`, `#efe6d8`):** e.g., *"Why can't Starlink serve dense cities directly?"*
  * **Hover / Active State:** Hovering underlines the question in `1px solid #aca69c`. When tapped and currently playing its answer, the row background receives a subtle Acid Lime wash (`rgba(77, 255, 0, 0.08)`) and an `8px` `#4dff00` dot next to the timestamp.
* **How Old Questions Leave When a New Window Arrives:**
  * When playback crosses into Window $N+1$, questions from Windows $0 \dots N$ are **not** deleted or abruptly popped while the user is reading. Instead, they collapse cleanly into a single top accordion row set in `Geist Mono 400` (`12px`, `#736e68`, `border-bottom: 1px solid #605c56`):
    `+ EARLIER QUESTIONS IN THIS VIDEO (12)`
  * The active viewport of the **Way** panel always shows only the revealed questions of the **current window** (1 to 8 items max), keeping visual density calm.
* **Uncaptioned Video / Budget Exhausted State:**
  * If `captionStatus === 'NO_CAPTIONS'` or `'BUDGET_DEFERRED'`, **Way** displays a single honest line in `Geist Mono 400` (`13px`, `#aca69c`):
    `CAPTIONS UNAVAILABLE FOR THIS VIDEO — IN-VIDEO WAY QUESTIONS DISABLED. CROSS-VIDEO SEARCH & AI FALLBACK REMAIN ACTIVE.`

---

### 5.2 Picture-in-Picture (PiP) Player for External Video Answers

When the best answer comes from a **different YouTube video**, Conv-way plays that segment in a dedicated Picture-in-Picture (PiP) player while the primary video is paused.

#### YouTube TOS Compliance & Sizing Rules
* Per YouTube Embedded Player API policy, an embedded player must have a minimum viewport of at least $200\times 200\text{ pixels}$ and must not have its standard YouTube controls or branding obscured.
* **Desktop PiP Dimensions:** `384px × 216px` (`16:9` aspect ratio, exceeding the $200\times 200\text{ px}$ floor), docked at the bottom-right corner of the Primary Player stage (`16px` inset) and draggable along the 4 corners of the player container.
* **Mobile PiP Dimensions:** Docked directly over the lower half of the paused main player container at `100%` width $\times$ `220px` height (`0px` border-radius) so both the $200\times 200\text{ px}$ rule and one-handed thumb reachability are satisfied.

#### How the Paused Main Video is Shown During PiP Playback
1. The Primary YouTube Player executes `pauseVideo()` at $T_{\text{origin}}$.
2. A flat `#000000` (`88%` opacity) curtain overlays the paused primary player (never covering the PiP player).
3. In the top-left of the paused primary player curtain, Conv-way renders in `Geist Pixel Triangle 400` (`30px`, `#efe6d8`):
   `MAIN VIDEO PAUSED // 00:24:15`
   and below it in `Geist Mono 400` (`13px`, `#aca69c`):
   `PLAYING EXTERNAL ANSWER CLIP IN PICTURE-IN-PICTURE`

#### PiP Frame Chrome
* Surface: `#000000` Obsidian background with a crisp `1px solid #ffa1f7` (Neon Petal) top hairline border and `1px solid #605c56` (Charcoal) side/bottom borders (`border-radius: 0px`, zero shadow).
* **PiP Header Strip (`height: 32px`, `padding: 0 12px`, `background: #000000`):**
  * Left (`Geist Mono 500`, `12px`, `#ffa1f7`): `EXTERNAL CLIP · [04:12 — 05:01]`
  * Right (`Geist Mono 400`, `12px`, `#aca69c`): `[DRAG]` and `[× CLOSE & RETURN]`
* **PiP Footer Attribution (`padding: 8px 12px`, `background: #000000`, `border-top: 1px solid #605c56`):**
  * Line 1 (`Geist 600`, `13px`, `#efe6d8`, truncated 1 line): External Video Title
  * Line 2 (`Geist Mono 400`, `12px`, `#aca69c`): `CHANNEL: [CHANNEL TITLE] · SPEAKER: [SPEAKER NAME]`

---

### 5.3 LIFO Call Stack & "Return Point Saved" Indicator

Whenever a detour is active ($\text{stack.length} \ge 1$), the **Return-Point Strip** directly above the player activates:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● RETURN POINT SAVED AT [00:24:15]   │   STACK: 00:24:15 → 00:27:41 (DEPTH 1)│
└──────────────────────────────────────────────────────────────────────────────┘
```

* **Left Signal:** `8px` `#ffa1f7` (Neon Petal) dot + `Geist Mono 500` (`13px`, `#efe6d8`): `RETURN POINT SAVED AT [00:24:15]`.
* **Right Breadcrumb Trail:** Interactive stack nodes in `Geist Mono 400` (`13px`, `#aca69c`):
  $$\text{ORIGIN } [00:24:15] \longrightarrow \text{BRANCH } 1\ [00:27:41] \longrightarrow \text{BRANCH } 2\ [01:04:12]$$
  Clicking any ancestor timestamp node immediately pops the stack back to that exact frame.

---

### 5.4 End-of-Clip Hand-Back Bar & Verified AI Fallback Card

#### End-of-Clip Hand-Back Bar
When an answer segment reaches `end_sec`, playback pauses automatically (no jarring auto-return) and the **Hand-Back Bar** appears directly below the player (`border-top: 1px solid #ffa1f7`, `border-bottom: 1px solid #605c56`, `padding: 20px 0`, `background: #000000`):

* **Prompt Text (`Geist 500`, `14px`, `#efe6d8`):**
  *"Does that clarify Starlink's urban beam capacity, or do you want to explore cellular spectrum?"*
* **Action Controls (`16px` horizontal gap):**
  1. **Primary Pill CTA (Filled `#ffa1f7` Neon Petal, `#000000` text, `40px` radius, `12px × 24px` padding):**
     `CONTINUE VIDEO [00:24:15]` (Pops stack and restores exact playback position & volume).
  2. **Secondary Pill (Flat `#000000` fill, `1px solid #aca69c` Bone border, `#efe6d8` text, `40px` radius):**
     `DIVE DEEPER` (Searches current video + all of YouTube for deeper technical context and pushes a new branch to the LIFO stack).
  3. **Tertiary Ghost Text Link (`#efe6d8` text, `1px solid #736e68` bottom border on hover):**
     `Ask another question` (Focuses voice/text input).
  4. **Nested Stack Root Action (Shown only when $\text{stack.length} > 1$):**
     `Return to original start [00:24:15]` (`Geist Mono 12px`, `#aca69c` Ghost Link).

#### Verified AI Fallback Card (30–40 Words)
Displayed below the player *only* when no video segment answers the question or when a speaker's claim is contradicted by retrieved web sources:
* **Container:** `#000000` background, `1px solid #605c56` border, `padding: 24px`, `border-radius: 0px`.
* **Header Badge (`Geist Mono 500`, `12px`, `#ffa1f7`):**
  `[AI SYNTHESIS · VERIFIED WEB SOURCE · NOT A VIDEO CLIP]`
* **Reason Line (`Geist Mono 400`, `12px`, `#aca69c`, `margin-top: 8px`):**
  `REASON: No video segment directly states residential hardware pricing in India.`
* **30–40 Word Body (`Geist 500`, `15px`, `#efe6d8`, `line-height: 1.4`, `margin: 12px 0`):**
  *"Starlink's standard residential kit is priced around $349 USD globally, though Indian commercial pricing awaits final regulatory spectrum allocation and gateway licensing."*
* **Mandatory Source Citation Link (`Geist Mono 400`, `12px`, `#efe6d8`, `border-bottom: 1px solid #736e68`):**
  `SOURCE: starlink.com/specifications ↗`
* **Opt-In Timbre Audio Readout Link:** Ghost link `[Read aloud via Timbre]` (hidden if Governor is at $100\%$ cap).

---

### 5.5 Microphone & Multi-Modal Input States

In Idle/Watching state (when the Hand-Back Bar is not active), the **Input Bar** sits below the player:

| Control | Visual Treatment | State Behavior |
| :--- | :--- | :--- |
| **Push to Talk (Primary CTA)** | Filled `#ffa1f7` Pill Button (`40px` radius, `#000000` text, `Geist 500 13px`). | **Rest:** `HOLD TO SPEAK`<br>**Active Hold:** `LISTENING... [00:04 / 00:30]` paired with a real Web Audio API RMS level bar in `#000000`. |
| **Conv-way Ambient Mode Toggle** | Flat pill (`1px solid #605c56`, `40px` radius, `Geist Mono 12px`). | **Off:** `○ AMBIENT MODE: OFF`<br>**On:** `● AMBIENT MODE: ON (AEC)` with `8px` `#4dff00` Acid Lime dot. |
| **Speech Behavior Toggle** | Ghost Text Toggle (`Geist Mono 12px`, `#aca69c`). | Toggles between `AUDIO: DUCK TO 18%` (default with headphones) and `AUDIO: PAUSE ON SPEECH` (default on mobile/speakers). |
| **Text Question Input** | Flat input (`background: #000000`, `border-bottom: 1px solid #605c56`, `Geist 500 14px`, `#efe6d8`). | Submits on `Enter` or clicking the inline `ASK ↵` Ghost Link. |

---

## 6. Low-End Device & Data-Saver Adaptation Rules

In accordance with Section 9 of the Product Vision Document, the UI inspects `navigator.connection?.saveData`, `navigator.connection?.effectiveType`, `navigator.deviceMemory`, and `navigator.hardwareConcurrency`:
1. **Low-End / Data-Saver Mode Triggered (`deviceMemory < 4` or `saveData === true`):**
   * Disables continuous Web Audio API frequency-bin canvas rendering; uses a simple binary `8px` `#4dff00` dot for microphone activity.
   * Defaults strictly to **Push-to-Talk** and **Text Input** (ambient Conv-way VAD toggle displays a notice: `RECOMMENDED ON DESKTOP WITH HEADPHONES`).
   * **Way** panel requests `?mode=titles` (`< 4 KB` payload) and resolves segment timestamps only when a viewer taps a question.
   * All CSS transitions are set to `0ms` (`transition: none !important`).

---

## 7. Do's and Don'ts Checklist for Implementation Agents

### Do
* **DO** use `#000000` (Obsidian Canvas) as the background for every page, modal, PiP bar, and panel.
* **DO** enforce the **Single `#ffa1f7` Filled Pill Rule**: when the Hand-Back Bar appears, `"CONTINUE VIDEO [MM:SS]"` takes the `#ffa1f7` fill and the `"HOLD TO SPEAK"` button steps down to a secondary Bone hairline border (`1px solid #aca69c`).
* **DO** use `Geist Pixel Triangle` (`30px`, `-0.033em`) for all section headers (`TRENDING PODCASTS`, `WAY // WINDOW`, `MAIN VIDEO PAUSED`).
* **DO** keep all video players and thumbnails at `border-radius: 0px` with no drop shadows.
* **DO** keep the LIFO Return-Point Strip visible at all times during any detour on both desktop and mobile.

### Don't
* **DON'T** introduce `box-shadow`, radial gradients, linear gradients, or blurred glass cards anywhere in the CSS.
* **DON'T** use `#ffa1f7` for large background areas or body paragraphs—it is strictly for the single primary pill CTA and small verification/branch markers.
* **DON'T** use pure `#ffffff` or cool slate grays (`#64748b`, `#94a3b8`); strictly use `#efe6d8` (Parchment), `#aca69c` (Bone), `#736e68` (Ash), and `#605c56` (Charcoal).
* **DON'T** use decorative icons in the header, footer, or **Way** list items—use `Geist Mono` timestamps and plain text labels.