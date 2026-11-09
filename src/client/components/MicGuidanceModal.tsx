import React from 'react';
import { useAudioStore } from '../stores/audioStore';

interface MicGuidanceModalProps {
  isOpen?: boolean;
  onDismiss?: () => void;
}

export const MicGuidanceModal: React.FC<MicGuidanceModalProps> = ({
  isOpen,
  onDismiss,
}) => {
  const storeShow = useAudioStore((s) => s.showGuidanceModal);
  const storeDismiss = useAudioStore((s) => s.dismissGuidance);

  const isVisible = isOpen !== undefined ? isOpen : storeShow;
  const handleDismiss = onDismiss || storeDismiss;

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Microphone Setup Guidance"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-black border border-charcoal max-w-[390px] w-full p-4 sm:p-5 rounded-t-xl sm:rounded-sm shadow-2xl space-y-4">
        {/* Header Strip */}
        <div className="flex items-center justify-between border-b border-charcoal/80 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-petal animate-pulse" />
            <span className="font-mono text-xs font-bold text-petal tracking-wider uppercase">
              PHONE MIC SETUP
            </span>
          </div>
          <span className="font-mono text-[10px] text-bone border border-charcoal px-1.5 py-0.5 rounded-sm">
            ONCE PER SESSION
          </span>
        </div>

        {/* Core Guidance Text */}
        <div className="space-y-2">
          <p className="font-sans text-sm text-parchment font-medium leading-relaxed">
            Turn the video up to medium, hold the phone near the speaker, and stay in a quiet room. Earphones won't work for this.
          </p>
          <div className="p-2 border border-charcoal/60 bg-obsidian rounded-sm">
            <p className="font-mono text-[11px] text-bone">
              ● Captures loudspeaker output directly via built-in microphone.
              <br />
              ● Noise reduction and automatic level leveling are active.
            </p>
          </div>
        </div>

        {/* Dismiss Button */}
        <div className="pt-1">
          <button
            onClick={handleDismiss}
            autoFocus
            className="w-full py-2.5 bg-petal hover:bg-[#ffbdf9] text-black font-mono text-xs font-bold uppercase tracking-wider rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-petal"
          >
            GOT IT // PROCEED
          </button>
        </div>
      </div>
    </div>
  );
};
