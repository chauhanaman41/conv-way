import React from 'react';

interface Section00HeroProps {
  onLaunchWorkspace: () => void;
}

export const Section00Hero: React.FC<Section00HeroProps> = ({ onLaunchWorkspace }) => {
  return (
    <section id="section-00" className="pt-8 sm:pt-16 pb-20 sm:pb-32 border-b border-charcoal/60">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Editorial Eyebrow */}
        <div className="flex items-center gap-3 font-mono text-xs text-ash tracking-widest uppercase mb-8">
          <span className="w-2 h-2 rounded-full bg-lime inline-block" />
          <span>SECTION 00 // PRODUCT MANIFESTO</span>
          <span>·</span>
          <span>SYSTEM READY</span>
        </div>

        {/* Hero Title Grid */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 sm:gap-8 mb-16 sm:mb-24">
          <div className="p-3 border border-charcoal bg-black/60 rounded-sm shrink-0">
            <img
              src="/logo-parchment.png"
              alt="Conv-way Dual Penguin Mark"
              className="h-16 w-auto object-contain"
            />
          </div>

          <div className="space-y-3">
            <h1 className="font-display font-bold text-2xl sm:text-4xl lg:text-5xl text-parchment tracking-tight leading-[1.1] uppercase">
              Don't pause your curiosity,
              <br />
              <span className="text-petal">let the video follow it.</span>
            </h1>
            <p className="font-mono text-xs sm:text-sm text-bone tracking-wide uppercase">
              Ambient Multi-Modal Intelligence For Non-Linear YouTube Playback // 2026
            </p>
          </div>
        </div>

        {/* Two-Column Specification Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 border-t border-charcoal/80 pt-10 sm:pt-16 mb-16 sm:mb-24">
          {/* Left Column: What is Conv-way? */}
          <div className="space-y-4">
            <div className="font-mono text-xs text-petal font-semibold tracking-wider">
              [00.1] WHAT IS CONV-WAY?
            </div>
            <p className="font-sans text-base sm:text-lg text-parchment leading-relaxed font-normal">
              Conv-way is a zero-sign-in web companion that lets you talk directly to any YouTube video while it plays. Ask a question out loud or tap the quiet "Way" panel: Conv-way saves your exact millisecond playhead, finds and plays only the answering segment across YouTube, and brings you right back where you paused.
            </p>
          </div>

          {/* Right Column: Live Orchestration Status */}
          <div className="space-y-4">
            <div className="font-mono text-xs text-bone font-semibold tracking-wider">
              [00.2] LIVE ORCHESTRATION STATUS
            </div>
            <ul className="space-y-2 font-mono text-xs sm:text-sm text-parchment">
              <li className="flex items-center gap-2">
                <span className="text-lime">●</span>
                <span>ZERO SIGN-IN · PUBLIC YOUTUBE API</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-lime">●</span>
                <span>2.0s WATCH CONFIRMATION GATE ENFORCED</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-lime">●</span>
                <span>LIFO PLAYHEAD CALL STACK READY</span>
              </li>
            </ul>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button
                onClick={onLaunchWorkspace}
                className="px-6 py-3 bg-petal text-black font-sans font-bold text-xs uppercase tracking-wider rounded-btn hover:bg-[#ffbdf9] transition-transform active:scale-95 shadow-[0_0_20px_rgba(255,161,247,0.3)] focus:outline-none"
              >
                Launch Live Workspace ↓
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('section-01');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="font-mono text-xs text-ash hover:text-parchment transition-colors"
              >
                ↓ Scroll to explore architecture
              </button>
            </div>
          </div>
        </div>

        {/* Figure 01: Ambient Waveform & Playhead Fork Architecture */}
        <figure className="border border-charcoal bg-black/40 overflow-hidden">
          <img
            src="/assets/showcase/01-hero-ambient-waveform-diagram.png"
            alt="Hero Ambient Waveform Diagram"
            className="w-full h-auto object-cover max-h-[560px]"
            loading="lazy"
          />
          <figcaption className="p-3 border-t border-charcoal/80 flex items-center justify-between font-mono text-xs text-ash">
            <span>FIGURE 01 // DUAL-STREAM AMBIENT AUDIO ISOLATION & NON-LINEAR PLAYHEAD FORK</span>
            <span className="text-petal">OBSIDIAN GALLERY SPEC</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
};

