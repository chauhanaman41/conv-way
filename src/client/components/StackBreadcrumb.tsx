import React from 'react';
import { usePlaybackStore } from '../stores/playbackStore';

function formatTimestamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const StackBreadcrumb: React.FC = () => {
  const { currentVideo, currentTime, callStack, returnToRoot, popBranch } = usePlaybackStore();

  if (!currentVideo) return null;

  if (callStack.length === 0) {
    return (
      <div className="w-full py-2 px-1 flex items-center justify-between font-mono text-[11px] text-ash border-b border-charcoal">
        <span className="truncate">ORIGIN · {currentVideo.title}</span>
        <span className="text-bone font-medium">{formatTimestamp(currentTime)}</span>
      </div>
    );
  }

  const topEntry = callStack[callStack.length - 1];

  return (
    <div className="w-full bg-black border-b border-charcoal py-2 px-3 flex flex-wrap items-center justify-between gap-2">
      {/* Return point strip */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 bg-petal text-black font-semibold rounded-sm">
          RETURN POINT
        </span>
        <span className="font-mono text-xs text-parchment font-medium">
          [{formatTimestamp(topEntry.returnTimestamp)}]
        </span>
        <span className="text-ash font-mono text-xs hidden sm:inline">·</span>
        <span className="text-bone font-mono text-xs truncate max-w-[280px] hidden sm:inline">
          "{topEntry.branchQuestionText}"
        </span>
      </div>

      {/* Origin / Return Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={popBranch}
          className="font-mono text-xs text-parchment border border-charcoal px-2.5 py-1 hover:border-bone hover:text-petal transition-colors rounded-sm focus:outline-none"
          title="Return to previous video position"
        >
          ← BACK 1 LEVEL
        </button>
        <button
          onClick={returnToRoot}
          className="font-mono text-xs text-black bg-petal font-medium px-3 py-1 hover:bg-[#ffbdf9] transition-colors rounded-sm focus:outline-none"
          title="Return immediately to root video position"
        >
          ↺ ORIGIN [{formatTimestamp(callStack[0].returnTimestamp)}]
        </button>
      </div>
    </div>
  );
};
