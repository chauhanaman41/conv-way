# Conv-way: Product Vision Document

Version 0.3 (draft) · 8 November 2026 · Audience: product and engineering team

This document is derived from the Conv-way case study and the competitive research. It defines what we are building and why. It does not define the detailed architecture, and it does not split the idea into releases. A working prototype is expected with the 10 November submission, but this document is completed first.

## 1. Core Idea

Conv-way is a web app that lets people talk to a YouTube video while it plays. The viewer asks a question out loud (or types it). Conv-way finds the part of a video that answers it, plays only that part, and then hands control back to the viewer: ask another question, go deeper, or continue the original video from exactly where they left off.

The one-line pitch: **don't pause your curiosity, let the video follow it.**

The differentiator is not "AI that answers questions about a video". That already exists. The differentiator is **playback orchestration**: listening, finding the answer, playing just that answer, and reliably returning the viewer to where they were.

A quiet side panel, **Way**, adds a second way in. It lists questions about what is being discussed right now, with answers prepared in advance. It never interrupts the viewer: tapping a question is the viewer's choice, and one tap gives an instant answer. It also avoids wasted compute and data. See section 9.

## 2. Problem

Long-form video and podcasts are dense. Viewers regularly hit jargon, disputed claims or gaps in understanding while the video keeps playing.

- **Looking something up breaks the flow.** The viewer has to pause, open another tab, write a query, sift through results, then find their place again.
- **Many people skip it.** The mental cost is high enough that confusion goes unresolved or the viewer disengages.
- **Existing tools stop at the answer.** Transcript search, chat-with-video tools and conversational search return text or a link. They do not manage the journey: interrupt, explain, return.
- **Answers are hard to trust.** Generated answers can be wrong, and users cannot easily see what a claim is based on. A clip of a real speaker explaining the point is easier to verify than a paragraph of generated text.

## 3. Vision

Any YouTube video becomes a conversation. A viewer never has to leave the player to understand what they are watching.

The experience should feel like watching alongside a knowledgeable friend who can instantly cue up the exact moment that answers your question, and then gets out of the way.

Principles the design must follow:

1. **The best answer on YouTube wins.** The answer must be the most accurate source available, whether it sits in the current video or in any other YouTube video. We match the meaning and key terms of the viewer's question, not just the current video.
2. **Answer only, nothing extra.** Play only the part of the source that answers the question.
3. **A face behind every answer.** Answers are YouTube videos first, never articles. A named speaker and channel mean someone is accountable for the claim. Only when no video answers, or a claim looks wrong, a short AI answer fills in, clearly labeled as AI.
4. **The viewer is always in control.** After every answer, control returns to the viewer.
5. **Never lose the viewer's place.** The original position is saved before any detour and can always be restored.
6. **Source transparency.** The viewer can always see where an answer came from (channel, speaker, video, time range).
7. **Zero setup, no sign-in.** Viewers sign in nowhere and manage no API keys. Conv-way is an overlay on YouTube, keeps no user history, and treats every viewer the same.
8. **Frugal with compute and data.** Do work only when it will likely be used, and share it across viewers (see section 9).
9. **Degrade gracefully.** If voice, retrieval or AI fails, the video keeps playing and the viewer can still type, tap or resume.

## 4. Target Users

Anyone who watches YouTube. There is no restriction by profession, topic or content type. Conv-way should work for podcasts, interviews, lectures, tutorials, panel discussions, documentaries and any other long-form or short-form video.

Conv-way is scoped by platform, not by audience: **YouTube only**.

The case study's reference scenario is a two-hour interview (Musk x Kamath, Episode 16) where a viewer asks about Starlink capacity in dense cities. Our design should work for that, but it must not depend on any particular genre.

## 5. Target Devices and Platforms

Conv-way is a **responsive web application**. There is no install and no app store. The user opens a link or searches for the product, and starts watching with no sign-in.

| Target | Support goal | Notes |
| --- | --- | --- |
| Laptop / desktop browser | Primary, full experience | Chrome, Edge, Safari and Firefox on current versions. Best case for ambient voice with headphones or hardware echo cancellation. |
| Native apps, TV, smart speakers | Not part of this idea | Revisit after validation. |
| Mobile browser | Primary, full flow | Mobile Safari (iOS) and Chrome (Android). Layout is designed mobile-first for the player, question controls and return controls. |

