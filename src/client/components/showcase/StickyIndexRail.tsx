import React, { useEffect, useState } from 'react';

interface SectionCoordinate {
  id: string;
  code: string;
  label: string;
}

const SECTIONS: SectionCoordinate[] = [
  { id: 'section-00', code: '00', label: 'MANIFESTO' },
  { id: 'section-01', code: '01', label: 'PARADOX' },
  { id: 'section-02', code: '02', label: 'FEATURES' },
  { id: 'section-03', code: '03', label: 'PIPELINE' },
  { id: 'section-04', code: '04', label: 'TECH STACK' },
  { id: 'section-05', code: '05', label: 'CONSTRUCTION' },
  { id: 'live-workspace', code: '06', label: 'LIVE APP ↓' },
];

export const StickyIndexRail: React.FC = () => {
  const [activeId, setActiveId] = useState<string>('section-00');
  const [isWorkspaceVisible, setIsWorkspaceVisible] = useState<boolean>(false);

  useEffect(() => {
    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
          if (entry.target.id === 'live-workspace') {
            setIsWorkspaceVisible(true);
          } else {
            setIsWorkspaceVisible(false);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    });

    SECTIONS.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <aside
      aria-label="Editorial Section Navigation"
      className={`hidden xl:block fixed left-6 top-28 z-40 w-36 transition-opacity duration-300 ${
        isWorkspaceVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="border-l border-charcoal/60 pl-3 py-1 space-y-3 font-mono text-[11px]">
        {SECTIONS.map((sec) => {
          const isActive = activeId === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => scrollTo(sec.id)}
              className={`flex items-center gap-2 w-full text-left transition-colors group focus:outline-none ${
                isActive ? 'text-parchment font-semibold' : 'text-ash hover:text-bone'
              }`}
            >
              {isActive ? (
                <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0 shadow-[0_0_6px_#4dff00]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-transparent border border-ash/40 shrink-0 group-hover:border-bone" />
              )}
              <span className="tracking-tight truncate">
                {sec.code} // {sec.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

