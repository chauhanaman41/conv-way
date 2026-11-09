import React, { useState, useEffect } from 'react';
import { usePlaybackStore } from '../stores/playbackStore';

export interface DebugTelemetry {
  intent?: string;
  rewrittenQuery?: string;
  routeTaken?: string;
  searchScores?: Array<{ rank: number; score?: number; coverage?: number; label?: string }>;
  chosenSegment?: { videoId: string; startSec: number; endSec: number };
  providerAnswered?: string;
  llmHealth?: {
    provider: string;
    status: string;
    modelId?: string;
    neuronsUsedToday?: number;
    lastError?: string;
    verifiedEndpoint?: boolean;
  };
  creditsQuota?: {
    dailyCapRemainingPct?: number;
    stepDownLevel: string;
    creditsUsedToday?: number;
  };
}

interface DebugDrawerProps {
  telemetry: DebugTelemetry | null;
}

function formatTime(sec?: number): string {
  if (sec === undefined || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const DebugDrawer: React.FC<DebugDrawerProps> = ({ telemetry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasDebugParam, setHasDebugParam] = useState(false);
  const currentVideo = usePlaybackStore((s) => s.currentVideo);
  const windows = usePlaybackStore((s) => s.windows);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === '1') {
        setHasDebugParam(true);
      }
    }
  }, []);

  if (!hasDebugParam) return null;

  return (
    <div className="fixed bottom-0 right-0 z-50 max-w-lg w-full bg-black/95 border-t border-l border-petal/70 font-mono text-xs shadow-2xl text-parchment">
      {/* Header Bar / Collapse Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 bg-charcoal/80 flex items-center justify-between cursor-pointer border-b border-charcoal hover:bg-charcoal"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-petal animate-pulse" />
          <span className="font-bold text-petal tracking-wider uppercase">
            DEBUG DRAWER [?debug=1]
          </span>
          {telemetry?.routeTaken && (
            <span className="px-1.5 py-0.2 bg-black border border-petal/40 text-[10px] text-lime">
              {telemetry.routeTaken}
            </span>
          )}
        </div>
        <button className="text-ash hover:text-white font-mono text-xs">
          {isOpen ? '▼ HIDE' : '▲ SHOW'}
        </button>
      </div>

      {isOpen && (
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {/* Current Video Database / KV State */}
          <div className="border-b border-charcoal/60 pb-2">
            <div className="text-[10px] text-ash uppercase font-bold mb-1">CURRENT VIDEO STATE</div>
            {currentVideo ? (
              <div className="grid grid-cols-2 gap-1 text-[11px] bg-black/50 p-2 border border-charcoal/50">
                <div>ID: <span className="text-bone">{currentVideo.videoId}</span></div>
                <div>Status: <span className={currentVideo.captionStatus === 'READY' ? 'text-lime' : 'text-petal'}>{currentVideo.captionStatus}</span></div>
                <div>Language: <span className="text-bone">{(currentVideo.language || 'en').toUpperCase()}</span></div>
                <div>Windows: <span className="text-lime">{windows.length} (D1: {currentVideo.windowCount})</span></div>
                <div>Provider: <span className="text-bone">{currentVideo.transcriptProvider || 'NONE'}</span></div>
                {currentVideo.retryAfter && (
                  <div className="col-span-2 text-petal text-[10px]">Resets: {currentVideo.retryAfter}</div>
                )}
              </div>
            ) : (
              <div className="text-ash italic">No video loaded</div>
            )}
          </div>

          {!telemetry ? (
            <div className="text-ash italic">
              No query executed yet. Ask a question or trigger a predicted Way question to inspect real-time routing telemetry.
            </div>
          ) : (
            <>
              {/* Intent & Query */}
              <div className="grid grid-cols-2 gap-2 border-b border-charcoal/60 pb-2">
                <div>
                  <div className="text-[10px] text-ash uppercase">Detected Intent</div>
                  <div className="font-bold text-petal">{telemetry.intent || 'UNKNOWN'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ash uppercase">Route Taken</div>
                  <div className="font-bold text-lime">{telemetry.routeTaken || 'UNKNOWN'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-ash uppercase">Rewritten Query</div>
                  <div className="text-parchment break-words bg-black/50 p-1 border border-charcoal rounded-sm">
                    {telemetry.rewrittenQuery || '(none)'}
                  </div>
                </div>
              </div>

              {/* Chosen Segment */}
              <div className="border-b border-charcoal/60 pb-2">
                <div className="text-[10px] text-ash uppercase">Chosen Segment</div>
                {telemetry.chosenSegment ? (
                  <div className="flex items-center justify-between text-bone pt-1">
                    <span>Video: <span className="text-parchment">{telemetry.chosenSegment.videoId}</span></span>
                    <span>Range: <span className="text-lime">{formatTime(telemetry.chosenSegment.startSec)}</span> → <span className="text-lime">{formatTime(telemetry.chosenSegment.endSec)}</span></span>
                  </div>
                ) : (
                  <div className="text-ash italic">No segment chosen (Fallback / Unresolved)</div>
                )}
              </div>

              {/* Search Scores */}
              {telemetry.searchScores && telemetry.searchScores.length > 0 && (
                <div className="border-b border-charcoal/60 pb-2">
                  <div className="text-[10px] text-ash uppercase mb-1">Search Candidates & Scores</div>
                  <div className="space-y-1">
                    {telemetry.searchScores.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-black/40 px-2 py-0.5 border border-charcoal/40">
                        <span className="truncate max-w-[220px] text-bone">
                          #{s.rank} {s.label || `Result ${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-2">
                          {s.coverage !== undefined && (
                            <span className="text-petal">cov: {Math.round(s.coverage * 100)}%</span>
                          )}
                          {s.score !== undefined && (
                            <span className="text-ash">score: {typeof s.score === 'number' ? s.score.toFixed(2) : s.score}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Provider & Health Status */}
              <div className="grid grid-cols-2 gap-2 border-b border-charcoal/60 pb-2">
                <div>
                  <div className="text-[10px] text-ash uppercase">Provider Answered</div>
                  <div className="text-parchment font-bold">{telemetry.providerAnswered || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ash uppercase">LLM Health</div>
                  <div className={telemetry.llmHealth?.status === 'ONLINE' ? 'text-lime font-bold' : 'text-petal'}>
                    {telemetry.llmHealth?.provider}: {telemetry.llmHealth?.status}
                  </div>
                  {telemetry.llmHealth?.modelId && (
                    <div className="text-[10px] text-bone truncate" title={telemetry.llmHealth.modelId}>
                      Model: {telemetry.llmHealth.modelId}
                    </div>
                  )}
                  {telemetry.llmHealth?.neuronsUsedToday !== undefined && (
                    <div className="text-[10px] text-ash">
                      Neurons: {telemetry.llmHealth.neuronsUsedToday} / 10,000
                    </div>
                  )}
                  {telemetry.llmHealth?.lastError && (
                    <div className="text-[9px] text-ash truncate" title={telemetry.llmHealth.lastError}>
                      {telemetry.llmHealth.lastError}
                    </div>
                  )}
                </div>
              </div>

              {/* Quota & Credits */}
              <div>
                <div className="text-[10px] text-ash uppercase">Credits & Quota Used Today</div>
                <div className="flex items-center justify-between text-bone pt-1">
                  <span>Step-Down: <span className="text-lime">{telemetry.creditsQuota?.stepDownLevel || 'NORMAL'}</span></span>
                  <span>Daily Cap Remaining: <span className="text-parchment">{telemetry.creditsQuota?.dailyCapRemainingPct ?? 100}%</span></span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

