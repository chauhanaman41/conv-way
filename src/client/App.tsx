import React, { useState } from 'react';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { PrimaryPlayer } from './components/PrimaryPlayer';
import { PiPPlayer } from './components/PiPPlayer';
import { StackBreadcrumb } from './components/StackBreadcrumb';
import { WayPanel } from './components/WayPanel';
import { ControlBar } from './components/ControlBar';
import { HandBackBar } from './components/HandBackBar';
import { AiFallbackCard, AiFallbackData } from './components/AiFallbackCard';
import { DebugDrawer, DebugTelemetry } from './components/DebugDrawer';
import { MicGuidanceModal } from './components/MicGuidanceModal';
import { ShowcaseGallery } from './components/showcase/ShowcaseGallery';
import { usePlaybackStore, VideoMetadata } from './stores/playbackStore';
import { useSettingsStore } from './stores/settingsStore';

export const App: React.FC = () => {
  const { currentVideo, setCurrentVideo, currentTime, pushBranch } = usePlaybackStore();
  const { uiLanguage, timbreTtsOptIn } = useSettingsStore();

  const [isLoadingQuery, setIsLoadingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [aiFallbackData, setAiFallbackData] = useState<AiFallbackData | null>(null);
  const [debugTelemetry, setDebugTelemetry] = useState<DebugTelemetry | null>(null);

  const handleSelectVideo = (video: VideoMetadata) => {
    setCurrentVideo(video);
  };

  const handleReturnToHome = () => {
    // Setting currentVideo to null returns to Discovery view
    (usePlaybackStore.setState as any)({ currentVideo: null });
  };

  const scrollToWorkspace = () => {
    const el = document.getElementById('live-workspace');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('v')) {
        scrollToWorkspace();
      }
    }
  }, []);

  const handleAskQuery = async (questionText: string) => {
    if (!currentVideo || isLoadingQuery) return;

    setIsLoadingQuery(true);
    setQueryError(null);

    try {
      const res = await fetch('/api/query/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: currentVideo.videoId,
          currentPlayheadSec: currentTime,
          questionText,
          language: uiLanguage,
          isDiveDeeper: false,
          ttsOptIn: timbreTtsOptIn,
        }),
      });

      const data = await res.json() as any;

      if (data && data.debug) {
        setDebugTelemetry(data.debug);
      }

      if (res.ok && data.ok) {
        if (data.resolutionType === 'IN_VIDEO_SEGMENT' && data.answerClip) {
          pushBranch(questionText, data.answerClip);
        } else if (data.resolutionType === 'AI_VERIFIED_FALLBACK' && data.aiFallback) {
          const { playerRef } = usePlaybackStore.getState();
          if (playerRef && typeof playerRef.pauseVideo === 'function') {
            try {
              playerRef.pauseVideo();
            } catch {}
          }
          setAiFallbackData(data.aiFallback);
        }
      } else {
        const errorMsg =
          data.error?.message ||
          'No verified video segment or grounded web source found for this question.';
        setQueryError(errorMsg);
        setTimeout(() => setQueryError(null), 6000);
      }
    } catch (err) {
      setQueryError('Connection error resolving query. Please try again.');
      setTimeout(() => setQueryError(null), 5000);
    } finally {
      setIsLoadingQuery(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-parchment flex flex-col font-sans selection:bg-petal selection:text-black">
      {/* Universal Minimal Header */}
      <Header onLogoClick={handleReturnToHome} />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {!currentVideo ? (
          <>
            {/* Zone A: The Editorial, Engineering & Construction Exhibition (Sections 00 - 05) */}
            <ShowcaseGallery onLaunchWorkspace={scrollToWorkspace} />

            {/* Zone B: Section 06 // LIVE WORKSPACE */}
            <section id="live-workspace" className="w-full pt-16 sm:pt-24 border-t border-charcoal bg-black">
              <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-charcoal pb-4 gap-2">
                  <div className="font-display text-xl sm:text-3xl text-parchment tracking-tight uppercase flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-lime animate-pulse" />
                    <span>06 // LIVE WORKSPACE</span>
                  </div>
                  <div className="font-display text-base sm:text-xl text-petal tracking-tight uppercase">
                    TRY CONV-WAY NOW // LIVE
                  </div>
                </div>
              </div>
              <HomeView onSelectVideo={handleSelectVideo} />
            </section>
          </>
        ) : (
          /* Watch / Exploration Workspace */
          <div className="flex-1 flex flex-col max-w-[1400px] w-full mx-auto">
            {/* Top Quick Return Banner */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-charcoal text-xs font-mono text-ash">
              <button
                onClick={handleReturnToHome}
                className="text-bone hover:text-petal transition-colors flex items-center gap-1.5 focus:outline-none"
              >
                <span>← RETURN TO GALLERY & ARCHITECTURE SHOWCASE</span>
              </button>
              <span className="text-lime hidden sm:inline">● LIVE SESSION ACTIVE</span>
            </div>

            {/* Exploration Return Breadcrumbs */}
            <StackBreadcrumb />

            {/* Error / Telemetry Toast Banner */}
            {queryError && (
              <div className="bg-charcoal/40 border-b border-petal/60 px-4 py-2 flex items-center justify-between text-xs font-mono text-petal">
                <span>✕ {queryError}</span>
                <button
                  onClick={() => setQueryError(null)}
                  className="text-parchment hover:text-white px-2"
                >
                  DISMISS
                </button>
              </div>
            )}

            {/* Primary Grid Layout: Player (Left 68%) + Way Panel (Right 32%) */}
            <div className="flex-1 flex flex-col lg:flex-row border-b border-charcoal">
              {/* Left Column: Primary Video Player & Title Header */}
              <div className="flex-1 flex flex-col p-3 sm:p-4 space-y-3 relative">
                <div className="relative w-full">
                  <PrimaryPlayer />
                  <PiPPlayer />
                  {aiFallbackData && (
                    <AiFallbackCard
                      data={aiFallbackData}
                      onDismiss={() => setAiFallbackData(null)}
                    />
                  )}
                </div>

                {/* Video Info Strip */}
                <div className="space-y-1">
                  <h2 className="font-sans font-bold text-base sm:text-lg text-parchment leading-tight">
                    {currentVideo.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-bone">
                    <span>{currentVideo.channelTitle}</span>
                    <span>·</span>
                    <span
                      className={
                        currentVideo.captionStatus === 'READY'
                          ? 'text-lime font-mono'
                          : currentVideo.captionStatus === 'PROCESSING'
                          ? 'text-petal font-mono animate-pulse'
                          : 'text-ash font-mono'
                      }
                    >
                      ● {currentVideo.captionStatus === 'READY'
                        ? `${(currentVideo.transcriptProvider || 'TRANSCRIPT').toUpperCase()} · ${(currentVideo.language || 'EN').toUpperCase()} · ${currentVideo.windowCount || 0} WINDOWS`
                        : currentVideo.captionStatus === 'PROCESSING'
                        ? 'INGESTING TRANSCRIPT...'
                        : currentVideo.captionStatus === 'BUDGET_DEFERRED'
                        ? 'NO TRANSCRIPT (DAILY BUDGET DEFERRED)'
                        : currentVideo.captionStatus === 'NO_CAPTIONS'
                        ? 'NO TRANSCRIPT (CAPTIONS UNAVAILABLE)'
                        : 'PENDING WATCH CONFIRMATION (≥ 2.0s)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: The "Way" Panel (Window Questions & LIFO Stack) */}
              <div className="w-full lg:w-[380px] xl:w-[420px] min-h-[380px] flex flex-col">
                <WayPanel />
              </div>
            </div>

            {/* Persistent Control Bar (Hold-To-Speak / Typed Question) */}
            <ControlBar onAskQuery={handleAskQuery} isLoading={isLoadingQuery} />
          </div>
        )}
      </main>

      {/* End-Of-Clip Hand-Back Decision Bar */}
      <HandBackBar
        onDiveDeeper={() => {
          const top = usePlaybackStore.getState().callStack.slice(-1)[0];
          if (top) {
            const summary = top.answerClip?.breadcrumbSummary || '';
            const branchQ = top.branchQuestionText || '';
            let diveTopic = '';
            if (summary && !summary.includes('undefined') && !summary.includes('[object')) {
              diveTopic = summary
                .replace(/^(Jump to direct answer matching:\s*|Answer:\s*|Related video[^\:]*:\s*|Playing external answer from\s*)/i, '')
                .replace(/^"|"$/g, '')
                .trim();
            }
            if (!diveTopic && branchQ) {
              diveTopic = branchQ;
            }
            if (diveTopic) {
              handleAskQuery(`Tell me more details about ${diveTopic}`);
            }
          }
        }}
        onAskAnother={() => {
          // Triggers question prompt
        }}
      />

      {/* Debug Telemetry Drawer (?debug=1) */}
      <DebugDrawer telemetry={debugTelemetry} />

      {/* Viewer Mic Guidance Modal (Once per session) */}
      <MicGuidanceModal />
    </div>
  );
};

