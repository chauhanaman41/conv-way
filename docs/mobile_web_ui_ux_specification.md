# Mobile Web UI/UX Specification: Conv-way (`MOBILE_DESIGN.md`)

**Version:** 1.0.0  
**Date:** November 8, 2026  
**Target Platforms:** iOS Safari (iPhone SE `320px` through iPhone 16 Pro Max `430px+`), Android Chrome, and Tablet (`768px`)  
**Aesthetic System:** *Midnight Gallery Wall with Hot Pink Markers* (`#000000` Obsidian Canvas, `#efe6d8` Parchment, `#ffa1f7` Neon Petal, `#4dff00` Acid Lime Dot)  
**Ergonomic Reference:** Three-State Mobile Media Player Architecture (Discovery Feed + Mini-Player $\rightarrow$ Centered Watch & Voice Stage $\rightarrow$ Expanded Bottom Sheet Drawer)

---

## 1. Mobile-First Core Philosophy

Mobile web is **not** a squished desktop layout—it is Conv-way's primary, independently engineered experience designed for one-handed thumb operation while watching or listening to long-form YouTube media on the go.

### How the Reference Screenshot Maps to Conv-way's Obsidian System
Inspired by the three-screen mobile player reference (`Home Feed` $\rightarrow$ `Centered Player Stage` $\rightarrow$ `Expanded Queue/Lyrics Drawer`), Conv-way organizes the mobile viewport into **three fluid, zero-reload spatial states** rendered on a pure `#000000` Obsidian canvas with `1px solid #605c56` (Charcoal) hairlines and zero drop shadows:

1. **Screen State 1 — Discovery Feed + Persistent Mini-Player + Bottom Nav (Left Reference):**
   * Top app bar (`CONV-WAY` + live status dot + search trigger), horizontal category filter pills (`All`, `Tech`, `Founders`, `Science`, `Indian Languages`), horizontal/vertical podcast cards, a docked **Persistent Mini-Player** (when a video session is active), and a 3-item **Bottom Navigation Bar**.
2. **Screen State 2 — Centered Watch & Voice Stage + Anchored Drawer Tabs (Center Reference):**
   * Top collapse bar with a segmented mode pill (`WATCH` | `AMBIENT VAD`), edge-to-edge `16:9` YouTube player (`0px` radius), centered episode title & speaker metadata, timeline bar with $T_{\text{origin}}$ return-point markers, a thumb-zone **Primary Voice/Hand-Back Cluster** (featuring the single `#ffa1f7` Neon Petal CTA), and an anchored 3-tab bottom sheet handle (`WAY` | `STACK` | `TRANSCRIPT`).
