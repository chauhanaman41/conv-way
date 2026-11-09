import React, { useState, useEffect } from 'react';
import { VideoMetadata } from '../stores/playbackStore';

interface HomeViewProps {
  onSelectVideo: (video: VideoMetadata) => void;
}

function formatDuration(sec: number): string {
  if (!sec) return 'LONG';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectVideo }) => {
  const [trendingVideos, setTrendingVideos] = useState<VideoMetadata[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VideoMetadata[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Fetch live trending podcasts on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/discovery/trending')
      .then((res) => res.json())
      .then((data: any) => {
        if (isMounted && data.ok && Array.isArray(data.videos)) {
          setTrendingVideos(data.videos);
        }
      })
      .catch((err) => console.warn('[HomeView] Failed to fetch trending:', err))
      .finally(() => {
        if (isMounted) setLoadingTrending(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle direct URL paste
  const handleResolveUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || resolvingUrl) return;

    setResolvingUrl(true);
    setUrlError(null);

    try {
      const res = await fetch('/api/videos/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json() as any;
      if (res.ok && data.ok && data.video) {
        onSelectVideo(data.video);
      } else {
        setUrlError(data.error?.message || 'Could not resolve this YouTube URL.');
      }
    } catch {
      setUrlError('Connection error resolving YouTube video.');
    } finally {
      setResolvingUrl(false);
    }
  };

  // Handle Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/discovery/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json() as any;
      if (res.ok && data.ok && Array.isArray(data.results)) {
        setSearchResults(data.results);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const displayedVideos = searchResults !== null ? searchResults : trendingVideos;

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-8 space-y-12">
      {/* Hero / Concept Header */}
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-petal" />
          <span className="font-mono text-xs uppercase tracking-widest text-parchment font-semibold">
            NON-LINEAR YOUTUBE EXPLORATION
          </span>
        </div>
        <h1 className="font-sans text-3xl sm:text-4xl font-bold text-parchment tracking-tight leading-tight">
          Ask questions while watching. Clip the answers. Return seamlessly.
        </h1>
        <p className="font-sans text-sm sm:text-base text-bone leading-relaxed">
          Zero sign-in required. Conv-way indexes long-form podcasts and talks into timestamped speech
          windows, enabling Push-to-Talk interactive Q&amp;A backed by live AI grounding and speech search.
        </p>
      </div>

      {/* Direct YouTube URL Paste Bar */}
      <div className="p-4 sm:p-6 border border-charcoal bg-black space-y-3">
        <label className="font-mono text-xs text-parchment uppercase tracking-wider block font-medium">
          PASTE ANY YOUTUBE LINK OR VIDEO ID
        </label>
        <form onSubmit={handleResolveUrl} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste any YouTube video URL or ID (e.g. https://www.youtube.com/watch?v=...)"
            className="flex-1 bg-black border border-charcoal px-3 py-2.5 font-mono text-xs text-parchment placeholder-ash focus:border-petal rounded-sm"
          />
          <button
            type="submit"
            disabled={!urlInput.trim() || resolvingUrl}
            className="h-10 px-6 rounded-full bg-petal text-black font-mono text-xs font-semibold hover:bg-[#ffbdf9] transition-colors disabled:opacity-40 whitespace-nowrap focus:outline-none"
          >
            {resolvingUrl ? 'RESOLVING...' : 'EXPLORE VIDEO'}
          </button>
        </form>
        {urlError && <p className="font-mono text-xs text-red-400">{urlError}</p>}
      </div>

      {/* Discovery Search Bar */}
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search indexed podcast episodes or topics (e.g. Starlink, AI, Nikhil Kamath)..."
            className="flex-1 bg-black border border-charcoal px-3 py-2 font-mono text-xs text-parchment placeholder-ash focus:border-bone rounded-sm"
          />
          <button
            type="submit"
            disabled={!searchQuery.trim() || searching}
            className="px-4 py-2 border border-charcoal text-parchment font-mono text-xs hover:border-bone rounded-sm disabled:opacity-40"
          >
            {searching ? 'SEARCHING...' : 'SEARCH'}
          </button>
          {searchResults !== null && (
            <button
              type="button"
              onClick={() => {
                setSearchResults(null);
                setSearchQuery('');
              }}
              className="px-3 py-2 text-ash hover:text-parchment font-mono text-xs"
            >
              CLEAR
            </button>
          )}
        </form>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-charcoal pb-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-parchment font-semibold">
            {searchResults !== null ? 'SEARCH RESULTS' : 'TRENDING PODCASTS // TOP 20'}
          </span>
          <span className="font-mono text-[10px] text-ash">
            [{displayedVideos.length} EPISODES]
          </span>
        </div>
        <span className="font-mono text-[11px] text-ash hidden sm:inline">
          EDGE-CACHED CDN
        </span>
      </div>

      {/* Video Grid */}
      {loadingTrending ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="aspect-video w-full bg-charcoal/30 border border-charcoal" />
              <div className="h-4 bg-charcoal/20 w-3/4" />
              <div className="h-3 bg-charcoal/10 w-1/2" />
            </div>
          ))}
        </div>
      ) : displayedVideos.length === 0 ? (
        <div className="py-12 text-center font-mono text-xs text-ash">
          NO EPISODES FOUND MATCHING YOUR QUERY
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayedVideos.map((video) => (
            <div
              key={video.videoId}
              onClick={() => onSelectVideo(video)}
              className="group cursor-pointer border border-charcoal hover:border-bone transition-all p-2 bg-black flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                {/* 16:9 Sharp 0px Media Frame */}
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    loading="lazy"
                  />
                  {/* Duration badge */}
                  <span className="absolute bottom-1 right-1 bg-black/90 font-mono text-[10px] text-parchment px-1.5 py-0.5">
                    {formatDuration(video.durationSec)}
                  </span>
                </div>

                {/* Title & Channel */}
                <div className="space-y-1">
                  <h3 className="font-sans font-semibold text-xs sm:text-sm text-parchment line-clamp-2 group-hover:text-petal transition-colors">
                    {video.title}
                  </h3>
                  <p className="font-mono text-[11px] text-bone truncate">
                    {video.channelTitle}
                  </p>
                </div>
              </div>

              {/* Footer status */}
              <div className="pt-3 mt-2 border-t border-charcoal/50 flex items-center justify-between font-mono text-[10px]">
                <span
                  className={
                    video.captionStatus === 'READY'
                      ? 'text-lime'
                      : video.captionStatus === 'BUDGET_DEFERRED'
                      ? 'text-ash'
                      : 'text-bone'
                  }
                >
                  ● {video.captionStatus === 'READY' ? 'READY' : video.captionStatus}
                </span>
                <span className="text-parchment group-hover:translate-x-0.5 transition-transform">
                  EXPLORE →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