Platform implications for the team:

- **Push-to-talk is the reliable baseline on every device.** Always-on listening is a progressive enhancement, because mobile browsers restrict background microphone use and speaker echo can pollute recognition.
- Microphone permission must be explicit, with a visible microphone state at all times.
- Controls must be touch-friendly and usable one-handed on a phone.
- The layout must adapt between a side-by-side desktop view and a stacked mobile view without hiding the return point.

## 6. Primary User Flow

1. **Arrive.** The user visits the Conv-way link or finds it by search. There is no Conv-way account or sign-up.
2. **No sign-in.** The viewer needs no account. Conv-way reads public YouTube data through its own server-side access, so no viewer's activity touches anyone's personal YouTube account or suggestions.
3. **Browse or search.** The viewer sees the top 20 trending podcasts, like the YouTube home screen, or searches YouTube, or pastes a link.
4. **Watch.** The video plays in an embedded YouTube player. After the viewer has watched for 2 seconds, which confirms they are really watching, Conv-way fetches the transcript and prepares the index and Way questions in the background. Until then, Way shows a skeleton placeholder. Partial results are usable as soon as they exist.
5. **Ask.** The user holds **Push to talk**, turns on **Conv-way mode** for continuous listening, types, or taps a question in the **Way** panel.
6. **Save the place.** Conv-way saves the current playback position and shows a visible "return point saved" indicator.
7. **Answer.** Conv-way finds the most accurate answering segment across the current video and all of YouTube, and plays only that segment. A segment from another video plays in a small picture-in-picture player.
8. **Hand back.** When the segment ends, playback stops and the viewer chooses: **Ask another question**, **Dive deeper**, or **Continue the original video** at the saved position.
9. **Repeat or resume.** Follow-ups can nest (see the playback stack below). Once the viewer continues, the answer state is discarded.

Differences from the case study: control is handed back to the viewer after every answer (no automatic return), answers can come from any YouTube video, and nothing about the session is kept afterwards.

## 7. Interaction Model

Four ways to ask, available at all times:

| Mode | Behavior | Availability |
| --- | --- | --- |
| **Push to talk** | Hold or tap a button to speak. Video audio ducks or pauses only while the user speaks. | Default on all devices. |
| **Conv-way mode (ambient)** | The user switches it on once and can speak at any time. Voice activity detection triggers listening. | Opt-in toggle. Recommended with headphones. |
| **Text** | Type a question. | Always available as fallback. |
| **Way panel** | Tap a predicted question to play its answer. No speaking or typing needed. | Always available (see section 9). |

While the user speaks, the video either **ducks** (volume drops to roughly 15 to 20 percent) or **pauses**, as a user setting. Pause is the safer default when no headphones are detected.

A persistent, lightweight status indicator should always show one of: idle, listening, thinking, playing answer, waiting for you.

## 8. Answer Behavior

This is the core product rule and the main thing the team needs to get right.

**For every question, Conv-way plays the single most accurate answering segment, and only that segment.**

- **Source selection.** Search the current video first (fast, already indexed) and search other YouTube videos when needed. Choose by accuracy, not by location. The key terms and meaning of the viewer's question must match the answer.
- **Video first.** The answer is a segment of a YouTube video, so a real person and channel stand behind it. No articles.
- **Tight boundaries.** The clip starts where the answer begins and ends where it ends. Not the whole topic discussion, not the full video.
- **Playback.** A segment from the current video plays by seeking the main player. A segment from another video plays in a small picture-in-picture (PiP) player while the main video is paused. PiP behavior and look are defined in design.md.
- **Clear labeling.** The viewer sees the video title, channel, speaker and time range.
- **No video answers it, or the claim looks wrong.** Try hard for a video match first. If no video answers the question, or the speaker's claim is contradicted by available research, give a short AI-generated answer of 30 to 40 words with the reason and a link to the source page it relies on. The answer must rest on a page actually retrieved. With no retrieved source there is no AI answer, and Conv-way says no good match was found. Label it clearly as AI so it is never mistaken for what a speaker said, and say so when the evidence is weak. Never play a weak match as if it were authoritative.
- **Language.** Prefer a video in the language of the viewer's question. If none exists, use the video that best answers the question, in any language, with captions in the viewer's language where YouTube offers them.
- **Hand back.** After the clip, control returns to the viewer, who decides what happens next.

