import React, { useState } from 'react';

export const Section01Paradox: React.FC = () => {
  // Interactive scrubber step: 0 = origin playing, 1 = detour pushed, 2 = detour finished & popped
  const [scrubberStep, setScrubberStep] = useState<number>(1);

  return (
    <section id="section-01" className="py-20 sm:py-32 border-b border-charcoal/60">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Editorial Section Header Pattern */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-charcoal pb-4 mb-16 sm:mb-24 gap-2">
          <div className="font-display text-xl sm:text-3xl text-parchment tracking-tight uppercase">
            01 // The Paradox
          </div>
          <div className="font-display text-base sm:text-xl text-ash tracking-tight uppercase">
            Problem & Vision
          </div>
        </div>

        {/* Two-Column Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 mb-16 sm:mb-24">
          {/* Left Column: Linear Friction */}
          <div className="p-6 border border-charcoal/70 bg-black/50 space-y-4 rounded-sm">
            <div className="font-mono text-xs text-ash uppercase tracking-wider font-semibold">
              [01] LINEAR FRICTION — OLD WAY
            </div>
            <p className="font-mono text-xs text-ash leading-relaxed">
              Traditional players enforce passive watching. The moment you have a question, the interface punishes you with friction:
            </p>
            <ol className="space-y-2.5 font-mono text-xs text-ash pt-2">
              <li className="flex items-start gap-2">
                <span className="text-petal">01.</span>
                <span>Pause video manually at [00:24:22]</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-petal">02.</span>
                <span>Open a new browser tab & immediately lose visual focus</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-petal">03.</span>
                <span>Type text query & sift through unverified articles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-petal">04.</span>
                <span>Scrub back and forth to find where you were</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-petal">05.</span>
                <span className="text-bone font-medium">Result: Mental fatigue & abandoned curiosity</span>
              </li>
            </ol>
          </div>

          {/* Right Column: Non-Linear Graph */}
          <div className="p-6 border border-petal/40 bg-black/50 space-y-4 rounded-sm">
            <div className="font-mono text-xs text-petal uppercase tracking-wider font-semibold">
              [02] NON-LINEAR GRAPH — CONV-WAY
            </div>
            <p className="font-mono text-xs text-bone leading-relaxed">
              Conv-way treats video as a queryable conversational graph rather than a passive tape:
            </p>
            <ul className="space-y-3 font-sans text-xs sm:text-sm text-parchment pt-1">
              <li className="flex items-start gap-2">
                <span className="text-lime font-mono">●</span>
                <div>
                  <strong className="text-white">Best Answer on YouTube Wins:</strong> Matches meaning & key terms across the active video and external podcasts.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lime font-mono">●</span>
                <div>
                  <strong className="text-white">A Face Behind Every Answer:</strong> Named speakers answering in video segments first—never scraped text.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lime font-mono">●</span>
                <div>
                  <strong className="text-white">Never Lose Your Place:</strong> LIFO Call Stack saves your exact millisecond playhead before any detour.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lime font-mono">●</span>
                <div>
                  <strong className="text-white">Viewer Always in Control:</strong> Explicit Hand-Back bar at the end of every answering clip.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Comparative Diagrams */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16 sm:mb-24">
          <figure className="border border-charcoal bg-black/40 overflow-hidden">
            <img
              src="/assets/showcase/Linear Way and Colinear way image.jpeg"
              alt="Linear vs Colinear Video Exploration"
              className="w-full h-auto object-cover max-h-[380px]"
              loading="lazy"
            />
            <figcaption className="p-3 border-t border-charcoal/80 font-mono text-xs text-ash flex items-center justify-between">
              <span>FIGURE 02.A // LINEAR TIMELINE VS. CO-LINEAR EXPLORATION DETOUR</span>
              <span className="text-petal">GRAPH RHYTHM</span>
            </figcaption>
          </figure>

          <figure className="border border-charcoal bg-black/40 overflow-hidden">
            <img
              src="/assets/showcase/02-passive-vs-convway-flow-diagram.png"
              alt="Passive vs Conv-way Flow Diagram"
              className="w-full h-auto object-cover max-h-[380px]"
              loading="lazy"
            />
            <figcaption className="p-3 border-t border-charcoal/80 font-mono text-xs text-ash flex items-center justify-between">
              <span>FIGURE 02.B // STATE MACHINE DIVERGENCE & RETURN CONTRACT</span>
              <span className="text-lime">HAND-BACK ZERO LOSS</span>
            </figcaption>
          </figure>
        </div>

        {/* Scroll Interaction #1: The Mechanical LIFO Call Stack Scrubber */}
        <div className="border border-charcoal p-6 sm:p-8 bg-black/70 space-y-6 rounded-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-charcoal pb-4 gap-2">
            <div>
              <div className="font-mono text-xs text-petal font-semibold uppercase tracking-wider">
                MECHANICAL LIFO CALL STACK SCRUBBER
              </div>
              <p className="font-mono text-[11px] text-ash">
                Simulate how Conv-way forks the timeline when a viewer asks a question out loud
              </p>
            </div>
            {/* Step Selection Buttons */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => setScrubberStep(0)}
                className={`px-2.5 py-1 border rounded-sm transition-colors ${
                  scrubberStep === 0
                    ? 'border-petal text-petal bg-petal/10'
                    : 'border-charcoal text-ash hover:border-bone'
                }`}
              >
                1. ORIGIN
              </button>
              <button
                onClick={() => setScrubberStep(1)}
                className={`px-2.5 py-1 border rounded-sm transition-colors ${
                  scrubberStep === 1
                    ? 'border-petal text-petal bg-petal/10'
                    : 'border-charcoal text-ash hover:border-bone'
                }`}
              >
                2. PUSH DETOUR
              </button>
              <button
                onClick={() => setScrubberStep(2)}
                className={`px-2.5 py-1 border rounded-sm transition-colors ${
                  scrubberStep === 2
                    ? 'border-petal text-petal bg-petal/10'
                    : 'border-charcoal text-ash hover:border-bone'
                }`}
              >
                3. POP & RESUME
              </button>
            </div>
          </div>

          {/* Interactive Mechanical Visualizer */}
          <div className="font-mono text-xs sm:text-sm bg-black/90 p-4 sm:p-6 border border-charcoal/80 overflow-x-auto">
            <div className="text-ash mb-3 text-[11px]">
              {scrubberStep === 0 && 'STATUS: [PLAYING ROOT] ──► Viewer asks: "Wait, why can\'t Starlink handle dense cities?"'}
              {scrubberStep === 1 && 'STATUS: [DETOUR ACTIVE] ──► PUSH(1465.0s) -> SEEK(1640.3s) -> PLAYING ANSWER CLIP'}
              {scrubberStep === 2 && 'STATUS: [HAND-BACK DECISION] ──► POP(1465.0s) -> RESUMING ROOT TIMELINE AT 00:24:25'}
            </div>

            <div className="space-y-4 py-2 min-w-[580px]">
              {/* Main Timeline */}
              <div className="flex items-center gap-3">
                <span className="w-28 text-bone shrink-0">MAIN TIMELINE:</span>
                <div className="flex-1 relative h-6 flex items-center">
                  <div className="w-full h-0.5 bg-charcoal" />
                  <span className="absolute left-0 font-mono text-[10px] text-ash">00:00</span>
                  <div
                    className="absolute left-[38%] -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 bg-black border border-petal text-[11px] text-petal rounded-sm"
                  >
                    <span>◈ [00:24:25 SAVED]</span>
                  </div>
                  <span className="absolute right-0 font-mono text-[10px] text-ash">02:02:25</span>
                </div>
              </div>

              {/* Branch Timeline */}
              {scrubberStep >= 1 && (
                <div className="flex items-start gap-3 pl-8 border-l border-petal/60 ml-32">
                  <span className="w-24 text-petal font-semibold shrink-0">BRANCH #1:</span>
                  <div className="flex-1 bg-black/60 p-2.5 border border-petal/40 rounded-sm space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-lime font-bold">● [00:27:20 — 00:29:04] PLAYING ANSWER CLIP</span>
                      <span className="text-ash">CONFIDENCE: 98%</span>
                    </div>
                    <div className="text-parchment text-xs font-sans">
                      "Elon explains beam physics at 550 km vs cell tower at 1 km."
                    </div>
                    {scrubberStep === 2 && (
                      <div className="pt-2 text-lime text-[11px]">
                        ✓ Clip complete → User taps [RETURN TO MAIN] → Stack POP → Resumes 00:24:25
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Architecture Diagram Figure 03 */}
          <figure className="border border-charcoal/60 bg-black/30 overflow-hidden mt-6">
            <img
              src="/assets/showcase/03-lifo-call-stack-architecture.png"
              alt="LIFO Call Stack Architecture Diagram"
              className="w-full h-auto object-cover max-h-[420px]"
              loading="lazy"
            />
            <figcaption className="p-3 border-t border-charcoal/60 font-mono text-xs text-ash flex items-center justify-between">
              <span>FIGURE 03 // LIFO PLAYHEAD CALL STACK MEMORY STRUCTURE [T_origin, T_b1, T_bn]</span>
              <span className="text-bone">CRASH RESILIENT</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
};

