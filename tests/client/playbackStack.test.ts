import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaybackStore, AnswerClip } from '../../src/client/stores/playbackStore';

describe('LIFO Playback Call Stack Unit Tests', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    usePlaybackStore.setState({
      currentVideo: {
        videoId: 'Rni7Fz7208c',
        title: 'Musk x Kamath',
        channelTitle: 'Nikhil Kamath',
        thumbnailUrl: 'https://i.ytimg.com/vi/Rni7Fz7208c/hqdefault.jpg',
        durationSec: 6846,
        captionStatus: 'READY',
        windowCount: 34,
      },
      currentTime: 1455.0, // 00:24:15
      callStack: [],
      activeAnswerClip: null,
      isPipActive: false,
      pipVideo: null,
    });
  });

  it('pushBranch records entry with 2-second safety rewind offset', () => {
    const store = usePlaybackStore.getState();

    const clip1: AnswerClip = {
      videoId: 'Rni7Fz7208c',
      videoTitle: 'Musk x Kamath',
      channelTitle: 'Nikhil Kamath',
      startSec: 1661.0,
      endSec: 1731.0,
      isExternalVideo: false,
      breadcrumbSummary: 'Elon explains Starlink beam cone geometry.',
    };

    store.pushBranch("Why can't Starlink serve dense cities?", clip1);

    const updated = usePlaybackStore.getState();
    expect(updated.callStack.length).toBe(1);

    const entry = updated.callStack[0];
    expect(entry.branchQuestionText).toBe("Why can't Starlink serve dense cities?");
    // 1455 - 2s rewind offset = 1453
    expect(entry.returnTimestamp).toBe(1453.0);
    expect(updated.activeAnswerClip).toEqual(clip1);
    expect(updated.isPipActive).toBe(false);
  });

  it('handles nested branches (Branch 1 -> Branch 2) in exact LIFO order', () => {
    const store = usePlaybackStore.getState();

    const clip1: AnswerClip = {
      videoId: 'Rni7Fz7208c',
      videoTitle: 'Musk x Kamath',
      channelTitle: 'Nikhil Kamath',
      startSec: 1661.0,
      endSec: 1731.0,
      isExternalVideo: false,
      breadcrumbSummary: 'Elon explains Starlink beam cone geometry.',
    };

    // First branch from 1455s
    store.pushBranch('Question 1', clip1);

    // Simulate playhead advancing in Branch 1 to 1690s, then asking a follow-up
    usePlaybackStore.setState({ currentTime: 1690.0 });

    const clip2: AnswerClip = {
      videoId: 'Rni7Fz7208c',
      videoTitle: 'Musk x Kamath',
      channelTitle: 'Nikhil Kamath',
      startSec: 2100.0,
      endSec: 2160.0,
      isExternalVideo: false,
      breadcrumbSummary: 'Elon discusses ground stations.',
    };

    usePlaybackStore.getState().pushBranch('Question 2 (Follow-up)', clip2);

    let state = usePlaybackStore.getState();
    expect(state.callStack.length).toBe(2);
    expect(state.callStack[0].returnTimestamp).toBe(1453.0);
    expect(state.callStack[1].returnTimestamp).toBe(1688.0); // 1690 - 2s
    expect(state.activeAnswerClip).toEqual(clip2);

    // Pop Branch 2 -> restores Branch 1 as active answer clip
    usePlaybackStore.getState().popBranch();
    state = usePlaybackStore.getState();
    expect(state.callStack.length).toBe(1);
    expect(state.activeAnswerClip).toEqual(clip1);

    // Pop Branch 1 -> restores Origin
    usePlaybackStore.getState().popBranch();
    state = usePlaybackStore.getState();
    expect(state.callStack.length).toBe(0);
    expect(state.activeAnswerClip).toBeNull();
  });

  it('returnToRoot directly clears all nested branches back to origin', () => {
    const store = usePlaybackStore.getState();

    const clip: AnswerClip = {
      videoId: 'Rni7Fz7208c',
      videoTitle: 'Musk x Kamath',
      channelTitle: 'Nikhil Kamath',
      startSec: 1661.0,
      endSec: 1731.0,
      isExternalVideo: false,
      breadcrumbSummary: 'Elon explains Starlink beam cone geometry.',
    };

    store.pushBranch('Question 1', clip);
    usePlaybackStore.setState({ currentTime: 1690.0 });
    usePlaybackStore.getState().pushBranch('Question 2', clip);

    expect(usePlaybackStore.getState().callStack.length).toBe(2);

    usePlaybackStore.getState().returnToRoot();

    const finalState = usePlaybackStore.getState();
    expect(finalState.callStack.length).toBe(0);
    expect(finalState.activeAnswerClip).toBeNull();
  });

  it('activates PiP player when answer clip is from an external video', () => {
    const store = usePlaybackStore.getState();

    const externalClip: AnswerClip = {
      videoId: 'external-video-99',
      videoTitle: 'Lex Fridman Podcast',
      channelTitle: 'Lex Fridman',
      startSec: 300.0,
      endSec: 360.0,
      isExternalVideo: true,
      breadcrumbSummary: 'Lex discusses satellite communication protocols.',
    };

    store.pushBranch('External inquiry', externalClip);

    const state = usePlaybackStore.getState();
    expect(state.isPipActive).toBe(true);
    expect(state.pipVideo).toEqual({
      videoId: 'external-video-99',
      startSec: 300.0,
      endSec: 360.0,
    });
  });
});

