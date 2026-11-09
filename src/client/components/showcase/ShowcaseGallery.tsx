import React from 'react';
import { StickyIndexRail } from './StickyIndexRail';
import { Section00Hero } from './Section00Hero';
import { Section01Paradox } from './Section01Paradox';
import { Section02Capabilities } from './Section02Capabilities';
import { Section03Pipeline } from './Section03Pipeline';
import { Section04TechStack } from './Section04TechStack';
import { Section05UnderConstruction } from './Section05UnderConstruction';

interface ShowcaseGalleryProps {
  onLaunchWorkspace: () => void;
}

export const ShowcaseGallery: React.FC<ShowcaseGalleryProps> = ({ onLaunchWorkspace }) => {
  return (
    <div className="relative w-full bg-black text-parchment overflow-hidden">
      {/* Sticky Left Section Index Rail (>= 1280px) */}
      <StickyIndexRail />

      {/* Main Editorial Walk (Sections 00 - 05) */}
      <div className="w-full">
        <Section00Hero onLaunchWorkspace={onLaunchWorkspace} />
        <Section01Paradox />
        <Section02Capabilities />
        <Section03Pipeline />
        <Section04TechStack />
        <Section05UnderConstruction />
      </div>
    </div>
  );
};

