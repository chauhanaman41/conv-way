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

interface HandBackBarProps {
  onDiveDeeper: () => void;
  onAskAnother: () => void;
}

export const HandBackBar: React.FC<HandBackBarProps> = ({ onDiveDeeper, onAskAnother }) => {
  const { activeHandBack, popBranch, dismissHandBack } = usePlaybackStore();

  if (!activeHandBack.isShowing) return null;

  const handleContinue = () => {
    dismissHandBack();
    popBranch();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-black border border-charcoal p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-charcoal pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-petal" />
            <span className="font-mono text-xs uppercase tracking-wider text-parchment font-semibold">
              ANSWER SEGMENT CONCLUDED
            </span>
          </div>
          <span className="font-mono text-xs text-bone">
            SAVED AT [{formatTimestamp(activeHandBack.returnTimestamp)}]
          </span>
        </div>

        {/* Question & Clarification Readout */}
        <div className="space-y-2">
          <p className="font-sans text-sm text-parchment font-medium">
            "{activeHandBack.questionText}"
          </p>
          <p className="font-sans text-xs text-bone leading-relaxed">
            {activeHandBack.clarificationPrompt ||
              'You have watched the answering segment. Would you like to return to your original video, or dive deeper into this topic?'}
          </p>
        </div>

        {/* 3 Decision Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* Primary Action: CONTINUE ORIGINAL VIDEO */}
          <button
            onClick={handleContinue}
            className="flex-1 py-3 px-4 rounded-full bg-petal text-black font-mono text-xs font-semibold uppercase hover:bg-[#ffbdf9] transition-colors focus:outline-none"
          >
            CONTINUE VIDEO [{formatTimestamp(activeHandBack.returnTimestamp)}]
          </button>

          {/* Secondary Action: DIVE DEEPER */}
          <button
            onClick={() => {
              dismissHandBack();
              onDiveDeeper();
            }}
            className="py-3 px-4 rounded-full border border-bone text-parchment font-mono text-xs hover:border-petal hover:text-petal transition-colors focus:outline-none"
          >
            DIVE DEEPER
          </button>

          {/* Tertiary Action: ASK ANOTHER */}
          <button
            onClick={() => {
              dismissHandBack();
              onAskAnother();
            }}
            className="py-3 px-4 text-ash hover:text-parchment font-mono text-xs transition-colors focus:outline-none"
          >
            ASK ANOTHER
          </button>
        </div>
      </div>
    </div>
  );
};
