# API Documentation: Conv-way

**Base URL:** `/api`  
**Content-Type:** `application/json` (except `POST /api/voice/transcribe` which accepts `multipart/form-data` or `audio/webm`).  
**Authentication:** Public viewer endpoints require **zero user sign-in**, in accordance with the Product Vision. All external API keys are held strictly in Cloudflare Worker Secrets. Abuse prevention is enforced via IP-hashed rate limiting and the server-side Credit Governor. Administrative calibration requires the `X-Admin-Calibration-Key` header matching the `ADMIN_CALIBRATION_SECRET` environment variable.

---

## 1. Standard Error Response Format
Every failed request returns an explicit, non-fabricated error structure:

```json
{
  "ok": false,
  "error": {
    "code": "TRANSCRIPT_UNAVAILABLE",
    "message": "Usable captions are not available for this video. Cross-video search and verified AI answers remain active.",
    "retryable": false,
    "governorState": {
      "stepDownLevel": "NORMAL",
      "dailyCapRemainingPct": 84.2
    }
  }
}
```

---

## 2. Endpoints

### 2.1 Discovery & Trending Podcasts

#### `GET /api/discovery/trending`
Returns the shared global Top 20 Trending Podcasts list. Cached at the Cloudflare CDN edge for 24 hours.

* **Response (`200 OK`):**
```json
{
  "ok": true,
  "updatedAt": "2026-11-08T02:00:00.000Z",
  "videos": [
    {
      "videoId": "zIwLWfaAg-8",
      "title": "WTF is with Elon Musk? | Nikhil Kamath | People by WTF Ep 16",
      "channelTitle": "Nikhil Kamath",
      "thumbnailUrl": "https://i.ytimg.com/vi/zIwLWfaAg-8/hqdefault.jpg",
      "durationSec": 7345,
      "captionStatus": "READY"
    }
  ]
}
```

#### `GET /api/discovery/search?q={query}&lang={lang}`
Searches indexed videos in D1 first and queries YouTube Data API v3 (cached by normalized query) if within the daily search quota.

* **Query Parameters:**
  * `q` (required, string, 2–120 chars)
  * `lang` (optional, ISO 639-1 code, default `en`)
* **Response (`200 OK`):**
```json
{
  "ok": true,
  "source": "YOUTUBE_API_CACHED",
  "results": [
    {
      "videoId": "zIwLWfaAg-8",
      "title": "WTF is with Elon Musk? | Nikhil Kamath | People by WTF Ep 16",
      "channelTitle": "Nikhil Kamath",
      "thumbnailUrl": "https://i.ytimg.com/vi/zIwLWfaAg-8/hqdefault.jpg",
      "durationSec": 7345,
      "captionStatus": "READY"
    }
  ]
}
```

---

### 2.2 Video Initialization & Lazy Transcript Ingestion (2-Second Rule)

#### `POST /api/videos/:videoId/init`
Triggered by the browser **only after the viewer has actively watched the video for $\ge 2.0$ seconds**. Checks D1 for existing windows; if missing and within the daily transcript budget, fetches captions via the swappable Transcript Adapter (Supadata $\rightarrow$ TranscriptAPI), builds 600–800 word windows, indexes FTS5, and prepares Window 0 for **Way**.

* **Request Body:**
```json
{
  "watchedSeconds": 2.4,
  "currentPlayheadSec": 2.4,
  "language": "en",
  "title": "WTF is with Elon Musk? | Nikhil Kamath | People by WTF Ep 16",
  "channelTitle": "Nikhil Kamath",
  "durationSec": 7345
}
```
* **Validation Rule:** Rejects with `400 WATCH_THRESHOLD_NOT_MET` if `watchedSeconds < 2.0`.
* **Response (`200 OK`):**
```json
{
  "ok": true,
  "videoId": "zIwLWfaAg-8",
  "captionStatus": "READY",
  "windowCount": 28,
  "windows": [
    {
      "windowIndex": 0,
      "startSec": 0.0,
      "endSec": 135.4,
      "wordCount": 390
    },
    {
      "windowIndex": 1,
      "startSec": 105.4,
      "endSec": 360.8,
      "wordCount": 712
    }
  ]
}
```

---

### 2.3 "Way" Predicted Questions Window Endpoint

#### `GET /api/videos/:videoId/way?windowIndex={index}&lang={lang}&mode={full|titles}`
Returns the 5–8 predicted and learned questions for a specific speech window. Served with immutable/long-lived CDN headers (`Cache-Control: public, max-age=86400, s-maxage=604800`) once generated.