3. **Screen State 3 — Expanded `WAY` / `STACK` / `TRANSCRIPT` Drawer (Right Reference):**
   * Swiping up or tapping any bottom tab (`WAY`, `STACK`, or `TRANSCRIPT`) expands the drawer to fill the lower viewport while keeping the video player docked at the top (maintaining YouTube's $\ge 200\times200\text{ px}$ minimum during active playback or collapsing to a $56\text{px}$ transport header when paused), presenting $48\text{px}+$ touch rows for one-tap question jumping.

---

## 2. Viewport, Safe-Area & Fluid Layout Rules (`320px` Upwards)

### 2.1 Dynamic Viewport & Safe Areas
Mobile browsers (iOS Safari address bar, Android Chrome gesture bar) dynamically resize the viewport. Fixed `100vh` is **prohibited** on mobile containers.

```css
/* Mandatory Mobile Root Container Rules */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden; /* Zero unintended horizontal overflow */
  background-color: #000000;
  color: #efe6d8;
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
}

.mobile-app-shell {
  width: 100%;
  min-height: 100svh;
  height: 100dvh; /* Adapts to iOS Safari dynamic toolbar */
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  background: #000000;
}
```

### 2.2 Mandatory Breakpoint Matrix

| Breakpoint | Target Devices | Layout Adaptation |
| :--- | :--- | :--- |
| **`320px – 359px`** | iPhone SE (1st/2nd gen), compact Androids | Compact `12px` horizontal gutters; single-line truncated metadata; `56px` primary PTT pill; horizontal scroll on filter pills; `Way` drawer tabs use `12px` `Geist Mono`. |
| **`360px – 389px`** | Standard Android (`360px`), iPhone Mini (`375px`) | `16px` horizontal gutters; 2-card horizontal peek carousel (`82vw` card width) for Top Podcasts; full transport & stack strip. |
| **`390px – 430px+`** | iPhone 14/15/16 (`390px–430px`), Pixel Pro | `20px` horizontal gutters; generous vertical breathing room between player, metadata, and voice cluster. |
| **`768px – 1023px`** | iPad Mini / Air (Portrait) | 2-column Discovery grid; Watch view uses a wider `16:9` stage with a `50%` height docked `Way` / `Stack` split below. |
| **`>= 1024px`** | Desktop / Laptop | Transitions cleanly to the side-by-side `68% / 32%` split defined in `DESIGN.md` without duplicating React state or DOM logic. |

---

## 3. Detailed Specification of the 3 Mobile Screen States

### 3.1 Screen State 1: Discovery Home + Filter Pills + Mini-Player + Bottom Nav
*(Corresponds to the Left Phone in the Reference Screenshot)*

```
┌──────────────────────────────────────────┐
│ CONV-WAY              ● READY   [SEARCH] │ ← 52px Top Identity Bar
├──────────────────────────────────────────┤
│ ( ALL )  ( TECH )  ( FOUNDERS )  ( IND ) │ ← 48px Horizontal Filter Pills
├──────────────────────────────────────────┤
│                                          │
│ TOP 20 PODCASTS             08 NOV 2026  │ ← Geist Pixel Triangle 20px
│ ──────────────────────────────────────── │
│ ┌────────────────────────────┐ ┌──────── │
│ │                            │ │         │
│ │   16:9 EDGE-TO-EDGE CARD   │ │  PEEK   │ ← 84vw Horizontal Snap Carousel
│ │   (0px radius, no shadow)  │ │  CARD   │   (Real Top 20 D1/KV Data)
│ │                            │ │         │
│ └────────────────────────────┘ └──────── │
│ [01] NIKHIL KAMATH · 02:02:25 · READY    │
│ WTF is with Elon Musk? | Ep 16           │
│                                          │
│ INDEXED & READY FOR WAY         D1 CACHE │ ← Geist Pixel Triangle 20px
│ ──────────────────────────────────────── │
│ ┌─────────────────┐  ┌─────────────────┐ │
│ │ 16:9 THUMBNAIL  │  │ 16:9 THUMBNAIL  │ │ ← 2-Column Touch Grid (min 140px)
│ └─────────────────┘  └─────────────────┘ │
│ LEX FRIDMAN          ZERODHA             │
│                                          │
├──────────────────────────────────────────┤
│ [THUMB] WTF is with Elon...  [||]  [ASK] │ ← 56px Docked Mini-Player
├──────────────────────────────────────────┤
│    HOME         SEARCH       NOW PLAYING │ ← 56px + Safe-Area Bottom Nav
└──────────────────────────────────────────┘
```

#### Component Rules for Screen State 1:
1. **Top Bar (`height: 52px`):**
   * Left: `CONV-WAY` (`Geist 600`, `15px`, `#efe6d8`).
   * Right: `8px` Acid Lime (`#4dff00`) status dot + `48×48px` `[SEARCH]` trigger that expands the inline search/URL bar.
2. **Real Category Filter Pills (`height: 48px` row, horizontal `overflow-x: auto`, `scrollbar-width: none`):**
   * Pills: `ALL`, `TECH & AI`, `FOUNDERS`, `SCIENCE`, `HINDI / TELUGU / REGIONAL`.
   * **No Fake Filtering:** Tapping a pill filters the actual Top 20 / D1 indexed video list by category/language tag in real time.
   * **Visual Style:** Inactive pills have `border: 1px solid #605c56`, `#aca69c` text, `border-radius: 1000px`, `height: 36px` (inside a `48px` touch wrapper). The active filter pill uses `border: 1px solid #efe6d8` and `#efe6d8` text (reserving `#ffa1f7` for the primary action).
3. **Horizontal Snap Carousel (`TOP 20 PODCASTS`):**
   * Uses `display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 16px;`.
   * Each card is `84vw` wide (allowing a `10vw` peek of the next card on the right so users immediately recognize horizontal scrollability) with `scroll-snap-align: start`.
   * Thumbnails are sharp `0px` radius rectangles on `#000000`.
4. **Docked Persistent Mini-Player (`height: 56px`, `border-top: 1px solid #605c56`, `background: #000000`):**
   * Appears automatically above the Bottom Navigation Bar if the user navigates back to `HOME` or `SEARCH` while a video is loaded.
   * Left: `64×36px` (`0px` radius) video thumbnail + 1-line truncated title (`Geist 600 13px #efe6d8`) + current state (`PLAYING 00:24:15` or `RETURN SAVED 00:24:15` in `Geist Mono 11px #aca69c`).
   * Right: Two `48×48px` touch buttons: `[PAUSE/PLAY]` and a filled `#ffa1f7` mini-pill `[ASK]`. Tapping anywhere on the Mini-Player expands **Screen State 2**.
5. **Bottom Navigation Bar (`height: calc(56px + env(safe-area-inset-bottom))`):**
   * Three equal-width (`33.33%`) touch targets (`min-height: 48px`), text-only in `Geist Mono 500 12px` (zero decorative icons, matching the Akash Tyagi rule):
     * `01 // HOME`
     * `02 // SEARCH & URL`
     * `03 // PLAYER` (shows an `8px` `#4dff00` dot when a video is active).

---

### 3.2 Screen State 2: Centered Watch & Voice Orchestration Stage
*(Corresponds to the Center Phone in the Reference Screenshot)*

```
┌──────────────────────────────────────────┐
│ [↓ HIDE]    ( WATCH | AMBIENT )   [LANG] │ ← 52px Top Player Header
├──────────────────────────────────────────┤
│ ● RETURN SAVED [00:24:15] → CLIP [27:41] │ ← 36px LIFO Stack Strip
├──────────────────────────────────────────┤
│                                          │
│                                          │
│       16:9 YOUTUBE IFRAME PLAYER         │ ← 100vw Full-Bleed (0px radius)
│       (Edge-to-Edge on #000000)          │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│ [DUCK 18%]  WTF is with Elon Musk? [⌨️] │ ← Centered Title + Side Actions
│            Nikhil Kamath · Ep 16         │   (48×48px touch targets)
│                                          │
│ ──────◈───────────●───────────────────── │ ← Timeline: ◈ Origin | ● Playhead
│ 00:24:15 (SAVED)                02:02:25 │
│                                          │
│   [ ↺ ORIGIN ]   ┌──────────┐   [ DEEP ] │ ← Thumb-Zone Orchestration Row
│                  │ HOLD TO  │            │   (#ffa1f7 Primary Center Pill)
│                  │  SPEAK   │            │
│                  └──────────┘            │
│                                          │
├──────────────────────────────────────────┤
│                  ──────                  │ ← 4px×36px Sheet Grabber Bar
│     WAY (6)       STACK (1)    TRANSCRIPT│ ← 48px 3-Tab Bottom Sheet Bar
└──────────────────────────────────────────┘
```

#### Component Rules for Screen State 2:
1. **Top Player Header (`height: 52px`):**
   * **Left (`48×48px` target):** `[↓]` collapses the player into the Docked Mini-Player (returning to Screen State 1).
   * **Center Segmented Pill (`height: 36px` inside `48px` touch zone, `border: 1px solid #605c56`, `border-radius: 1000px`):**
     * Toggles between `WATCH` (Push-to-Talk baseline) and `AMBIENT` (hands-free Conv-way VAD mode with `8px` `#4dff00` dot).
   * **Right (`48×48px` target):** Language selector pill (`[EN]`, `[HI]`, `[TE]`, etc.) in `Geist Mono 12px`.
2. **LIFO Return-Point Strip (`height: 36px`, `border-bottom: 1px solid #605c56`):**
   * Pinned directly above the `16:9` player so it is never hidden by the thumb or bottom sheet.
   * Displays `● RETURN SAVED [00:24:15]` on the left and `[TAP TO RESTORE]` on the right (`min-height: 44px` hit area).
3. **Edge-to-Edge Video Stage (`width: 100vw`, `aspect-ratio: 16 / 9`, `border-radius: 0px`):**
   * Sits flush against the left and right screen edges on `#000000`.
4. **Centered Metadata & Flanking Utility Controls (Directly inspired by the Center Phone's title + thumbs-up/down row):**
   * **Left Touch Button (`48×48px`):** Audio behavior toggle (`[DUCK 18%]` vs. `[PAUSE]`).
   * **Center Stack:**
     * Video Title in `Geist 600` (`16px`, `#efe6d8`, centered, max 2 lines).
     * Channel & Active Speaker in `Geist Mono 400` (`13px`, `#aca69c`, centered).
   * **Right Touch Button (`48×48px`):** `[TYPE]` trigger—opens the keyboard-safe inline text query bar.
5. **Contextual Timeline & Return Marker Bar:**
   * Displays the video progress hairline (`1px solid #605c56`) with:
     * A Neon Petal (`#ffa1f7`) diamond marker (`◈`) locked at $T_{\text{origin}}$ (`00:24:15`) whenever a detour is active.
     * The current playhead position (`#efe6d8` circle) and `[start_sec, end_sec]` highlight band.
6. **Thumb-Zone Primary Action Cluster (Center-Bottom):**
   * **Center Primary Pill (`min-width: 156px`, `height: 56px`, `border-radius: 40px`, `#ffa1f7` Neon Petal fill, `#000000` text, `Geist 600 13px`):**
     * **In Normal Watch State:** `HOLD TO SPEAK` (supports both press-and-hold and single-tap toggle to start/stop recording).
     * **In End-of-Clip Hand-Back State:** Morphs into `CONTINUE [00:24:15]` so the single most important action is always under the user's thumb in `#ffa1f7`.
   * **Left Flanking Pill (`height: 48px`, `padding: 0 16px`, `border: 1px solid #605c56`, `border-radius: 40px`):**
     * `↺ ORIGIN` (Restores root $T_{\text{origin}}$ when $\text{stack.length} \ge 1$; disabled in `#605c56` when stack is empty).
   * **Right Flanking Pill (`height: 48px`, `padding: 0 16px`, `border: 1px solid #aca69c`, `border-radius: 40px`):**
     * `DIVE DEEPER` (or `ASK TEXT` when idle).
7. **Anchored Bottom Sheet Handle & 3-Tab Bar (`height: 56px`, `border-top: 1px solid #605c56`):**
   * Mirrors the `UP NEXT` | `LYRICS` | `RELATED` bar at the bottom of the Center Reference Phone:
     * **Tab 1:** `WAY (6)` — Shows count of revealed predicted questions in the current 4-minute window.
     * **Tab 2:** `STACK (1)` — Shows current LIFO detour depth.
     * **Tab 3:** `TRANSCRIPT` — Shows live windowed transcript cues and any Verified AI Fallback card.

---

### 3.3 Screen State 3: Expanded `WAY` / `STACK` / `TRANSCRIPT` Bottom Sheet Drawer
*(Corresponds to the Right Phone in the Reference Screenshot)*

When the user taps `WAY`, `STACK`, or `TRANSCRIPT` (or swipes up on the bottom sheet handle), the sheet smoothly transitions upward while keeping the active video docked at the top of the screen:

```
┌──────────────────────────────────────────┐
│ ┌──────────────┐ WTF is with Elon Musk?  │ ← Docked Top Video Strip
│ │  16:9 VIDEO  │ [00:24:22]    [||] [↺]  │   (Maintains >=200x200px when
│ │  OR PAUSED   │                         │    playing external PiP clip)
│ └──────────────┘                         │
├──────────────────────────────────────────┤
│     WAY (6)       STACK (1)    TRANSCRIPT│ ← Active Tab Underlined (#ffa1f7)
├──────────────────────────────────────────┤
│ WINDOW 06 // 24:00 — 28:00     680 WORDS │ ← Geist Pixel Triangle 18px
├──────────────────────────────────────────┤
│ [00:23:40] · IN-VIDEO CLIP [00:48]       │
│ Why are Starlink satellites at 550 km    │ ← 64px Touch Row (Min 48px)
│ instead of geostationary orbit?      [▶] │
├──────────────────────────────────────────┤
│ ● [00:24:22] · PLAYING NOW [01:10]       │ ← Active Row (#4dff00 dot +
│ Why can't Starlink serve dense cities    │   8% Acid Lime wash)
│ directly with thousands of sats?     [||]│
├──────────────────────────────────────────┤
│ [00:25:10] · IN-VIDEO CLIP [00:55]       │
│ How do laser cross-links reduce ocean    │
│ fiber latency?                       [▶] │
├──────────────────────────────────────────┤
│ + EARLIER WINDOWS (00:00 — 24:00)   [14] │ ← Collapsed Earlier Windows
├──────────────────────────────────────────┤
│ [ Type a question...         ] [HOLD 🎙️] │ ← Sticky Bottom Input Dock
└──────────────────────────────────────────┘
```

#### Component Rules for Screen State 3:
1. **Top-Docked Video Header:**
   * If a video clip (Primary or External PiP) is actively playing while the drawer is open, the top area maintains a `100vw × 210px` (`16:9`) viewport so the viewer can watch the speaker's face while reading **Way** questions or the AI Fallback card (strictly satisfying YouTube's $\ge 200\times200\text{ px}$ rule).
   * If the video is paused while the user browses long lists of questions, it can compact to a `64px` header strip with `[PLAY]` and `[RETURN TO 00:24:15]` `48×48px` controls.
2. **Tab Bar (`height: 48px`, `border-bottom: 1px solid #605c56`):**
   * Three equal-width (`33.33%`) tabs in `Geist Mono 500 12px`: `WAY`, `STACK`, `TRANSCRIPT`.
   * Active tab text is `#efe6d8` with a `2px solid #ffa1f7` bottom indicator bar; inactive tabs are `#736e68`.
3. **Question List Rows (`min-height: 64px`, `padding: 14px 16px`, `border-bottom: 1px solid #605c56`):**
   * Left content (`85%` width):
     * Line 1 (`Geist Mono 400 12px #736e68`): `[MM:SS] · CLIP DURATION [MM:SS]`
     * Line 2 (`Geist 500 14px #efe6d8`, `line-height: 1.3`): Full question text.
   * Right action indicator (`48×48px` hit zone): `[▶]` in `Geist Mono 13px #aca69c` (or `#4dff00` `8px` dot when active).
   * Tapping any row immediately saves the current playhead to the LIFO stack (`push()`), seeks to `answer_start_sec`, and plays the segment.

---

## 4. Mobile-Specific Redesign of Complex Desktop Features

In accordance with the **Mobile-First Responsive Development Rules**, complex desktop interactions are redesigned specifically for mobile rather than hidden or shrunk:

### 4.1 External Video Picture-in-Picture (PiP) on Mobile
Desktop uses a floating corner PiP window (`384×216px`). On mobile (`320px–430px`), a floating overlay would cover the controls or violate YouTube's $200\times200\text{ px}$ minimum size rule.
* **Mobile Redesign (Split-Stage Swap):**
  1. When an answer comes from an external YouTube video, the Primary Player pauses at $T_{\text{origin}}$ and collapses into a **`44px` Paused Origin Banner** directly above the video frame:
     `MAIN VIDEO PAUSED AT [00:24:15] · [× CLOSE EXTERNAL CLIP]` (`1px solid #ffa1f7` border).
  2. The **External PiP YouTube Player** mounts directly in the primary `100vw × 16:9` stage (`320×180px` minimum at `320px` width, or `100vw × 200px` minimum container height) with a `Geist Mono 12px` attribution bar below it:
     `EXTERNAL ANSWER · CHANNEL: [CHANNEL NAME] · [04:12 — 05:01]`.
  3. When the external clip finishes or the user taps `CONTINUE [00:24:15]`, the external player unmounts and the Primary Player immediately resumes at $T_{\text{origin}}$.

### 4.2 Virtual Keyboard & Text Input Handling (`visualViewport` Rule)
On iOS Safari and Android Chrome, opening the virtual keyboard shrinks the visible viewport by ~45% and can obscure bottom-docked inputs.
* **Mandatory Implementation:**
  * When the user taps `[TYPE]` or focuses the question input, the input bar attaches to `window.visualViewport` (`bottom: calc(100dvh - var(--visual-viewport-height))`) or opens a top-aligned **Keyboard-Safe Query Sheet** positioned directly beneath the `16:9` video player.
  * The `ASK ↵` submit button (`48×48px` touch target) and `CANCEL` button remain 100% visible above the virtual keyboard at all times on `320px+` screens.
  * Input font size is strictly `16px` (`Geist 500 16px #efe6d8` on `<input type="text">`) on iOS Safari to **prevent iOS automatic page zoom-in on focus**.

### 4.3 Touch-First Interactions (Zero Hover Dependency)
* No information or action in Conv-way relies on `:hover`.
* Every interactive element implements an explicit `:active` touch feedback state:
  * **Primary `#ffa1f7` Pill CTA (`:active`):** Invert border to `2px solid #efe6d8` with `transform: scale(0.98)`.
  * **Way Question Row / Podcast Card (`:active`):** Background shifts to `rgba(239, 230, 216, 0.08)` (`#efe6d8` at 8% opacity) immediately on `touchstart`.

---

## 5. Touch Target & State Matrix

Every interactive element on mobile must meet or exceed **$48\times48\text{ CSS pixels}$** (hard minimum $44\times44\text{ px}$):

| Control | Minimum Touch Target | Loading State | Disabled / Quota State | Error State |
| :--- | :--- | :--- | :--- | :--- |
| **Primary PTT / Continue Pill** | `156px × 56px` | `ROUTING...` (`Geist Mono 13px`) | Falls back to `Web Speech API` if Gnani cap is 100% | Displays `RETRY VOICE` or switches to text input |
| **Flanking Stack / Deep Pills** | `88px × 48px` | `SEARCHING...` | `#605c56` border & text when stack depth is `0` | Inline 1-line banner above player |
| **Bottom Sheet Tabs (`WAY`, `STACK`, `TRANSCRIPT`)** | `33.3vw × 48px` | `WAY (...)` with flat hairline skeleton | `WAY (N/A)` when video has no captions | Honest 1-line reason inside drawer |
| **Way Question Row** | `100% × 64px` | 5 flat `1px #605c56` skeleton lines | N/A (only verified ranges are rendered) | Inline retry tap if player seek fails |
| **Mini-Player Play/Pause & Ask** | `48px × 48px` each | Buffering indicator in status dot | Disabled if no video loaded | Honest error message |
| **Category Filter Pills** | `min 64px × 48px` hit wrapper | Skeleton pills while Top 20 loads | Empty state message if 0 matches in category | `[RETRY FETCH]` Ghost button |

---

## 6. Mobile Performance, Network & Battery Guardrails

1. **Image Optimization:** Top 20 Podcast thumbnails use `loading="lazy"`, `decoding="async"`, and YouTube's mobile-optimized `mqdefault.jpg` (`320×180`) on viewports `< 430px` and `hqdefault.jpg` on larger viewports.
2. **Zero Continuous Network Polling:** Playhead tracking (`currentTime` vs. `trigger_sec` and `end_sec`) runs 100% locally in browser memory against the YouTube IFrame API. Network requests occur *only* after the 2-second watch confirmation gate, at the 75% window prefetch boundary, or when the viewer asks a question.
3. **Hardware Audio & Battery Safety:**
   * On mobile speakers (when no headphones are detected), speech capture defaults to **Auto-Pause Video** (`AUDIO: PAUSE ON SPEECH`) so speaker output never pollutes the mobile microphone.
   * When `document.visibilityState === 'hidden'` (user locks phone or switches apps), any active microphone stream and background window prefetch stop immediately.

---

## 7. Mobile Breakpoint Verification Checklist (Acceptance Criteria)

Before any mobile UI task in `TASKS.md` is marked `[x] FULLY_IMPLEMENTED_AND_VERIFIED`, the coding agent must verify all three screen states at these exact viewport dimensions:

* [ ] **`320px × 568px` (iPhone SE):** Zero horizontal overflow (`document.documentElement.scrollWidth <= 320`); primary PTT/Continue pill and flanking buttons fit without wrapping or clipping; input font is `16px`.
* [ ] **`375px × 667px` (iPhone 8 / Mini):** `16:9` player, metadata, transport timeline, thumb-zone action row, and `56px` bottom sheet bar fit cleanly within `100dvh` without requiring vertical scroll in Screen State 2.
* [ ] **`390px × 844px` (iPhone 14 / 15 / 16):** Bottom sheet drawer smoothly expands/collapses between Screen State 2 and Screen State 3; LIFO Return-Point Strip remains visible at all times.
* [ ] **`430px × 932px` (iPhone Pro Max / Large Android):** 2-column indexed podcast grid and `84vw` snap carousel align cleanly with `20px` gutters.
* [ ] **`768px × 1024px` (Tablet Portrait):** Seamless responsive transition between stacked mobile ergonomics and tablet split-view.