import React, { useEffect, useState, useRef } from 'react';
import { usePlaybackStore, AnswerClip, PlaybackWindow } from '../stores/playbackStore';
import { useSettingsStore } from '../stores/settingsStore';

export interface WayQuestionItem {
  id: string;
  questionText: string;
  triggerSec: number;
  answer?: AnswerClip;
  confidenceScore: number;
}

interface WindowData {
  windowIndex: number;
  startSec: number;
  endSec: number;
  questions: WayQuestionItem[];
  reason?: string;
  tier?: string;
  modelId?: string;
}

function formatTime(sec?: number): string {
  if (sec === undefined || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const WayPanel: React.FC = () => {
  const { currentVideo, currentTime, isInitialized, windows, pushBranch, syncVideoState, playerRef } = usePlaybackStore();
  const { uiLanguage, dataSaverMode } = useSettingsStore();

  const [activeWindowData, setActiveWindowData] = useState<WindowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeTab, setActiveTab] = useState<'WAY' | 'STACK'>('WAY');

  const seekTimeoutRef = useRef<number | null>(null);
  const lastFetchedWindowRef = useRef<number>(-1);
  const prefetchWindowRef = useRef<number>(-1);

  // Compute local reset time if retryAfter or 00:00 UTC
  const localResetTime = React.useMemo(() => {
    try {
      const target = currentVideo?.retryAfter ? new Date(currentVideo.retryAfter) : (() => {
        const d = new Date();
        d.setUTCHours(24, 0, 0, 0);
        return d;
      })();
      return target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    } catch {
      return '00:00 UTC';
    }
  }, [currentVideo?.retryAfter]);

  // Read live player time if available (even while paused), falling back to store currentTime
  const liveTime = playerRef && typeof playerRef.getCurrentTime === 'function' ? playerRef.getCurrentTime() : null;
  const effectiveTime = typeof liveTime === 'number' && Number.isFinite(liveTime) && liveTime > 0 ? liveTime : currentTime;

  // Map playhead to real window from windows array
  const activeWindow: PlaybackWindow | null =
    windows.find((w) => effectiveTime >= w.startSec && effectiveTime <= w.endSec) ||
    (windows.length > 0 && effectiveTime < windows[0].startSec ? windows[0] : null);

  const currentWindowIndex = activeWindow !== null ? activeWindow.windowIndex : null;

  // Fetch questions for the active real window (busted with &v=2)
  const fetchWindowQuestions = async (winIndex: number) => {
    if (!currentVideo || !isInitialized) return;
    setLoading(true);

    try {
      const mode = dataSaverMode ? 'titles' : 'full';
      const res = await fetch(
        `/api/videos/${currentVideo.videoId}/way?windowIndex=${winIndex}&lang=${uiLanguage}&mode=${mode}&v=2`
      );
      if (res.ok) {
        const data = (await res.json()) as any;
        setActiveWindowData({
          windowIndex: data.windowIndex,
          startSec: data.startSec,
          endSec: data.endSec,
          questions: data.questions || [],
          reason: data.reason,
          tier: data.tier,
          modelId: data.modelId,
        });
        lastFetchedWindowRef.current = winIndex;
      }
    } catch (e) {
      console.warn('[WayPanel] Error fetching Way questions:', e);
    } finally {
      setLoading(false);
    }
  };

  // Debounced real-window fetch
  useEffect(() => {
    if (!currentVideo || !isInitialized || currentWindowIndex === null) return;

    if (currentWindowIndex !== lastFetchedWindowRef.current) {
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = window.setTimeout(() => {
        fetchWindowQuestions(currentWindowIndex);
      }, 350);
    }

    // 75% Window Prefetch for seamless non-linear prediction
    if (activeWindow) {
      const windowSpan = activeWindow.endSec - activeWindow.startSec;
      if (
        windowSpan > 0 &&
        currentTime >= activeWindow.startSec + 0.75 * windowSpan &&
        prefetchWindowRef.current !== activeWindow.windowIndex + 1
      ) {
        prefetchWindowRef.current = activeWindow.windowIndex + 1;
        fetch(
          `/api/videos/${currentVideo.videoId}/way?windowIndex=${activeWindow.windowIndex + 1}&lang=${uiLanguage}&mode=full&v=2`
        ).catch(() => {});
      }
    }

    return () => {
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    };
  }, [currentVideo?.videoId, currentWindowIndex, isInitialized]);

  const handleManualRetry = async () => {
    if (!currentVideo || isRetrying) return;
    setIsRetrying(true);
    try {
      await fetch(`/api/videos/${currentVideo.videoId}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchedSeconds: 2.5,
          currentPlayheadSec: currentTime,
          language: currentVideo.language || 'en',
          title: currentVideo.title,
          channelTitle: currentVideo.channelTitle,
          durationSec: currentVideo.durationSec,
        }),
      });
      await syncVideoState(currentVideo.videoId);
    } catch (e) {
      console.warn('[WayPanel] Manual retry failed:', e);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleQuestionClick = (q: WayQuestionItem) => {
    if (!q.answer) {
      fetch(`/api/videos/${currentVideo?.videoId}/way/${q.id}`)
        .then((r) => r.json())
        .then((data: any) => {
          if (data.ok && data.question?.answer) {
            pushBranch(q.questionText, data.question.answer);
          }
        })
        .catch((e) => console.warn('[WayPanel] Error loading full question:', e));
      return;
    }
    pushBranch(q.questionText, q.answer);
  };

  return (
    <div className="w-full h-full flex flex-col bg-black border-l border-charcoal">
      {/* Editorial Header / Tabs */}
      <div className="h-11 border-b border-charcoal px-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('WAY')}
            className={`font-mono text-xs tracking-wider uppercase transition-colors ${
              activeTab === 'WAY'
                ? 'text-parchment font-semibold border-b-2 border-petal py-2.5 -mb-[1px]'
                : 'text-ash hover:text-bone'
            }`}
          >
            {activeWindow
              ? `WAY // WIN #${activeWindow.windowIndex + 1} (${formatTime(activeWindow.startSec)} - ${formatTime(activeWindow.endSec)})`
              : 'WAY // WINDOW'}
          </button>
          <button
            onClick={() => setActiveTab('STACK')}
            className={`font-mono text-xs tracking-wider uppercase transition-colors ${
              activeTab === 'STACK'
                ? 'text-parchment font-semibold border-b-2 border-petal py-2.5 -mb-[1px]'
                : 'text-ash hover:text-bone'
            }`}
          >
            STACK ({usePlaybackStore.getState().callStack.length})
          </button>
        </div>

        {loading && (
          <span className="font-mono text-[10px] text-lime animate-pulse uppercase">
            SYNCING...
          </span>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'WAY' && (
          <>
            {/* 1. Daily budget exhausted state */}
            {currentVideo?.captionStatus === 'BUDGET_DEFERRED' ? (
              <div className="py-8 px-4 text-center space-y-3">
                <span className="w-2.5 h-2.5 rounded-full bg-petal inline-block animate-pulse" />
                <p className="font-mono text-xs text-parchment font-semibold uppercase tracking-wider">
                  DAILY TRANSCRIPT LIMIT REACHED
                </p>
                <p className="font-sans text-xs text-bone leading-relaxed">
                  Transcript not ready: daily limit reached (5 new transcripts/day). Resets at {localResetTime}.
                </p>
                <div className="pt-1">
                  <button
                    onClick={handleManualRetry}
                    disabled={isRetrying}
                    className="px-3 py-1.5 border border-charcoal bg-black hover:border-petal text-parchment font-mono text-[11px] uppercase tracking-wider rounded-sm transition-colors"
                  >
                    {isRetrying ? 'RETRYING...' : 'RETRY NOW'}
                  </button>
                </div>
              </div>
            ) : currentVideo?.captionStatus === 'NO_CAPTIONS' ? (
              /* 2. No captions available state */
              <div className="py-8 px-4 text-center space-y-2">
                <p className="font-mono text-xs text-ash uppercase tracking-wider">
                  NO TRANSCRIPT AVAILABLE
                </p>
                <p className="font-sans text-xs text-bone leading-relaxed">
                  Captions are unavailable from transcript providers for this video.
                </p>
                <div className="pt-2">
                  <span className="font-mono text-[10px] text-lime border border-lime/30 px-2 py-1 uppercase rounded-sm inline-block">
                    VOICE QUERY & SEARCH FALLBACK ACTIVE
                  </span>
                </div>
              </div>
            ) : !isInitialized ? (
              /* 3. Watch gate threshold state */
              <div className="py-8 px-4 text-center space-y-2">
                <span className="w-2 h-2 rounded-full bg-lime inline-block animate-ping" />
                <p className="font-mono text-xs text-bone uppercase">
                  INITIALIZING VIDEO TRANSCRIPT
                </p>
                <p className="font-mono text-[10px] text-ash">
                  Active watch gate requires ≥ 2.0s of continuous playback to preserve API quotas.
                </p>
              </div>
            ) : windows.length === 0 ? (
              /* 4. Windows empty state */
              <div className="py-8 px-4 text-center space-y-1">
                <p className="font-mono text-xs text-ash uppercase">
                  NO TRANSCRIPT WINDOWS AVAILABLE
                </p>
                <p className="font-sans text-xs text-bone">
                  This video has not yet completed window indexing.
                </p>
              </div>
            ) : loading && !activeWindowData ? (
              /* 5. Loading skeleton */
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 border border-charcoal/50 bg-black/40 animate-pulse rounded-sm">
                    <div className="h-3 bg-charcoal rounded w-3/4 mb-1" />
                    <div className="h-2 bg-charcoal/60 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : !activeWindowData || activeWindowData.questions.length === 0 ? (
              /* 6. Way predictions unavailable (Tier C or degraded) */
              <div className="py-8 px-4 text-center space-y-2">
                <p className="font-mono text-xs text-bone uppercase tracking-wider">
                  WAY PREDICTIONS UNAVAILABLE
                </p>
                <p className="font-sans text-xs text-ash leading-relaxed">
                  {activeWindowData?.reason ||
                    (currentVideo?.language && !currentVideo.language.startsWith('en')
                      ? `Question predictions unavailable for ${currentVideo.language.toUpperCase()} without language model.`
                      : 'Evon and Workers AI are currently unavailable for dynamic synthesis.')}
                </p>
                <div className="pt-2">
                  <span className="font-mono text-[10px] text-lime border border-lime/30 px-2 py-1 uppercase rounded-sm inline-block">
                    CORE RETRIEVAL & VOICE QUERY FULLY ACTIVE
                  </span>
                </div>
                <p className="font-mono text-[10px] text-ash pt-1">
                  Hold the button below or type to search and jump to any answer.
                </p>
              </div>
            ) : (
              /* 7. Valid questions list with clear wrapping (no truncation) */
              activeWindowData.questions.map((q, idx) => {
                const isTriggered = currentTime >= q.triggerSec;
                return (
                  <button
                    key={q.id || idx}
                    onClick={() => handleQuestionClick(q)}
                    className={`w-full text-left p-3 border transition-all rounded-sm flex items-start justify-between gap-3 group focus:outline-none ${
                      isTriggered
                        ? 'border-charcoal bg-black hover:border-bone hover:bg-[rgba(77,255,0,0.04)] text-parchment'
                        : 'border-transparent bg-black/40 text-ash opacity-60 hover:opacity-100 hover:border-charcoal'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="font-mono text-[11px] text-ash pt-0.5 group-hover:text-petal shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span
                        className="font-sans font-medium text-parchment group-hover:text-white transition-colors text-sm leading-snug break-words flex-1"
                        title={q.questionText}
                      >
                        {q.questionText}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-ash shrink-0 pt-0.5 group-hover:text-parchment">
                      →
                    </span>
                  </button>
                );
              })
            )}
          </>
        )}

        {activeTab === 'STACK' && (
          <div className="space-y-3 py-2 font-mono text-xs">
            <p className="text-ash uppercase text-[10px] tracking-wider">
              IN-MEMORY LIFO CALL STACK (CRASH-RESILIENT)
            </p>
            {usePlaybackStore.getState().callStack.length === 0 ? (
              <p className="text-bone text-xs">No active exploration branches. Currently at origin.</p>
            ) : (
              usePlaybackStore.getState().callStack.map((entry, index) => (
                <div key={entry.id} className="p-2 border border-charcoal bg-black space-y-1">
                  <div className="flex justify-between text-ash text-[10px]">
                    <span>BRANCH #{index + 1}</span>
                    <span>RETURN: {Math.floor(entry.returnTimestamp)}s</span>
                  </div>
                  <p className="text-parchment text-xs">"{entry.branchQuestionText}"</p>
                  <p className="text-bone text-[11px]">→ {entry.answerClip.breadcrumbSummary}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
