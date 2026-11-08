import React, { useEffect, useRef } from 'react';
import { usePlaybackStore } from '../stores/playbackStore';

export const PiPPlayer: React.FC = () => {
  const { isPipActive, pipVideo, activeAnswerClip, setPipPlayerRef, closePip, popBranch } =
    usePlaybackStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!isPipActive || !pipVideo) return;

    const initPipPlayer = () => {
      if (!containerRef.current || !window.YT || !window.YT.Player) return;

      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: pipVideo.videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          start: Math.floor(pipVideo.startSec),
          end: Math.ceil(pipVideo.endSec),
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setPipPlayerRef(event.target);
            if (typeof event.target.seekTo === 'function') {
              event.target.seekTo(pipVideo.startSec, true);
            }
          },
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              popBranch();
            }
          },
        },
      });
    };

    initPipPlayer();

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
    };
  }, [isPipActive, pipVideo?.videoId]);

  if (!isPipActive || !pipVideo) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 w-[340px] sm:w-[400px] border border-charcoal bg-black shadow-2xl">
      {/* Header Bar */}
      <div className="h-8 bg-black border-b border-charcoal px-3 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="w-1.5 h-1.5 rounded-full bg-petal" />
          <span className="font-mono text-[10px] text-parchment tracking-tight uppercase truncate">
            EXTERNAL CLIP · {activeAnswerClip?.channelTitle || 'CROSS-PODCAST'}
          </span>
        </div>
        <button
          onClick={() => {
            closePip();
            popBranch();
          }}
          className="font-mono text-xs text-ash hover:text-petal px-1 focus:outline-none"
          title="Close and return to original video"
        >
          ✕
        </button>
      </div>

      {/* 16:9 Video Canvas (Sized >= 200x200px for YouTube TOS Compliance) */}
      <div className="aspect-video w-full bg-obsidian">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Breadcrumb Summary Strip */}
      {activeAnswerClip?.breadcrumbSummary && (
        <div className="p-2 border-t border-charcoal bg-black text-[11px] font-mono text-bone leading-tight">
          {activeAnswerClip.breadcrumbSummary}
        </div>
      )}
    </div>
  );
};