* **Query Parameters:**
  * `windowIndex` (required, integer $\ge 0$)
  * `lang` (optional, default `en`)
  * `mode` (optional, `full` or `titles` for cellular Data-Saver mode)
* **Response (`200 OK`):**
```json
{
  "ok": true,
  "videoId": "zIwLWfaAg-8",
  "windowIndex": 6,
  "startSec": 1380.0,
  "endSec": 1740.0,
  "questions": [
    {
      "id": "wq_98a7b6c5",
      "questionText": "Why can't Starlink serve dense cities directly?",
      "triggerSec": 1455.0,
      "answer": {
        "videoId": "zIwLWfaAg-8",
        "videoTitle": "WTF is with Elon Musk? | Nikhil Kamath | People by WTF Ep 16",
        "channelTitle": "Nikhil Kamath",
        "startSec": 1661.0,
        "endSec": 1731.0,
        "isExternalVideo": false
      },
      "confidenceScore": 0.96
    }
  ]
}
```

---

### 2.4 Live Question Resolution & "Dive Deeper"

#### `POST /api/query/ask`
Resolves a viewer's spoken or typed question (or a "Dive Deeper" follow-up) to the single most accurate video segment or a verified 30–40 word AI fallback.

* **Request Body:**
```json
{
  "videoId": "zIwLWfaAg-8",
  "currentPlayheadSec": 1462.5,
  "windowIndex": 6,
  "questionText": "Wait, why can't Starlink just handle dense cities if they're adding thousands of satellites?",
  "language": "en",
  "isDiveDeeper": false,
  "excludedRanges": [],
  "ttsOptIn": false
}
```
* **Response Case A — Video Segment Match (`200 OK`):**
```json
{
  "ok": true,
  "resolutionType": "IN_VIDEO_SEGMENT",
  "cacheSource": "WAY_PREPARED_MATCH",
  "answerClip": {
    "videoId": "zIwLWfaAg-8",
    "videoTitle": "WTF is with Elon Musk? | Nikhil Kamath | People by WTF Ep 16",
    "channelTitle": "Nikhil Kamath",
    "speakerName": "Elon Musk",
    "startSec": 1661.0,
    "endSec": 1731.0,
    "isExternalVideo": false,
    "breadcrumbSummary": "Elon explains satellite beam cone physics at 550 km vs. 1 km urban cell towers."
  },
  "clarificationPrompt": "Does that clarify Starlink's urban beam capacity, or would you like to dive deeper into cellular spectrum?",
  "governorState": {
    "stepDownLevel": "NORMAL"
  }
}
```
* **Response Case B — Verified AI Fallback (`200 OK`):**
```json
{
  "ok": true,
  "resolutionType": "AI_VERIFIED_FALLBACK",
  "aiFallback": {
    "isAiLabeled": true,
    "reason": "No video segment directly states the current residential hardware price in India.",
    "answerText": "Starlink's standard residential kit is priced around $349 USD globally, though Indian commercial pricing awaits final regulatory spectrum allocation and gateway licensing.",
    "wordCount": 23,
    "citations": [
      {
        "title": "Starlink Specifications and Hardware Pricing",
        "url": "https://www.starlink.com/specifications"
      }
    ],
    "ttsAudioBase64": null
  }
}
```

---

### 2.5 Voice Transcription Fallback (Gnani Prisma v3.0)

#### `POST /api/voice/transcribe`
Called when the browser's native `Web Speech API` is unavailable, fails, or when the user speaks in one of the 9 supported Indian languages (`hi`, `bn`, `mr`, `gu`, `pa`, `kn`, `te`, `ta`, `ml`).

* **Headers:** `Content-Type: multipart/form-data`
* **Form Fields:**
  * `audio`: Binary audio blob (`audio/webm` or `audio/wav`, max duration `30.0` seconds, max size `2 MB`).
  * `language`: Language code (`en-IN`, `hi-IN`, `te-IN`, etc.).
  * `durationSec`: Actual detected speech duration in seconds.
* **Response (`200 OK`):**
```json
{
  "ok": true,
  "provider": "GNANI_PRISMA_V3",
  "transcript": "Why can't Starlink handle dense cities with thousands of satellites?",
  "language": "en-IN",
  "durationSec": 4.8
}
```

---

### 2.6 Governor Status & Calibration Batch

#### `GET /api/system/status`
Returns real-time operational health, active daily credit cap, and feature availability.

#### `POST /api/admin/calibrate`
Protected by `X-Admin-Calibration-Key`. Runs or records the pre-submission Gnani calibration batch (10 Prisma clips + 20 Evon calls, capped at $\le 60$ credits / $2\%$ of pool) and updates `calibration_rates` in D1.