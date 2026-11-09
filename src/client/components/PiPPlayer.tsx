import React, { useEffect, useRef, useState } from 'react';
import { usePlaybackStore } from '../stores/playbackStore';

export const PiPPlayer: React.FC = () => {
  const { isPipActive, pipVideo, activeAnswerClip, setPipPlayerRef, closePip, popBranch } =
    usePlaybackStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

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

  // Drag listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: dragStartRef.current.initX + dx,
        y: dragStartRef.current.initY + dy,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click and not clicking buttons
    if (e.button !== 0 || (e.target as HTMLElement).tagName === 'BUTTON') return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
  };

  if (!isPipActive || !pipVideo) return null;

  return (
    <div
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      className={`
        z-30 border border-charcoal bg-black shadow-2xl transition-shadow
        /* Mobile: sits cleanly below main player */
        w-full mt-3 block
        /* Desktop: docks over lower-right of main player area, never covering Way panel */
        lg:absolute lg:bottom-4 lg:right-4 lg:mt-0 lg:w-[340px] xl:w-[380px]
      `}
    >
      {/* Draggable Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="h-8 bg-obsidian border-b border-charcoal px-3 flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="w-1.5 h-1.5 rounded-full bg-petal" />
          <span className="font-mono text-[10px] text-parchment tracking-tight uppercase truncate">
            {activeAnswerClip?.channelTitle || 'EXTERNAL CLIP'} · {isCollapsed ? 'MINIMIZED' : 'DOCKED'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Collapse / Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="font-mono text-[11px] text-ash hover:text-white px-1.5 py-0.5 focus:outline-none"
            title={isCollapsed ? 'Expand small player' : 'Collapse small player'}
          >
            {isCollapsed ? '[+]' : '[-]'}
          </button>
          {/* Close / Return to Origin */}
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
      </div>

      {/* Video Content Canvas (Shown when expanded; sized >= 200x200px for YouTube TOS compliance) */}
      <div className={isCollapsed ? 'hidden' : 'block'}>
        <div className="aspect-video w-full bg-black min-h-[190px]">
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Honest Breadcrumb Summary */}
        {activeAnswerClip?.breadcrumbSummary && (
          <div className="p-2 border-t border-charcoal bg-black text-[11px] font-mono text-bone leading-tight">
            {activeAnswerClip.breadcrumbSummary}
          </div>
        )}
      </div>
    </div>
  );
};
