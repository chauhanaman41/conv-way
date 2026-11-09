import React, { useEffect, useState, useRef } from 'react';

const CONSTRUCTION_FRAMES = [
  {
    src: '/assets/showcase/06-construction-gif-frame-1-survey.png',
    label: 'FRAME 01 // HOISTING TRANSCRIPT ADAPTER MODULE',
    detail: 'Surveying audio timestamps & window chunk boundaries',
  },
  {
    src: '/assets/showcase/07-construction-gif-frame-2-welding.png',
    label: 'FRAME 02 // WELDING YOUTUBE QUOTA & PIP BOUNDARIES',
    detail: 'Anchoring 200x200px IFrame & zero-leak pause states',
  },
  {
    src: '/assets/showcase/08-construction-gif-frame-3-calibration.png',
    label: 'FRAME 03 // CALIBRATING GNANI CREDIT GOVERNOR',
    detail: 'Enforcing daily step-down threshold & fallback STT',
  },
];

interface KnownIssueItem {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
}

const KNOWN_ISSUES: KnownIssueItem[] = [
  {
    id: 'KI-01',
    badge: 'MITIGATED',
    badgeColor: 'border-lime text-lime',
    title: 'Caption APIs & ~5 New Videos/Day Free Limit',
    description:
      'Supadata and TranscriptAPI free tiers cap un-cached transcripts at 5/day. Once indexed after a 2-second watch, speech windows persist permanently in D1 SQLite FTS5 for all users.',
  },
  {
    id: 'KI-02',
    badge: 'IN CALIBRATION',
    badgeColor: 'border-petal text-petal',
    title: 'Gnani Evon Scope & Credit Pool Calibrations',
    description:
      '3,000 Gnani credit pool is budgeted dynamically (~73 credits/day). Core retrieval and boundary extraction run autonomously without an LLM; Evon chat requires verified scope.',
  },
  {
    id: 'KI-03',
    badge: 'QUOTA GUARDED',
    badgeColor: 'border-lime text-lime',
    title: 'YouTube Data API 10,000 Unit Daily Ceiling',
    description:
      'Capped strictly at 90 searches/day (9,000 units). All in-video queries search local D1 FTS5 first, preventing external quota exhaustion.',
  },
  {
    id: 'KI-04',
    badge: 'HARDWARE LIMIT',
    badgeColor: 'border-ash text-bone',
    title: 'Mobile Speaker Acoustic Feedback on Ambient Voice',
    description:
      'Ambient continuous voice listening requires headphones on laptops/phones. Mobile speakers default safely to Push-to-Talk with automatic audio ducking.',
  },
  {
    id: 'KI-05',
    badge: 'BROWSER VARIANCE',
    badgeColor: 'border-bone text-bone',
    title: 'Firefox / WebView SpeechRecognition Differences',
    description:
      'Browsers lacking native Web Speech API automatically fall back to server-side Gnani Prisma v3.0 voice transcription via POST /api/voice/transcribe.',
  },
];

export const Section05UnderConstruction: React.FC = () => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check user motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Pause animation when out of view to save CPU/GPU cycles
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % CONSTRUCTION_FRAMES.length);
    }, 450); // Stepped 8-FPS tactile cadence

    return () => clearInterval(interval);
  }, [isVisible]);

  const currentFrame = CONSTRUCTION_FRAMES[frameIndex];

  return (
    <section id="section-05" className="py-20 sm:py-32 border-b border-charcoal/60">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Editorial Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-charcoal pb-4 mb-8 gap-2">
          <div className="font-display text-xl sm:text-3xl text-parchment tracking-tight uppercase">
            05 // Under Construction
          </div>
          <div className="font-display text-base sm:text-xl text-petal tracking-tight uppercase">
            Active Fixes // v0.2.0-BETA
          </div>
        </div>

        {/* Hazard Marquee Ticker */}
        <div className="border-y border-charcoal py-2 overflow-hidden mb-12 sm:mb-16 bg-black/60 font-mono text-xs text-bone tracking-widest whitespace-nowrap">
          <div className="inline-block animate-marquee">
            /// WORK IN PROGRESS · REAL DATA ONLY · ACTIVE ENGINEERING CALIBRATION · ZERO FAKE PROTOTYPES · FULL RUNTIME HONESTY /// WORK IN PROGRESS · REAL DATA ONLY · ACTIVE ENGINEERING CALIBRATION · ZERO FAKE PROTOTYPES · FULL RUNTIME HONESTY ///
          </div>
        </div>

        {/* Construction Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-16 sm:mb-24">
          {/* Left Column: Stepped 8-FPS Kinetic Construction Loop (7 cols) */}
          <div ref={containerRef} className="lg:col-span-7 space-y-4">
            <figure className="w-full bg-black border border-charcoal rounded-sm overflow-hidden shadow-2xl">
              <div className="relative w-full aspect-video overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={currentFrame.src}
                  alt={currentFrame.label}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Live FPS / Build Counter Badge */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-2 bg-black/90 border border-charcoal px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
                  <span className="font-mono text-[11px] sm:text-xs tracking-tight text-parchment">
                    WIP // ACTIVE BUILD LOOP [{frameIndex + 1}/3]
                  </span>
                </div>
              </div>

              <figcaption className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border-t border-charcoal font-mono text-xs text-ash gap-2">
                <div>
                  <span className="text-parchment font-semibold block">{currentFrame.label}</span>
                  <span className="text-bone text-[11px]">{currentFrame.detail}</span>
                </div>
                <span className="text-petal shrink-0 text-[11px]">KNOWN_ISSUES.MD SYNCED</span>
              </figcaption>
            </figure>
          </div>

          {/* Right Column: Known Issues Ledger (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="font-mono text-xs text-ash uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>[05.1] KNOWN ISSUES & CALIBRATION LEDGER</span>
              <span className="text-lime">● REAL STATUS</span>
            </div>

            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {KNOWN_ISSUES.map((issue) => (
                <div
                  key={issue.id}
                  className="p-3 border border-charcoal/70 bg-black/50 rounded-sm space-y-1.5 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-petal font-semibold">{issue.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 border rounded-sm ${issue.badgeColor}`}>
                      {issue.badge}
                    </span>
                  </div>
                  <h4 className="text-parchment font-semibold font-sans text-xs sm:text-sm">
                    {issue.title}
                  </h4>
                  <p className="text-ash text-[11px] font-sans leading-relaxed">
                    {issue.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Figure 06: Mobile Three-Screen Wireframe */}
        <figure className="border border-charcoal bg-black/40 overflow-hidden">
          <img
            src="/assets/showcase/09-mobile-three-screen-wireframe.png"
            alt="Mobile Three-Screen Wireframe"
            className="w-full h-auto object-cover max-h-[480px]"
            loading="lazy"
          />
          <figcaption className="p-3 border-t border-charcoal/80 font-mono text-xs text-ash flex items-center justify-between">
            <span>FIGURE 06 // MOBILE-FIRST THREE-SCREEN WORKSPACE (DISCOVERY, SEARCH & PLAYHEAD DETOUR)</span>
            <span className="text-bone">RESPONSIVE 320PX+</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
};
