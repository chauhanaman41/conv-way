import { create } from 'zustand';

export interface AnswerClip {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  startSec: number;
  endSec: number;
  isExternalVideo: boolean;
  speakerName?: string;
  breadcrumbSummary: string;
}

export interface StackEntry {
  id: string;
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  returnTimestamp: number;
  volume: number;
  branchQuestionText: string;
  answerClip: AnswerClip;
  createdAt: string;
}

export interface PlaybackWindow {
  windowIndex: number;
  startSec: number;
  endSec: number;
  wordCount?: number;
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationSec: number;
  captionStatus: 'READY' | 'NO_CAPTIONS' | 'BUDGET_DEFERRED' | 'PENDING' | 'PROCESSING';
  windowCount: number;
  transcriptProvider?: string;
  language?: string;
  retryAfter?: string | null;
  statusReason?: string | null;
}

export interface HandBackState {
  isShowing: boolean;
  questionText: string;
  answerClip?: AnswerClip;
  returnTimestamp: number;
  clarificationPrompt?: string;
}

interface PlaybackState {
  // Current active main video
  currentVideo: VideoMetadata | null;
  currentTime: number;
  durationSec: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;

  // 2-second watch gate accumulator
  activeWatchedSeconds: number;
  isInitialized: boolean;
  windows: PlaybackWindow[];

  // LIFO Call Stack for non-linear exploration
  callStack: StackEntry[];

  // Active answer clip playback constraints
  activeAnswerClip: AnswerClip | null;
  activeHandBack: HandBackState;

  // External PiP player state
  isPipActive: boolean;
  pipVideo: { videoId: string; startSec: number; endSec: number } | null;

  // YouTube player reference control
  playerRef: any;
  pipPlayerRef: any;

  // Actions
  setCurrentVideo: (video: VideoMetadata) => void;
  setWindows: (windows: PlaybackWindow[]) => void;
  setPlayerRef: (ref: any) => void;
  setPipPlayerRef: (ref: any) => void;
  updatePlayhead: (currentTime: number, isPlaying: boolean) => void;
  accumulateWatchTime: (deltaSec: number) => void;
  setIsInitialized: (val: boolean) => void;

  pushBranch: (questionText: string, clip: AnswerClip) => void;
  popBranch: () => void;
  returnToRoot: () => void;

  showHandBack: (questionText: string, clip: AnswerClip, returnTimestamp: number, clarification?: string) => void;
  dismissHandBack: () => void;
  closePip: () => void;
  syncVideoState: (videoId: string) => Promise<void>;
}

const STORAGE_KEY = 'conv_way_playback_stack';

