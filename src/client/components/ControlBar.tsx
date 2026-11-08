import React, { useState } from 'react';
import { useAudioStore } from '../stores/audioStore';
import { usePlaybackStore } from '../stores/playbackStore';

interface ControlBarProps {
  onAskQuery: (question: string) => Promise<void>;
  isLoading?: boolean;
}

export const ControlBar: React.FC<ControlBarProps> = ({ onAskQuery, isLoading }) => {
  const { status, isAmbientActive, toggleAmbientMode, startPushToTalk, stopPushToTalk } =
    useAudioStore();
  const { callStack, returnToRoot, activeAnswerClip } =
    usePlaybackStore();

  const [textInput, setTextInput] = useState('');
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  const handleHoldStart = async () => {
    await startPushToTalk();
  };

  const handleHoldEnd = async () => {
    const question = await stopPushToTalk();
    if (question && question.trim().length > 3) {
      await onAskQuery(question.trim());
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isLoading) return;
    const q = textInput.trim();
    setTextInput('');
    setIsInputExpanded(false);
    await onAskQuery(q);
  };

  const handleDiveDeeper = async () => {
    if (!activeAnswerClip) return;
    const followUp = `Tell me more details about ${activeAnswerClip.breadcrumbSummary}`;
    await onAskQuery(followUp);
  };

  return (
    <div className="w-full bg-black border-t border-charcoal p-3 flex flex-col items-center justify-center gap-3">
      {/* Typed Question Input (Collapsible) */}
      {isInputExpanded && (
        <form onSubmit={handleTextSubmit} className="w-full max-w-[640px] flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type your question about this video..."
            autoFocus
            className="flex-1 bg-black border border-charcoal px-3 py-2 text-sm text-parchment font-mono placeholder-ash focus:border-petal rounded-sm"
          />
          <button
            type="submit"
            disabled={!textInput.trim() || isLoading}
            className="px-4 py-2 bg-petal text-black font-mono text-xs font-semibold rounded-sm hover:bg-[#ffbdf9] transition-colors disabled:opacity-40"
          >
            ASK
          </button>
          <button
            type="button"
            onClick={() => setIsInputExpanded(false)}
            className="px-2 py-2 text-ash hover:text-parchment font-mono text-xs"
          >
            ✕
          </button>
        </form>
      )}

      {/* Main Action Strip */}
      <div className="w-full max-w-[800px] flex items-center justify-between gap-3">
        {/* Left: Origin or Ambient Toggle */}
        <div className="flex items-center gap-2">
          {callStack.length > 0 ? (
            <button
              onClick={returnToRoot}
              className="h-10 px-3 border border-charcoal text-parchment font-mono text-xs hover:border-bone hover:text-petal transition-colors rounded-sm flex items-center gap-1.5 focus:outline-none"
              title="Return immediately to original video"
            >
              <span>↺</span>
              <span className="hidden sm:inline">ORIGIN</span>
            </button>
          ) : (
            <button
              onClick={toggleAmbientMode}
              className={`h-10 px-3 border font-mono text-xs transition-colors rounded-sm flex items-center gap-2 focus:outline-none ${
                isAmbientActive
                  ? 'border-lime text-lime bg-[rgba(77,255,0,0.06)]'
                  : 'border-charcoal text-bone hover:border-bone'
              }`}
              title="Ambient Voice Detection (VAD) listens for voice triggers hands-free"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isAmbientActive ? 'bg-lime animate-pulse' : 'bg-ash'
                }`}
              />
              <span className="hidden sm:inline">
                {isAmbientActive ? 'AMBIENT ON' : 'AMBIENT VOICE'}
              </span>
            </button>
          )}

          {/* Type Question Button */}
          {!isInputExpanded && (
            <button
              onClick={() => setIsInputExpanded(true)}
              className="h-10 px-3 border border-charcoal text-bone hover:text-parchment hover:border-bone font-mono text-xs rounded-sm transition-colors hidden sm:block focus:outline-none"
            >
              TYPE
            </button>
          )}
        </div>

        {/* Center: The Single Primary Neon Petal Pill CTA */}
        <div className="flex-1 max-w-[320px] flex justify-center">
          <button
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            disabled={isLoading}
            className={`w-full h-12 sm:h-14 rounded-full font-mono text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all shadow-none flex items-center justify-center gap-2 select-none focus:outline-none ${
              status === 'RECORDING'
                ? 'bg-white text-black scale-95 ring-4 ring-petal'
                : isLoading
                ? 'bg-petal/60 text-black cursor-wait'
                : 'bg-petal text-black hover:bg-[#ffbdf9] active:scale-95'
            }`}
          >
            {status === 'RECORDING' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <span>LISTENING... RELEASE TO SEND</span>
              </>
            ) : isLoading ? (
              <span>FINDING ANSWER...</span>
            ) : (
              <>
                <span>HOLD TO SPEAK</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Dive Deeper or Type on Mobile */}
        <div className="flex items-center gap-2">
          {activeAnswerClip ? (
            <button
              onClick={handleDiveDeeper}
              disabled={isLoading}
              className="h-10 px-3 border border-petal text-petal font-mono text-xs hover:bg-petal hover:text-black transition-colors rounded-sm focus:outline-none"
              title="Ask a follow-up question diving deeper into this clip"
            >
              DIVE DEEPER
            </button>
          ) : (
            <button
              onClick={() => setIsInputExpanded(true)}
              className="h-10 px-3 border border-charcoal text-bone hover:text-parchment font-mono text-xs rounded-sm sm:hidden focus:outline-none"
            >
              TYPE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