### Playback state

The viewer's position is managed as a stack, so nested questions work:

- Stack entry: video ID, timestamp, speed, volume, and branch.
- Asking a question pushes the current position.
- "Continue" pops back to the immediate parent. "Return to start" restores the original video and position.
- The stack lives only in memory for the current session. It is discarded when the viewer continues, finishes or leaves. No history, no accounts, no cross-device sync.
- It is independent of the AI services. A slow or failed request must never corrupt the saved position.

## 9. Way: Predicted Questions and Answers

Way is a quiet panel of questions about what is being discussed right now, with answers prepared ahead one window of about four minutes at a time, so a tap or a repeated question costs almost no compute or data.

### The idea

- **Quiet by design.** The panel sits beside the player (below it on mobile). It never overlays the video, makes no sound and never interrupts. The viewer can ignore it completely. While the transcript and first window are loading, it shows a skeleton placeholder.
- **Follows the conversation.** Questions are prepared ahead for a window of about four minutes of speech, and each carries the moment it relates to. The panel reveals a question only when playback reaches that moment, so it never shows questions about parts the viewer has not heard.
- **Questions first, answers on tap.** Only questions are shown. The answer plays only if the viewer taps one: the answer segment from the same video, then the usual hand-back (section 8). The tap is the viewer's choice to see it, even if the best answer sits later in the video.
- **Faster own questions.** When the viewer asks their own question aloud or by text, Conv-way first checks the prepared ones. A close match is served from the prepared answer, which saves search time. Otherwise it runs the normal search.
- **The cache learns.** Live questions that missed the cache are added for the next viewers. Only the normalized question and the answer range are stored, never who asked.
- **Answers are time ranges.** A prepared answer is a video ID, a start and an end in the same video. It is not generated text and not downloaded media.

### Plan to avoid wasted compute and data

| Technique | How it works | Saves |
| --- | --- | --- |
| One window ahead only | Build context for the first window (see the window size decision) and predict 5 to 8 questions. Start the next window when playback passes about 75% of the current one. Never process the whole video up front. | Compute |
| Share across viewers | Cache by video ID, window start and language, not by user. One viewer's work serves everyone watching the same video. | Compute |
| Answers are time ranges | Each prepared answer is a video ID plus start and end seconds, a few hundred bytes. The video streams through YouTube's player as usual. | Data |
| Verify before storing | Keep a predicted question only if a real segment in the indexed transcript answers it. Drop the rest. | Compute, trust |
| Cheap first, detail on tap | Generate short question titles first. Resolve exact answer ranges for the top few and the rest when tapped. | Compute |
| Match live questions to prepared ones | Check the viewer's question against the 5 to 8 prepared questions of the current window, first by key words, then with one short model call if unclear. Serve the stored answer only on a clear match. A miss is better than a wrong hit. | Compute, latency |
| Idle when nothing is happening | No work before the viewer has watched for 2 seconds, while paused, or while the tab is hidden. After a seek, wait 3 to 5 seconds before rebuilding the window at the new position. | Compute |
| Quiet client | The browser tracks the playhead locally with no per-second calls. One panel request per window (about every 4 minutes) plus a request when the viewer asks. Microphone audio is sent only while speech is detected, or while push-to-talk is held. | Data |
| Data-saver aware | On cellular or with data saver on, fetch only question titles for the next window and fetch details on tap. | Data |
| Overlap and rolling summary | Windows overlap by about 30 seconds and carry a short summary of earlier content, so a question like "what did he mean earlier?" works without reprocessing. | Accuracy |
| Warm popular videos | Pre-generate all windows for high-traffic videos in off-peak batches. | Compute |

### Window size decision

Windows are sized by amount of speech, not by clock time: about 600 to 800 spoken words, which is about four minutes of normal conversation, and never less than 2 or more than 6 minutes.