function loadStackFromSession(): StackEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStackToSession(stack: StackEntry[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
  } catch {}
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentVideo: null,
  currentTime: 0,
  durationSec: 0,
  isPlaying: false,
  volume: 100,
  isMuted: false,

  activeWatchedSeconds: 0,
  isInitialized: false,
  windows: [],

  callStack: loadStackFromSession(),
  activeAnswerClip: null,
  activeHandBack: { isShowing: false, questionText: '', returnTimestamp: 0 },

  isPipActive: false,
  pipVideo: null,
  playerRef: null,
  pipPlayerRef: null,

  setCurrentVideo: (video) => {
    set({
      currentVideo: video,
      durationSec: video.durationSec,
      currentTime: 0,
      activeWatchedSeconds: 0,
      isInitialized: video.captionStatus === 'READY' && video.windowCount > 0,
      windows: [],
      callStack: [],
      activeAnswerClip: null,
      activeHandBack: { isShowing: false, questionText: '', returnTimestamp: 0 },
      isPipActive: false,
      pipVideo: null,
    });
    sessionStorage.removeItem(STORAGE_KEY);

    // Fetch the unified truth state from D1
    get().syncVideoState(video.videoId);
  },

  syncVideoState: async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${videoId}/state`);
      if (res.ok) {
        const data = (await res.json()) as any;
        const cur = get().currentVideo;
        if (cur && cur.videoId === videoId) {
          const isReady = data.status === 'READY';
          set({
            windows: data.windows || [],
            isInitialized: isReady && (data.windowCount > 0 || (data.windows && data.windows.length > 0)),
            currentVideo: {
              ...cur,
              captionStatus: data.status === 'BUDGET_EXHAUSTED' ? 'BUDGET_DEFERRED' : data.status,
              windowCount: data.windowCount || 0,
              transcriptProvider: data.provider || cur.transcriptProvider || 'NONE',
              language: data.language || cur.language || 'en',
              retryAfter: data.retryAfter || null,
              statusReason: data.reason || null,
            },
          });
        }
      }
    } catch (e) {
      console.warn('[playbackStore] syncVideoState error:', e);
    }
  },

  setWindows: (windows) => set({ windows }),

  setPlayerRef: (ref) => set({ playerRef: ref }),
  setPipPlayerRef: (ref) => set({ pipPlayerRef: ref }),

  updatePlayhead: (currentTime, isPlaying) => {
    const state = get();
    set({ currentTime, isPlaying });

    // Check if currently playing an answer clip and reached endSec
    if (state.activeAnswerClip && isPlaying) {
      if (currentTime >= state.activeAnswerClip.endSec) {
        // Pause playback and trigger Hand-Back decision bar
        if (state.playerRef && typeof state.playerRef.pauseVideo === 'function') {
          state.playerRef.pauseVideo();
        }
        if (state.pipPlayerRef && typeof state.pipPlayerRef.pauseVideo === 'function') {
          state.pipPlayerRef.pauseVideo();
        }

        const topEntry = state.callStack[state.callStack.length - 1];
        const returnTimestamp = topEntry ? topEntry.returnTimestamp : 0;

        get().showHandBack(
          topEntry?.branchQuestionText || 'Question segment',
          state.activeAnswerClip,
          returnTimestamp
        );
      }
    }
  },

  accumulateWatchTime: (deltaSec) => {
    set((s) => ({ activeWatchedSeconds: s.activeWatchedSeconds + deltaSec }));
  },

  setIsInitialized: (val) => set({ isInitialized: val }),

  pushBranch: (questionText, clip) => {
    const state = get();
    if (!state.currentVideo) return;

    // Save current playhead timestamp with 2-second safety rewind
    const returnTimestamp = Math.max(0, state.currentTime - 2.0);

    const newEntry: StackEntry = {
      id: `branch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      videoId: state.currentVideo.videoId,
      videoTitle: state.currentVideo.title,
      channelTitle: state.currentVideo.channelTitle,
      returnTimestamp,
      volume: state.volume,
      branchQuestionText: questionText,
      answerClip: clip,
      createdAt: new Date().toISOString(),
    };

    const nextStack = [...state.callStack, newEntry];
    saveStackToSession(nextStack);

    // If clip is from an external video, activate PiP player; otherwise seek main player
    if (clip.isExternalVideo) {
      if (state.playerRef && typeof state.playerRef.pauseVideo === 'function') {
        state.playerRef.pauseVideo();
      }
      set({
        callStack: nextStack,
        activeAnswerClip: clip,
        isPipActive: true,
        pipVideo: { videoId: clip.videoId, startSec: clip.startSec, endSec: clip.endSec },
        activeHandBack: { isShowing: false, questionText: '', returnTimestamp: 0 },
      });
    } else {
      if (state.playerRef && typeof state.playerRef.seekTo === 'function') {
        state.playerRef.seekTo(clip.startSec, true);
        if (typeof state.playerRef.playVideo === 'function') {
          state.playerRef.playVideo();
        }
      }
      set({
        callStack: nextStack,
        currentTime: clip.startSec,
        activeAnswerClip: clip,
        isPipActive: false,
        pipVideo: null,
        activeHandBack: { isShowing: false, questionText: '', returnTimestamp: 0 },
      });
    }
  },

  popBranch: () => {
    const state = get();
    if (state.callStack.length === 0) return;

    const topEntry = state.callStack[state.callStack.length - 1];
    const nextStack = state.callStack.slice(0, -1);
    saveStackToSession(nextStack);

    // Close PiP if active
    if (state.isPipActive) {
      if (state.pipPlayerRef && typeof state.pipPlayerRef.stopVideo === 'function') {
        state.pipPlayerRef.stopVideo();
      }
    }

    // Return main player to saved timestamp and resume
    if (state.playerRef && typeof state.playerRef.seekTo === 'function') {
      state.playerRef.seekTo(topEntry.returnTimestamp, true);
      if (typeof state.playerRef.playVideo === 'function') {
        state.playerRef.playVideo();
      }
    }

    set({
      callStack: nextStack,
      currentTime: topEntry.returnTimestamp,
      activeAnswerClip: nextStack.length > 0 ? nextStack[nextStack.length - 1].answerClip : null,
      activeHandBack: { isShowing: false, questionText: '', returnTimestamp: 0 },
      isPipActive: false,
      pipVideo: null,
    });
  },

  returnToRoot: () => {
    const state = get();
    if (state.callStack.length === 0) return;

    const rootEntry = state.callStack[0];
    saveStackToSession([]);

    if (state.isPipActive && state.pipPlayerRef && typeof state.pipPlayerRef.stopVideo === 'function') {
      state.pipPlayerRef.stopVideo();
    }

    if (state.playerRef && typeof state.playerRef.seekTo === 'function') {
      state.playerRef.seekTo(rootEntry.returnTimestamp, true);
      if (typeof state.playerRef.playVideo === 'function') {
        state.playerRef.playVideo();
      }
    }

    set({
      callStack: [],
      currentTime: rootEntry.returnTimestamp,
      activeAnswerClip: null,
      activeHandBack: { isShowing: false, questionText: '', returnTimestamp: 0 },
      isPipActive: false,
      pipVideo: null,
    });
  },

  showHandBack: (questionText, clip, returnTimestamp, clarification) => {
    set({
      activeHandBack: {
        isShowing: true,
        questionText,
        answerClip: clip,
        returnTimestamp,
        clarificationPrompt: clarification,
      },
    });
  },

  dismissHandBack: () => {
    set((s) => ({
      activeHandBack: { ...s.activeHandBack, isShowing: false },
    }));
  },

  closePip: () => {
    set({ isPipActive: false, pipVideo: null });
  },
}));

