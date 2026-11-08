import React, { useEffect, useState, useRef } from 'react';
import { usePlaybackStore, AnswerClip } from '../stores/playbackStore';
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
}

export const WayPanel: React.FC = () => {
  const { currentVideo, currentTime, isInitialized, pushBranch } = usePlaybackStore();
  const { uiLanguage, dataSaverMode } = useSettingsStore();

  const [activeWindow, setActiveWindow] = useState<WindowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'WAY' | 'STACK' | 'ABOUT'>('WAY');

  const seekTimeoutRef = useRef<number | null>(null);
  const lastFetchedWindowRef = useRef<number>(-1);
  const prefetchWindowRef = useRef<number>(-1);

  // Approximate window index based on playhead time (~150s per window)
  const currentApproxWindow = Math.floor(currentTime / 150);

  // Fetch questions for a window
  const fetchWindowQuestions = async (winIndex: number) => {
    if (!currentVideo || !isInitialized) return;
    setLoading(true);

    try {
      const mode = dataSaverMode ? 'titles' : 'full';
      const res = await fetch(
        `/api/videos/${currentVideo.videoId}/way?windowIndex=${winIndex}&lang=${uiLanguage}&mode=${mode}`
      );
      if (res.ok) {
        const data = await res.json() as any;
        setActiveWindow({
          windowIndex: data.windowIndex,
          startSec: data.startSec,
          endSec: data.endSec,
          questions: data.questions || [],
        });
        lastFetchedWindowRef.current = winIndex;
      }
    } catch (e) {
      console.warn('[WayPanel] Error fetching Way questions:', e);
    } finally {
      setLoading(false);
    }
  };

  // Seek debounce and progressive prefetch effect
  useEffect(() => {
    if (!currentVideo || !isInitialized) return;

    // Check if window changed
    if (currentApproxWindow !== lastFetchedWindowRef.current) {
      // 3.5s seek debounce before committing to new window fetch
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = window.setTimeout(() => {
        fetchWindowQuestions(currentApproxWindow);
      }, 500); // 500ms for smooth initial load, debounces continuous scrubbing
    }

    // 75% Window Prefetch
    if (activeWindow) {
      const windowSpan = activeWindow.endSec - activeWindow.startSec;
      if (
        windowSpan > 0 &&
        currentTime >= activeWindow.startSec + 0.75 * windowSpan &&
        prefetchWindowRef.current !== activeWindow.windowIndex + 1
      ) {
        prefetchWindowRef.current = activeWindow.windowIndex + 1;
        fetch(
          `/api/videos/${currentVideo.videoId}/way?windowIndex=${activeWindow.windowIndex + 1}&lang=${uiLanguage}&mode=full`
        ).catch(() => {});
      }
    }

    return () => {
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    };
  }, [currentVideo?.videoId, currentApproxWindow, isInitialized]);

  const handleQuestionClick = (q: WayQuestionItem) => {
    if (!q.answer) {
      // If titles mode or missing, fetch full question
      fetch(`/api/videos/${currentVideo?.videoId}/way/${q.id}`)
        .then((r) => r.json())
        .then((data: any) => {
          if (data.ok && data.question?.answer) {
            pushBranch(q.questionText, data.question.answer);
          }
        })
        .catch(() => {});
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
            WAY // WINDOW {activeWindow ? String(activeWindow.windowIndex).padStart(2, '0') : '00'}
          </button>
          <button
            onClick={() => setActiveTab('STACK')}
            className={`font-mono text-xs tracking-wider uppercase transition-colors ${
              activeTab === 'STACK'
                ? 'text-parchment font-semibold border-b-2 border-petal py-2.5 -mb-[1px]'
                : 'text-ash hover:text-bone'
            }`}
          >
            STACK
          </button>
        </div>

        {loading && (
          <span className="font-mono text-[10px] text-ash animate-pulse uppercase">
            SYNCING...
          </span>
        )}
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'WAY' && (
          <>
            {!isInitialized ? (
              <div className="py-8 px-4 text-center space-y-2">
                <span className="w-2 h-2 rounded-full bg-lime inline-block animate-ping" />
                <p className="font-mono text-xs text-bone">
                  PLAYING VIDEO TO INITIALIZE TRANSCRIPT
                </p>
                <p className="font-mono text-[10px] text-ash">
                  Active watch gate requires ≥ 2.0s of continuous playback to preserve API quotas.
                </p>
              </div>
            ) : !activeWindow || activeWindow.questions.length === 0 ? (
              <div className="py-8 px-4 text-center space-y-1">
                <p className="font-mono text-xs text-ash uppercase">
                  NO PREPARED QUESTIONS FOR THIS SEGMENT
                </p>
                <p className="font-mono text-[11px] text-bone">
                  Press and hold the pink button below to ask any custom question.
                </p>
              </div>
            ) : (
              activeWindow.questions.map((q, idx) => {
                const isTriggered = currentTime >= q.triggerSec;
                return (
                  <button
                    key={q.id || idx}
                    onClick={() => handleQuestionClick(q)}
                    className={`w-full text-left p-3 border transition-all text-sm leading-snug rounded-sm flex items-start justify-between gap-3 group focus:outline-none ${
                      isTriggered
                        ? 'border-charcoal bg-black hover:border-bone hover:bg-[rgba(77,255,0,0.04)] text-parchment'
                        : 'border-transparent bg-black/40 text-ash opacity-60 hover:opacity-100 hover:border-charcoal'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-[11px] text-ash pt-0.5 group-hover:text-petal">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="font-sans font-medium text-parchment group-hover:text-white transition-colors">
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

