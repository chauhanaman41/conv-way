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
import { usePlaybackStore, VideoMetadata } from './stores/playbackStore';
import { useSettingsStore } from './stores/settingsStore';

export const App: React.FC = () => {
  const { currentVideo, setCurrentVideo, currentTime, pushBranch } = usePlaybackStore();
  const { uiLanguage, timbreTtsOptIn } = useSettingsStore();

  const [isLoadingQuery, setIsLoadingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [aiFallbackData, setAiFallbackData] = useState<AiFallbackData | null>(null);

  const handleSelectVideo = (video: VideoMetadata) => {
    setCurrentVideo(video);
  };

  const handleReturnToHome = () => {
    // Setting currentVideo to null returns to Discovery view
    (usePlaybackStore.setState as any)({ currentVideo: null });
  };

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

      if (res.ok && data.ok) {
        if (data.resolutionType === 'IN_VIDEO_SEGMENT' && data.answerClip) {
          pushBranch(questionText, data.answerClip);
        } else if (data.resolutionType === 'AI_VERIFIED_FALLBACK' && data.aiFallback) {
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
          /* Home Discovery View */
          <HomeView onSelectVideo={handleSelectVideo} />
        ) : (
          /* Watch / Exploration Workspace */
          <div className="flex-1 flex flex-col max-w-[1400px] w-full mx-auto">
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
              <div className="flex-1 flex flex-col p-3 sm:p-4 space-y-3">
                <PrimaryPlayer />

                {/* Video Info Strip */}
                <div className="space-y-1">
                  <h2 className="font-sans font-bold text-base sm:text-lg text-parchment leading-tight">
                    {currentVideo.title}
                  </h2>
                  <div className="flex items-center gap-3 font-mono text-xs text-bone">
                    <span>{currentVideo.channelTitle}</span>
                    <span>·</span>
                    <span className="text-lime">
                      ● {currentVideo.captionStatus === 'READY' ? 'CAPTIONS VERIFIED' : currentVideo.captionStatus}
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

      {/* External Video PiP Player (YouTube TOS Compliant >= 200x200px) */}
      <PiPPlayer />

      {/* End-Of-Clip Hand-Back Decision Bar */}
      <HandBackBar
        onDiveDeeper={() => {
          const top = usePlaybackStore.getState().callStack.slice(-1)[0];
          if (top) {
            handleAskQuery(`Tell me more details about ${top.answerClip.breadcrumbSummary}`);
          }
        }}
        onAskAnother={() => {
          // Triggers question prompt
        }}
      />

      {/* AI Grounded Fallback Answer Card */}
      {aiFallbackData && (
        <AiFallbackCard
          data={aiFallbackData}
          onDismiss={() => setAiFallbackData(null)}
        />
      )}
    </div>
  );
};