- **Why words, not minutes.** Every AI request stays about the same size, so cost and response time are predictable and fit the short time limits of free server functions.
- **Why not shorter.** One-minute windows would need about four times as many AI calls for the same video.
- **Why not longer.** Ten-minute windows mean slower, larger requests and a higher risk of timeouts on a free host.
- **Fast start.** The first window of a video covers only about two minutes, so the panel fills quickly.
- **Cost follows watching, not video length.** Only one window ahead of the playhead is ever prepared, so a three-hour video costs nothing extra until it is watched.

### Where the cache lives, and how it runs on free hosting

Two layers share the work. The server side holds the shared cache, so one viewer's work serves everyone. The browser holds only a tiny, disposable copy for the video being watched.

| Layer | What it holds | Where it lives | Limit |
| --- | --- | --- | --- |
| Browser memory | Questions and answer ranges for the current and next window, a few KB each | The viewer's browser, in memory only | Discarded when the video closes. No transcripts, no vectors, no models downloaded. |
| Edge cache | Finished window data, which never changes for a given video, window and language | The free CDN in front of the host | Long-lived cache headers, so repeat requests never wake a server function. |
| Shared database | Transcript text with a full-text index, prepared questions, answer ranges, learned live questions | A free-tier database on the hosting side | Roughly 0.2 MB per two-hour video, since no vectors are stored (estimate to verify). Evict least recently used items before the free limit is reached. |

Rules for free hosting and low-end devices:

- **Short server jobs.** Free server functions have short time limits and may sleep when idle, so each job is one small AI request per window. Heavy work such as audio transcription is never run on the host.
- **Light client.** The browser needs only the player, a small panel of text and the microphone. No on-device AI models are downloaded.
- **Speech-to-text off our host.** Use the browser's built-in speech recognition where it exists, which costs us nothing. Fall back to a paid speech service only where it does not.
- **Capability check.** Where the browser reports memory, CPU cores, connection type or data saver, use them to pick a lighter mode: push-to-talk and text only, no ambient listening, no animations, question titles only. If the browser reports nothing, assume a low-end device.
- **Eviction and expiry.** Keep popular videos, drop the least used, and expire learned questions that are rarely matched.
- **Verify limits per provider.** Free tiers differ and change.

### Measures

- Share of live questions served from prepared answers. Track from day one and set a target after the pilot.
- Panel payload per window. Design goal: under 20 KB.
- Compute cost per watched minute. Expect it to fall as the shared cache warms.
- Wrong-hit rate (a prepared answer that did not answer the question). Goal: close to zero, because accuracy comes first.

### Deferred to design.md

- Panel layout: side panel on desktop, bottom sheet on mobile, how many questions show, how old questions leave when a new window arrives.
- Picture-in-picture player: size, position, dragging, controls, how the paused main video is shown. Check YouTube's minimum player size rules first.
- Hand-back controls, the "return point saved" indicator, status indicator and microphone states.

## 10. Goals

### Product goals

1. A viewer can ask a question during any YouTube video and get an accurate, clipped answer without leaving the player.
2. The viewer is returned to the exact original position every time they choose to continue.
3. The same flow works on a laptop browser and a mobile browser, with no install.
4. Every answer is traceable to a visible source and time range.
5. The product is simple enough that a new user succeeds in their first session without instructions.

### What Conv-way does

- Browse and search YouTube inside the app with no sign-in, showing the top 20 trending podcasts and search, plus paste-a-link.
- Embedded player with save and restore of playback position.
- Transcript ingestion and a timestamped index for the active video.
- Push-to-talk, text, and an optional ambient Conv-way mode, with ducking or pausing as a user setting.
- Answer retrieval across the current video and all of YouTube, matched on the meaning and key terms of the question, in the viewer's language where possible.
- Answer-only clip playback: seek in the main player, or use picture-in-picture for other videos.
- End-of-clip hand-back: ask another, dive deeper, or continue.
- Nested follow-ups using the in-memory playback stack.
- Way: a quiet panel of predicted questions with prepared answers (section 9).
- Speaker-aware retrieval and confidence indicators.
- Manual fallbacks for every automated step.

### What Conv-way is not

- Platforms other than YouTube (podcast RSS, local files, courses).
- Native mobile apps.
- Articles or written sources as answers. Answers are YouTube videos, with a short labeled AI answer only as a fallback.
- Conv-way accounts, viewer sign-in, stored history and cross-device sync.
- Fact-check overlays.
- Pricing design. Pay-per-use is assumed and will be defined separately.

