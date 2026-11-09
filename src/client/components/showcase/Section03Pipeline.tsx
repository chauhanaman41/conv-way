import React from 'react';

interface StageData {
  stage: string;
  name: string;
  howWeImplement: string;
  guarantee: string;
}

const PIPELINE_STAGES: StageData[] = [
  {
    stage: 'STAGE 01',
    name: '2-Second Watch Confirmation Gate',
    howWeImplement:
      'Client monitors YouTube player state via postMessage. POST /api/videos/:id/init is blocked (HTTP 400 WATCH_THRESHOLD_NOT_MET) until the user has actively watched for at least 2.0 continuous seconds.',
    guarantee: 'Zero wasted transcript API calls or database row creations on bounced clicks.',
  },
  {
    stage: 'STAGE 02',
    name: 'Swappable Transcript Adapter & Windowing',
    howWeImplement:
      'Worker orchestrates Supadata API (primary) with seamless fallback to TranscriptAPI. Timestamps and cues are chunked into 600–800 word speech windows (~30 rows per 2-hour podcast) and indexed into Cloudflare D1 SQLite FTS5 (bm25).',
    guarantee: 'Cuts D1 database row writes by >99%; consumes approx. 0.2 MB storage per 2-hour podcast.',
  },
  {
    stage: 'STAGE 03',
    name: 'Hybrid Zero-Credit-First Voice Routing',
    howWeImplement:
      'Voice input executes directly in the browser via Web Speech API (SpeechRecognition) at zero credit cost. Seamlessly falls back to server-side Gnani Prisma v3.0 for unsupported browsers or 9 Indian languages.',
    guarantee: 'Preserves daily Gnani credit pool while delivering native STT speed.',
  },
  {
    stage: 'STAGE 04',
    name: 'Shared "Way" Cache & Learned Queries',
    howWeImplement:
      'Questions and [startSec, endSec] answer clips are verified and cached in D1 + Cloudflare CDN Edge Cache (s-maxage=604800). Live queries that miss the pre-computed set are indexed as LEARNED_LIVE.',
    guarantee: 'One viewer\'s exploratory query permanently enriches the graph for all future viewers.',
  },
  {
    stage: 'STAGE 05',
    name: '3,000-Credit Governor & Step-Downs',
    howWeImplement:
      'Daily Cap dynamically calibrated as (Remaining Pool / Days Left) * 0.90 (~73 credits/day). Speculative prefetching steps down at 80% usage; at 100% usage, system switches strictly to cached Way + FTS5 + browser STT.',
    guarantee: '100% uptime of core clip retrieval, playback, and navigation even at zero AI credits.',
  },
];

export const Section03Pipeline: React.FC = () => {
  return (
    <section id="section-03" className="py-20 sm:py-32 border-b border-charcoal/60">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {/* Editorial Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-charcoal pb-4 mb-16 sm:mb-24 gap-2">
          <div className="font-display text-xl sm:text-3xl text-parchment tracking-tight uppercase">
            03 // How We Implement It
          </div>
          <div className="font-display text-base sm:text-xl text-ash tracking-tight uppercase">
            End-To-End Engineering Pipeline
          </div>
        </div>

        {/* 5-Stage Architecture Pipeline Grid */}
        <div className="space-y-4 mb-16 sm:mb-24">
          {PIPELINE_STAGES.map((stg) => (
            <div
              key={stg.stage}
              className="p-5 sm:p-6 border border-charcoal/70 bg-black/50 hover:border-petal/60 transition-colors rounded-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-charcoal/60 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-petal font-bold tracking-wider">
                    {stg.stage}
                  </span>
                  <h3 className="font-mono text-sm sm:text-base text-parchment font-semibold uppercase">
                    {stg.name}
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-lime flex items-center gap-1.5">
                  <span>✓</span>
                  <span>{stg.guarantee}</span>
                </span>
              </div>
              <p className="font-sans text-xs sm:text-sm text-bone leading-relaxed">
                {stg.howWeImplement}
              </p>
            </div>
          ))}
        </div>

        {/* Figure 05: System Architecture Pipeline Diagram */}
        <figure className="border border-charcoal bg-black/40 overflow-hidden">
          <img
            src="/assets/showcase/05-system-architecture-pipeline.png"
            alt="End-to-End System Architecture Pipeline Diagram"
            className="w-full h-auto object-cover max-h-[520px]"
            loading="lazy"
          />
          <figcaption className="p-3 border-t border-charcoal/80 font-mono text-xs text-ash flex items-center justify-between">
            <span>FIGURE 05 // EDGE WORKER RETRIEVAL & TWO-PASS GROUNDED PIPELINE</span>
            <span className="text-lime">ZERO CREDITS CONSUMED BY BOUNCED TRAFFIC</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
};
