import React, { useState } from 'react';

interface FeatureItem {
  index: string;
  title: string;
  tag: string;
  description: string;
  technicalProof: string;
}

const FEATURES: FeatureItem[] = [
  {
    index: '[01]',
    title: 'AMBIENT AUDIO ISOLATION & DUCKING',
    tag: 'WEBRTC AEC + GAIN NODE',
    description:
      'Speak naturally without manually pausing. Video volume attenuates to 18% on headphones or auto-pauses on mobile speakers to prevent acoustic feedback into the microphone.',
    technicalProof:
      'AudioConstraint: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } · DuckTarget: 18%',
  },
  {
    index: '[02]',
    title: 'FOUR WAYS TO ASK',
    tag: 'PTT · VAD · TEXT · WAY',
    description:
      'Push-to-Talk baseline on every device, opt-in continuous ambient voice VAD, direct monospace text input, or one-tap questions in the quiet Way side panel.',
    technicalProof:
      'InputModalities: [Push-to-Talk (Hold Space/Btn), Ambient VAD (RMS > 0.12), Direct Text Input, Way Cues Tap]',
  },
  {
    index: '[03]',
    title: '"WAY" PREDICTED QUESTIONS PANEL',
    tag: '600–800 WORD WINDOWS',
    description:
      'Pre-computes natural questions for each ~4-minute speech window. Questions unlock progressively as the playhead approaches their spoken timestamp.',
    technicalProof:
      'WindowSizing: 600–800 words · PrefetchTrigger: 75% playhead span · SeekDebounce: 400ms · CDN Cache: 7 Days',
  },
  {
    index: '[04]',
    title: 'IN-VIDEO SEEK & EXTERNAL PICTURE-IN-PICTURE',
    tag: '>= 200x200 PX COMPLIANT',
    description:
      'Plays only the exact [start_sec, end_sec] answering clip. In-video answers smoothly seek the main player; cross-video answers mount an external YouTube TOS-compliant PiP frame.',
    technicalProof:
      'PiPFrameDimensions: >= 200x200px · YouTube TOS Compliant · Non-Destructive Main State · Clean Hand-Back',
  },
  {
    index: '[05]',
    title: 'LIFO PLAYHEAD CALL STACK & HAND-BACK',
    tag: 'NESTED DETOUR MEMORY',
    description:
      'Supports multi-hop "Dive Deeper" exploratory follow-ups: Stack = [T_origin, T_branch_1, ..., T_branch_n]. Never bounces back abruptly; hands control back at clip completion.',
    technicalProof:
      'CallStackStructure: StackEntry[] in Memory + SessionStorage · ActionSet: [RETURN TO ORIGIN, DIVE DEEPER, ASK ANOTHER]',
  },
  {
    index: '[06]',
    title: 'VERIFIED 30–40 WORD AI FALLBACK',
    tag: 'CITATION-GATED SYNTHESIS',
    description:
      'When no video segment covers the query, live web search retrieves grounded sources. Real LLMs synthesize a strict 30–40 word answer; otherwise clean verified source cards are presented.',
    technicalProof:
      'SynthesisRules: 30–40 words · Zero Fake Templates · Citation Grounding: Verified Domain URL Set · Cleaned Snippets',
  },
];

export const Section02Capabilities: React.FC = () => {
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  const scrollToWorkspace = () => {
    const el = document.getElementById('live-workspace');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="section-02" className="py-20 sm:py-32 border-b border-charcoal/60">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Editorial Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-charcoal pb-4 mb-16 sm:mb-24 gap-2">
          <div className="font-display text-xl sm:text-3xl text-parchment tracking-tight uppercase">
            02 // Core Capabilities
          </div>
          <div className="font-display text-base sm:text-xl text-ash tracking-tight uppercase">
            06 Production Features
          </div>
        </div>

        {/* Feature Index Rows */}
        <div className="divide-y divide-charcoal/70 border-y border-charcoal/70 mb-16 sm:mb-24">
          {FEATURES.map((feat) => {
            const isExpanded = expandedIndex === feat.index;
            return (
              <div
                key={feat.index}
                onClick={() => setExpandedIndex(isExpanded ? null : feat.index)}
                className={`py-6 px-4 transition-colors cursor-pointer group ${
                  isExpanded ? 'bg-charcoal/20' : 'hover:bg-charcoal/10'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono text-xs sm:text-sm font-semibold transition-colors ${
                        isExpanded ? 'text-petal' : 'text-bone group-hover:text-petal'
                      }`}
                    >
                      {feat.index}
                    </span>
                    <h3 className="font-mono text-sm sm:text-base text-parchment font-bold tracking-tight uppercase">
                      {feat.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-ash tracking-wide uppercase px-2 py-0.5 border border-charcoal/80 rounded-sm">
                      {feat.tag}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        scrollToWorkspace();
                      }}
                      className="font-mono text-[11px] text-ash hover:text-petal transition-colors hidden sm:inline"
                    >
                      [TRY IN PLAYER ↓]
                    </button>
                  </div>
                </div>

                <p className="font-sans text-xs sm:text-sm text-bone leading-relaxed max-w-4xl pl-0 md:pl-10">
                  {feat.description}
                </p>

                {/* Technical Proof Strip */}
                {isExpanded && (
                  <div className="mt-4 ml-0 md:ml-10 p-3 bg-black border border-petal/40 rounded-sm font-mono text-[11px] text-lime">
                    <span className="text-petal uppercase font-semibold mr-2">TECHNICAL PROOF:</span>
                    <span>{feat.technicalProof}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Figure 04: Way Predictive Window & Picture-in-Picture */}
        <figure className="border border-charcoal bg-black/40 overflow-hidden">
          <img
            src="/assets/showcase/04-way-predictive-window-pip.png"
            alt="Way Predictive Window and PiP Architecture"
            className="w-full h-auto object-cover max-h-[500px]"
            loading="lazy"
          />
          <figcaption className="p-3 border-t border-charcoal/80 font-mono text-xs text-ash flex items-center justify-between">
            <span>FIGURE 04 // 600-800 WORD PREDICTIVE WINDOW & YOUTUBE-COMPLIANT EXTERNAL PIP</span>
            <span className="text-petal">PRE-COMPUTED</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
};

