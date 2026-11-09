import React, { useState, useEffect, useRef } from 'react';

export interface AiCitation {
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
}

export interface AiFallbackData {
  isAiLabeled: boolean;
  reason: string;
  answerText: string;
  wordCount: number;
  citations: AiCitation[];
  isContradicted?: boolean;
  ttsAudioBase64?: string | null;
}

interface AiFallbackCardProps {
  data: AiFallbackData;
  onDismiss: () => void;
}

export const AiFallbackCard: React.FC<AiFallbackCardProps> = ({ data, onDismiss }) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation: Escape to dismiss & focus trap
  useEffect(() => {
    // Initial focus on close button
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }

      if (e.key === 'Tab' && cardRef.current) {
        const focusable = cardRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const handlePlayAudio = () => {
    if (!data.ttsAudioBase64) return;
    try {
      const audio = new Audio(`data:audio/wav;base64,${data.ttsAudioBase64}`);
      setIsPlayingAudio(true);
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play();
    } catch {
      setIsPlayingAudio(false);
    }
  };

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="true"
      aria-label="Verified Answer"
      className={`
        bg-black border border-charcoal shadow-2xl p-4
        /* Mobile (390px): bottom sheet with handle */
        fixed inset-x-0 bottom-0 z-50 rounded-t-xl sm:rounded-none
        /* Desktop: docked bottom-right of player area, max-w-[360px], never covers Way panel */
        lg:absolute lg:bottom-4 lg:right-4 lg:inset-auto lg:z-40 lg:w-[360px] lg:rounded-sm
      `}
    >
      {/* Mobile Top Drag / Close Handle */}
      <div
        onClick={onDismiss}
        className="w-10 h-1 bg-charcoal rounded-full mx-auto mb-2 cursor-pointer hover:bg-ash transition-colors lg:hidden"
        title="Tap to dismiss"
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-charcoal/80 pb-2 mb-2.5">
        <div className="flex items-center gap-2">
          {data.isAiLabeled ? (
            <span className="font-mono text-[10px] px-2 py-0.5 bg-petal text-black font-bold uppercase rounded-sm">
              AI SYNTHESIS
            </span>
          ) : (
            <span className="font-mono text-[10px] px-2 py-0.5 bg-lime text-black font-bold uppercase rounded-sm">
              VERIFIED SOURCES
            </span>
          )}
          {data.wordCount > 0 && (
            <span className="font-mono text-[10px] text-ash tracking-wide" data-testid="word-count-badge">
              {data.wordCount} words
            </span>
          )}
        </div>

        <button
          ref={closeBtnRef}
          onClick={onDismiss}
          className="text-ash hover:text-petal font-mono text-xs px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-petal rounded"
          aria-label="Close"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Grounding Reason Strip */}
      <p className="font-mono text-[11px] text-bone/90 mb-2 truncate" title={data.reason}>
        {data.reason}
      </p>

      {/* Cleaned Answer / Summary Text - Strictly 20-30 words (no-model) or 30-40 words (AI); No Scroll Required */}
      {data.answerText && (
        <div className="p-2.5 border border-charcoal/60 bg-obsidian rounded-sm mb-2.5">
          <p className="font-sans text-xs sm:text-sm text-parchment leading-relaxed font-normal">
            {data.answerText}
          </p>
        </div>
      )}

      {/* Source Links (1 or 2 citations, clean domain pills) */}
      {data.citations && data.citations.length > 0 && (
        <div className="space-y-1.5 mb-2.5">
          {data.citations.slice(0, 2).map((cite, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] font-mono gap-2">
              <a
                href={cite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-petal hover:underline truncate flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-petal"
              >
                <span>↗</span>
                <span className="truncate">{cite.title || cite.url}</span>
              </a>
              {cite.domain && (
                <span className="text-[9px] text-ash bg-charcoal/60 px-1.5 py-0.2 rounded shrink-0">
                  {cite.domain}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action Strip */}
      <div className="flex items-center justify-between pt-2 border-t border-charcoal/60">
        {data.ttsAudioBase64 ? (
          <button
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            className="px-2.5 py-1 border border-charcoal font-mono text-[11px] text-parchment hover:border-petal rounded-sm flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-petal"
          >
            <span>{isPlayingAudio ? '🔊 PLAYING...' : '▶ LISTEN'}</span>
          </button>
        ) : (
          <span className="font-mono text-[10px] text-ash">VIDEO PAUSED</span>
        )}

        <button
          onClick={onDismiss}
          className="px-3 py-1 bg-parchment text-black font-mono text-xs font-semibold hover:bg-bone rounded-sm focus:outline-none focus:ring-1 focus:ring-petal"
        >
          DISMISS
        </button>
      </div>
    </div>
  );
};
