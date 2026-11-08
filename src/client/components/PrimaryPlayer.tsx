import React, { useEffect, useRef } from 'react';
import { usePlaybackStore } from '../stores/playbackStore';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PrimaryPlayerProps {
  onVideoInitSuccess?: (windowsCount: number) => void;
}

export const PrimaryPlayer: React.FC<PrimaryPlayerProps> = ({ onVideoInitSuccess }) => {
  const {
    currentVideo,
    updatePlayhead,
    accumulateWatchTime,
    activeWatchedSeconds,
    isInitialized,
    setIsInitialized,
    setPlayerRef,
  } = usePlaybackStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentVideo) return;

    // Load YouTube IFrame Player API if not already present
    const loadApi = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        const existingScript = document.getElementById('youtube-iframe-api');
        if (!existingScript) {
          const tag = document.createElement('script');
          tag.id = 'youtube-iframe-api';
          tag.src = 'https://www.youtube.com/iframe_api';
          document.body.appendChild(tag);
        }
        window.onYouTubeIframeAPIReady = () => {
          initPlayer();
        };
      }
    };

    const initPlayer = () => {
      if (!containerRef.current) return;

      // Clean up prior player instance
      if (playerInstanceRef.current && typeof playerInstanceRef.current.destroy === 'function') {
        playerInstanceRef.current.destroy();
      }

      playerInstanceRef.current = new window.YT.Player(containerRef.current, {
        videoId: currentVideo.videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            setPlayerRef(event.target);
            startPolling(event.target);
          },
          onStateChange: (event: any) => {
            const isPlaying = event.data === window.YT.PlayerState.PLAYING;
            const currentTime = event.target.getCurrentTime ? event.target.getCurrentTime() : 0;
            updatePlayhead(currentTime, isPlaying);

            if (isPlaying) {
              startPolling(event.target);
            } else {
              stopPolling();
            }
          },
        },
      });
    };

    const startPolling = (player: any) => {
      stopPolling();
      pollIntervalRef.current = window.setInterval(async () => {
        if (!player || typeof player.getCurrentTime !== 'function') return;
        const time = player.getCurrentTime();
        const playerState = player.getPlayerState ? player.getPlayerState() : -1;
        const isPlaying = playerState === window.YT.PlayerState.PLAYING;

        updatePlayhead(time, isPlaying);

        // 2-Second Rule Accumulation
        if (isPlaying && !usePlaybackStore.getState().isInitialized) {
          accumulateWatchTime(0.2);
          const accumulated = usePlaybackStore.getState().activeWatchedSeconds;

          if (accumulated >= 2.0) {
            setIsInitialized(true);
            try {
              const res = await fetch(`/api/videos/${currentVideo.videoId}/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  watchedSeconds: accumulated,
                  currentPlayheadSec: time,
                  language: currentVideo.captionStatus === 'READY' ? 'en' : 'en',
                  title: currentVideo.title,
                  channelTitle: currentVideo.channelTitle,
                  durationSec: currentVideo.durationSec,
                }),
              });

              if (res.ok) {
                const data = await res.json() as any;
                if (onVideoInitSuccess) {
                  onVideoInitSuccess(data.windowCount || 0);
                }
              }
            } catch (err) {
              console.warn('[PrimaryPlayer] Failed to initialize video transcript:', err);
            }
          }
        }
      }, 200);
    };

    const stopPolling = () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    loadApi();

    return () => {
      stopPolling();
      if (playerInstanceRef.current && typeof playerInstanceRef.current.destroy === 'function') {
        playerInstanceRef.current.destroy();
      }
    };
  }, [currentVideo?.videoId]);

  if (!currentVideo) {
    return (
      <div className="aspect-video w-full bg-obsidian border border-charcoal flex flex-col items-center justify-center p-6 text-center">
        <p className="font-mono text-xs text-ash tracking-wide uppercase">
          NO VIDEO LOADED · SELECT A PODCAST OR PASTE YOUTUBE URL
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black overflow-hidden border border-charcoal">
      <div ref={containerRef} className="w-full h-full" />

      {/* 2-Second Watch Confirmation Progress Bar (Fades out once initialized) */}
      {!isInitialized && (
        <div className="absolute top-0 left-0 w-full h-[2px] bg-charcoal z-10">
          <div
            className="h-full bg-petal transition-all duration-200"
            style={{ width: `${Math.min(100, (activeWatchedSeconds / 2.0) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