### Initial success measures (proposed, to be validated)

| Measure | Proposed target |
| --- | --- |
| Playback position restored correctly after a detour | 95% or higher in controlled tests |
| Retrieved clip lands on the intended answer | 90% or higher on a curated test set |
| Time from end of question to answer playing | Under 2 seconds for in-video, with a visible progress state for external lookups |
| Original playback preserved after any AI service failure | 100% |
| First-session completion of ask, answer, return | Majority of new users without help |

## 11. Hosting, Models and Credits

Run Conv-way on Cloudflare's free plan for hosting and storage, use Gnani's Prisma, Evon and Timbre only where they earn their credits, and cap spending with a daily credit budget.

### Hosting: Cloudflare free plan

| Need | Cloudflare piece | Free limit (verify before launch) |
| --- | --- | --- |
| Front end and CDN | Pages (static hosting) | Static files served from the edge |
| Server functions | Workers | 100,000 requests a day, 10 ms CPU per request. Time spent waiting on other APIs does not count. |
| Shared cache database | D1 (SQLite with full-text search) | 5 GB total, 5 million rows read and 100,000 rows written a day |
| Small lookups | Workers KV | 1 GB, 100,000 reads and 1,000 writes a day |
| Edge cache | Cache headers on finished window data | Included |
| Daily top 20 job | Cron Trigger | Check the free allowance |
| API keys | Worker secrets (YouTube, Gnani, search, transcript API) | Included |

Why it fits 100 viewers a day:

