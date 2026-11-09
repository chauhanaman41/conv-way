import React from 'react';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore, SUPPORTED_LANGUAGES } from '../stores/settingsStore';
import { usePlaybackStore } from '../stores/playbackStore';

interface HeaderProps {
  onLogoClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  const { status, rmsLevel } = useAudioStore();
  const { uiLanguage, setUiLanguage, audioDuckingMode, setAudioDuckingMode } = useSettingsStore();
  const { currentVideo, returnToRoot } = usePlaybackStore();

  // Status text mapping
  const getStatusLabel = () => {
    switch (status) {
      case 'LISTENING':
        return 'LISTENING · MIC ACTIVE';
      case 'RECORDING':
        return 'RECORDING · PUSH TO TALK';
      case 'THINKING':
        return 'THINKING · ROUTING';
      case 'SPEAKING':
        return 'SPEAKING · TIMBRE TTS';
      default:
        return 'IDLE · SYSTEM READY';
    }
  };

  const handleIdentityClick = () => {
    if (onLogoClick) {
      onLogoClick();
    } else if (currentVideo) {
      returnToRoot();
    }
  };

  return (
    <header className="w-full border-b border-charcoal bg-black sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Product Emblem + Monospace Wordmark */}
        <button
          onClick={handleIdentityClick}
          className="flex items-center gap-3 group focus:outline-none text-left"
          title="Return to Discovery"
        >
          <img
            src="/logo-parchment.png"
            alt="Conv-way Emblem"
            className="h-7 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <div className="flex flex-col">
            <span className="font-mono text-sm tracking-wider text-parchment font-semibold group-hover:text-petal transition-colors">
              CONV-WAY
            </span>
            <span className="font-mono text-[10px] text-ash tracking-tight hidden sm:inline">
              NON-LINEAR YOUTUBE
            </span>
          </div>
        </button>

        {/* Center-Right: System Status & Settings Controls */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Fast-Track Skip to Live App Button */}
          <button
            onClick={() => {
              const el = document.getElementById('live-workspace');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="font-mono text-xs text-bone hover:text-petal border border-charcoal hover:border-petal/60 px-2.5 py-1 rounded-sm transition-colors flex items-center gap-1.5"
            title="Jump directly to Live Video Workspace"
          >
            <span>SKIP TO APP</span>
            <span className="text-petal">↓</span>
          </button>

          {/* Audio Ducking Mode Toggle */}
          <button
            onClick={() => setAudioDuckingMode(audioDuckingMode === 'duck' ? 'pause' : 'duck')}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 border border-charcoal text-[11px] font-mono text-bone hover:border-bone transition-colors rounded-sm"
            title="Toggle Audio Ducking (18% Volume) vs. Auto-Pause during speech"
          >
            <span className="text-ash">MODE:</span>
            <span className="text-parchment uppercase font-medium">
              {audioDuckingMode === 'duck' ? 'DUCK 18%' : 'AUTO-PAUSE'}
            </span>
          </button>

          {/* Language Selector */}
          <div className="relative">
            <select
              value={uiLanguage}
              onChange={(e) => setUiLanguage(e.target.value)}
              className="bg-black border border-charcoal text-parchment font-mono text-xs px-2 py-1 pr-6 rounded-sm cursor-pointer appearance-none hover:border-bone focus:border-petal transition-colors"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-black text-parchment">
                  {lang.code.toUpperCase()} · {lang.name}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ash text-[10px]">
              ▼
            </div>
          </div>

          {/* Live Status Indicator (Acid Lime Dot) */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <span
                className={`w-2 h-2 rounded-full bg-lime ${
                  status !== 'IDLE' ? 'animate-ping' : ''
                }`}
                style={{
                  transform: status === 'RECORDING' ? `scale(${1 + rmsLevel * 1.5})` : 'scale(1)',
                }}
              />
              <span className="absolute w-2 h-2 rounded-full bg-lime" />
            </div>
            <span className="font-mono text-xs text-bone hidden sm:inline">
              {getStatusLabel()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

