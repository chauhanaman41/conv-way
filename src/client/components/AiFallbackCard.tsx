import React, { useState } from 'react';

export interface AiCitation {
  title: string;
  url: string;
  domain?: string;
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
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-black border border-charcoal p-6 space-y-5">
        {/* Verification Badge */}
        <div className="flex items-center justify-between border-b border-charcoal pb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] px-2 py-0.5 bg-petal text-black font-bold uppercase rounded-sm">
              AI VERIFIED FALLBACK
            </span>
            <span className="font-mono text-[11px] text-ash">
              {data.wordCount} WORDS
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="text-ash hover:text-parchment font-mono text-xs focus:outline-none"
          >
            ✕
          </button>
        </div>

        {/* Fallback Reason / Grounding Note */}
        <p className="font-mono text-xs text-bone italic">
          "{data.reason}"
        </p>

        {/* Synthesized Grounded Answer */}
        <div className="p-4 border border-charcoal bg-black/40">
          <p className="font-sans text-sm sm:text-base text-parchment leading-relaxed font-medium">
            {data.answerText}
          </p>
        </div>

        {/* Real Source Citations */}
        {data.citations && data.citations.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="font-mono text-[10px] uppercase text-ash tracking-wider block">
              VERIFIED SOURCES
            </span>
            <div className="flex flex-col gap-1.5">
              {data.citations.map((cite, i) => (
                <a
                  key={i}
                  href={cite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-petal hover:underline truncate flex items-center gap-1.5"
                >
                  <span>↗</span>
                  <span className="truncate">{cite.title || cite.url}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-charcoal">
          {data.ttsAudioBase64 ? (
            <button
              onClick={handlePlayAudio}
              disabled={isPlayingAudio}
              className="px-3 py-2 border border-charcoal font-mono text-xs text-parchment hover:border-bone rounded-sm flex items-center gap-2 focus:outline-none"
            >
              <span>{isPlayingAudio ? '🔊 PLAYING...' : '▶ LISTEN (TIMBRE)'}</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onDismiss}
            className="px-5 py-2.5 rounded-full bg-petal text-black font-mono text-xs font-semibold hover:bg-[#ffbdf9] transition-colors focus:outline-none"
          >
            RETURN TO VIDEO
          </button>
        </div>
      </div>
    </div>
  );
};