- **Requests.** About 2,000 a day if each viewer makes about 20 (assumption), roughly 2% of the free limit.
- **Writes.** Store transcripts and prepared questions as one row per window, not per caption line, so even 100 new videos a day stay far below 100,000 row writes.
- **CPU.** Parse and index in window-sized pieces so each request stays under 10 ms. If testing shows otherwise, Workers Paid costs $5 a month and raises the limit.
- **No sleeping.** Some free hosts pause idle apps, so the first viewer waits (Render's free web services, for example; verify).
- **Terms.** Some free plans restrict commercial use (Vercel's Hobby plan, for example; verify). You plan pay-per-use, so read each provider's terms first.

### The Gnani models and the credit pool

What the docs and listings say (checked 8 November 2026):

- **Prisma (speech-to-text).** Prisma v3.0 launched on 28 October 2026 and replaces v2.5. It supports English and nine Indian languages (Hindi, Bengali, Marathi, Gujarati, Punjabi, Kannada, Telugu, Tamil, Malayalam). REST clips are limited to 30 seconds, streaming sessions to 15 minutes, batch files to 4 hours. A third-party listing prices it near $0.28 per audio hour. Gnani does not publish the credit cost for Prisma or Evon, so the plan measures it (see the credit governor).
- **Evon v3.3 (language model).** A 30B mixture-of-experts open-weight model covering English and ten Indian languages including Telugu. Weights are available by request, and self-hosting needs GPUs, which a free host cannot provide. It must be called through a hosted endpoint. Your credit pool includes the Evon endpoint (confirmed).
- **Timbre (text-to-speech).** 10+ Indian languages with streaming output.

| Model | Used for | How credits are saved |
| --- | --- | --- |
| Prisma | Voice questions, only when the browser's built-in speech recognition is missing or fails, and for Indian-language or mixed-language speech | Send only detected speech in clips under 30 seconds, never silence |
| Evon | Way: predict questions and pick answer ranges, one call per window. Reranking live search candidates. The AI fallback answer. | Shared cache, one combined call per window, only for videos watched past 60 seconds, no calls for silent windows |
| Timbre | Reading an AI fallback answer aloud in hands-free mode. Fixed phrases such as "Jumping ahead" are generated once and stored as audio files. | Opt-in only, never used for video clips |

The browser's built-in speech recognition is tried first, because it costs no credits.

### Credit governor

- **Rates are not published, so measure them.** Before the 10 November submission, run a calibration batch: about 10 Prisma clips of known total length and about 20 Evon calls of the kinds Way and live questions will make. Compare the credit balance before and after each batch, then record credits per audio minute and credits per Evon call type. Stop early if the batch uses more than about 2% of the pool (about 60 credits).
- **Deadline.** The submission is on 10 November and review is expected to take at least 30 days, so the pool must last until about 15 December 2026, which is 37 days from today. The budget is 3,000 credits. The other 2,000 on the dashboard are reserved for other work and used only if needed. Daily cap = remaining credits divided by days left, recalculated each day so unused credits roll forward. Today that is about 81 credits a day, or about 73 after a 10% reserve. During review, traffic is likely a handful of testers, so the 100-viewer plan is a capacity target, not the expected load.
- **Meter every call.** Record credits per call in the database and keep a running daily total, so the app enforces the cap.
- **When credits are short, spend in this order:** answering live questions (search and reranking), then Way windows for the videos with the most viewers, then the AI fallback, then spoken answers. Voice questions are covered first by the browser's free recognition.
- **Skip the model when a keyword match is a clear winner.** This saves one Evon call per question.
- **Reuse is the main saving.** The home screen sends viewers to the same 20 videos, so most Way windows are prepared once and reused. The first viewer pays and later viewers do not.
- **Stepping down.** At 80% of the day's cap, generate Way questions only for windows not yet cached. At the cap, stop all new model calls: voice uses browser recognition, the AI fallback and spoken answers are off, and cached answers, video clips and playback keep working.

Worst-case demand at 100 viewers a day, with no sharing between viewers:

| Work | Volume |
| --- | --- |
| Voice questions | 500 a day at about 6 seconds, roughly 50 audio minutes (less once browser recognition handles most) |
| Way windows | Up to about 750 a day if each viewer watches 30 minutes of a different video. Far fewer when viewers share videos. |
| Live reranks | Up to 500 a day, fewer with prepared matches |
| AI fallback | About 50 a day if 10% of questions need it (assumption) |

The shared cache and the governor are essential. With a daily cap near 81 credits, the first job is the measurement batch, because it shows how many Evon calls and Prisma minutes that cap really buys.

### Transcript source

Decision: fetch existing captions (manual or automatic) through Supadata (a managed transcript API), called from a Worker and kept behind an adapter so the provider can be swapped.

- **How it works.** The provider fetches the caption track from YouTube through its own rotating proxies and returns timestamped JSON (text, start, duration). No audio is downloaded or transcribed, so there is no speech-to-text cost. The timestamps match YouTube's, so seeking lands on the spoken phrase.
- **Why a managed API.** Scraping YouTube directly from a cloud host is often blocked by rate limits and bot checks. A managed provider absorbs that and any format changes.
- **Free tiers only.** There is no budget for paid plans. Supadata's free tier gives 100 credits a month at 1 request per second, about 1 credit per transcript. A second transcript API key, supplied by the owner, is the fallback behind the adapter. The fallback is TranscriptAPI's free tier, which lists 100 free credits that appear to be one-time rather than monthly (verify). Over the review window that is roughly 200 transcripts, or about 5 a day.
- **Transcript budget rules.** Fetch a transcript only after a viewer has opened the video and watched it for 2 seconds, store it in the shared database and never fetch it again. The top 20 videos are not fetched ahead of time. The home screen sends everyone to the same 20 videos, so reuse carries most of the load. When the daily budget is used, videos without a stored transcript get limited support.
- **Cross-video answers.** Search only transcripts already stored. Fetch a new candidate transcript only while budget remains, at most one per question.
- **Provider order.** Supadata first. If it fails or its free credits run out, the adapter uses the fallback key.
- **Rate limits.** On a 1-request-per-second tier, queue fetches and show Way and search as preparing until the transcript arrives.
- **Risk.** Direct scraping and managed APIs both use YouTube's undocumented internal endpoints. They can break without notice and may conflict with YouTube's terms, and a third party doing the scraping does not remove that. Keep the adapter swappable and revisit if YouTube or the provider changes.

### Videos without usable captions

These get limited support, and no credits are spent transcribing their audio. The same state applies when the daily transcript budget is used up.

- Transcribing a video's audio means downloading it, which YouTube's terms generally do not allow, and Gnani batch transcription takes audio files or file URLs, not YouTube links. Confirm in a policy review.
- Many long videos have automatic captions, so the gap may be small. Measure it on the top 20 list.
- For such a video, Way shows no questions and says why in one line. The viewer's own questions still work through other videos and the AI fallback. Playback and the return point work as usual.

### Sources for AI fallback answers

- The fallback uses a two-pass grounded search architecture: trusted domain list first (via Tavily and Exa, with optional Google CSE), then open web through Tavily and Exa if needed. Note: Google's Custom Search JSON API is closed to new customers (20 Jan 2026) and ends on 1 Jan 2027, so the Google engine is optional and auto-disables. Bing's API was retired in Aug 2025. The model may cite only pages the search actually returned.
- No retrieved source means no AI answer. This prevents invented links.
- The answer card shows the 30 to 40 word answer, a one-line reason, the source link or links, and an AI label.
- A claim is flagged as contradicted only when a retrieved source contradicts it.
- Evon is strongest on Indian languages. Test its English fact-checking on a curated question set before trusting it.

Sources checked: [Gnani STT limits](https://docs.gnani.ai/api/STT/limits.md), [Gnani API introduction](https://docs.gnani.ai/api/introduction/introduction), [Evon v3.3 model page](https://huggingface.co/gnani/gnani-evon-v3.3-30b-a3b), [Prisma v3.0 listing](https://www.callmissed.com/models/gnani-prisma-v3-0), [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## 12. Constraints and Risks to Resolve Early

These affect the architecture and should be investigated before detailed design.

1. **Transcript access.** The official YouTube APIs do not offer transcript download for arbitrary videos we do not own. The chosen source is existing captions fetched through a managed transcript API behind a swappable adapter (section 11). That path is unofficial and can break or conflict with YouTube's terms, so it remains the biggest risk.
2. **Search across all of YouTube.** Answers can come from any video, so every candidate needs transcript-level search. Search is the most expensive Data API call in quota terms (see the access model below). We may need a prebuilt or on-demand index of candidate videos.
3. **Viewer independence.** Conv-way must work for every viewer without touching the owner's personal YouTube account or any viewer's account. This rules out sign-in and personalized recommendations, so discovery uses curated podcasts, trending lists and search.
4. **Player and terms of service.** The embedded player must stay visible and unmodified, and clip playback must use supported player functions (start and end times). A small picture-in-picture player must still meet YouTube's minimum player size rules, and running a second player while the main one is paused needs a policy review.
5. **API key safety.** Keep the key on the server only and restrict its use. A key placed in browser code can be copied and used up. Never use a personal YouTube account for any call.
6. **Accuracy of clip boundaries.** Transcript chunks often do not align with sentence boundaries. We need word-level timestamps and validation of every timestamp against video duration.
7. **Mobile audio and microphone behavior.** Browser autoplay rules, microphone permission, audio session handling and echo on speakers vary by device. Prototype early on real phones.
8. **Latency.** Pre-index the active video on load so local retrieval is fast, and show progress for slower cross-video lookups.
9. **Language matching.** Matching a question in one language to videos in another needs multilingual retrieval and a clear rule for the fallback language.
10. **Privacy.** The microphone state must be obvious. The shared Way cache stores only normalized questions and answer ranges, never user identity.

### YouTube API access model

Use one server-side API key from a dedicated Google Cloud project, with no viewer sign-in. The owner's personal feed stays untouched. The real limit is the shared daily quota.

- **The owner's personal suggestions are safe.** An API key reads public data and carries no account identity, so its calls never change any account's watch history or recommendations. History changes only when a signed-in viewer plays a video in their own browser, and that affects only that viewer.
- **Sign-in would not help with quota.** Quota is counted per Google Cloud project, so signed-in viewers' calls would still use the project's allowance. Sign-in would only add personalization, which the API may not offer. The design leaves it out.
- **Playback costs no quota.** The embedded player plays and seeks without Data API calls. Quota is spent only on discovery and metadata.
- **Quota is the constraint.** The default is about 10,000 units a day per project. A search costs about 100 units, and simple lookups such as video details or a channel's uploads cost about 1. Verify the current numbers. At these rates, search alone allows roughly 100 calls a day.

How to stay within quota:

1. Build the top 20 trending podcasts list once a day and share it with every viewer. Rank a curated list of podcast channels using cheap channel and playlist lookups, because YouTube may not offer an official trending podcasts list (verify). One daily search is the fallback.
2. Keep the top 20 list cached for a day and share it.
3. Cache search results and video details by normalized query and share them across all viewers.
4. Check our own transcript index first and call YouTube search only on a miss.
5. Set a daily budget and per-viewer rate limits. When the budget runs out, show a clear message. Playback keeps working.
6. Apply to Google for a quota increase once real usage is known.
7. Avoid unofficial scraping routes. They put the project's access and YouTube's terms at risk.

### Capacity plan for 100 viewers a day

| Item | Assumption or budget |
| --- | --- |
| Viewers | 100 per day |
| Live questions | About 500 a day, assuming 5 per viewer (to validate) |
| Answered without a YouTube search | Goal: 80% or more, from the current video's index or the shared cache |
| YouTube searches | About 100 a day if 20% of questions need one, which is about 10,000 units, the whole default quota |
| Top 20 trending list | Once a day, shared by everyone, about 100 units at most |
| Daily search budget | About 90, leaving room for the list and cheap lookups |
| When the budget runs out | Cross-video answers use only videos already in our index. Answers within the current video, Way and playback keep working |

This is tight on the default quota, so apply for an increase early and log daily usage so the real numbers replace these assumptions.

## 13. Decisions Recorded

These decisions come from the product owner's answers on 8 November 2026 and are the working baseline.

| Question | Decision |
| --- | --- |
| Panel name | The side panel is called Way. |
| Answer is in a different video | Play it in a small picture-in-picture player. Look and behavior are defined in design.md. |
| No video answers the question | Try hard for a video match first, because a channel and a face give accountability that an article does not. If no video answers, or the speaker's claim looks contradicted by research, give a short AI answer of 30 to 40 words with the reason and a link to a retrieved source page, labeled as AI. No retrieved source, no AI answer. |
| Source finder for AI answers | A web search API with a free tier, used only as the fallback. |
| "Dive deeper" | Search the current video and all of YouTube. The best answer wins, matched on the key words and meaning of the question. |
| Sign-in and discovery | No sign-in. One server-side API key from a dedicated project, so no personal YouTube feed is touched (section 12). |
| Home screen | The top 20 trending podcasts, one global list, like the YouTube home screen. Layout is defined in design.md. |
| History and sync | None. State lives only while the answer is being delivered. Conv-way is an overlay on YouTube. |
| Language | Prefer a video in the viewer's language. If none exists, use the best answering video in any language. |
| Way window size | Sized by amount of speech: about 600 to 800 words, between 2 and 6 minutes (section 9). |
| Cache | Shared cache on the server side plus a tiny disposable cache in the viewer's browser. Anonymized live questions and answer ranges may be stored (section 9). |
| Hosting | Cloudflare free plan: static hosting, Workers, D1, cron and edge cache. Verify limits and commercial-use terms (section 11). |
| Transcript source | Existing captions through Supadata's free tier, with a second free-tier key as fallback, behind a swappable adapter. No paid plan. Fetched after the viewer has watched a video for 2 seconds. Unofficial, so it stays the top risk (section 11). |
| Speech and language models | Prisma for voice questions when the browser cannot, Evon for Way and the AI fallback, Timbre only for opt-in spoken AI answers. The pool includes the Evon endpoint (section 11). |
| Credit pool | The budget is 3,000 credits. The other 2,000 on the dashboard are reserved for other work. They must last until about 15 December 2026, because submission is 10 November and review takes at least 30 days. Daily cap is about 81 credits, about 73 after a 10% reserve, recalculated daily. Rates are not published, so a measurement batch comes first (section 11). |
| Videos without usable captions | Limited support. No credits are spent transcribing video audio (section 11). |
| Traffic assumption | 100 viewers per day as a capacity target. Free transcript tiers limit new videos to about 5 a day, so reuse of the top 20 matters (sections 11 and 12). |
| Pricing | Pay-per-use. Not a design concern for now. |
| Way | A quiet side panel of predicted questions about what is being discussed now. Questions only, the answer plays when the viewer taps. Built with the rest of the product, not phased (section 9). |
| Panel and picture-in-picture design | Deferred to design.md. |

## 14. Open Questions

No open questions remain. The real credit rates and the fallback provider's free allowance will be confirmed when the measurement batch runs.
