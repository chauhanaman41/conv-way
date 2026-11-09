import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';
import { usePlaybackStore } from './playbackStore';
import { attachBrowserAudioCleanup } from '../audio/audioProcessor';

export type AudioPipelineStatus = 'IDLE' | 'LISTENING' | 'RECORDING' | 'THINKING' | 'SPEAKING';
export type MicQuality = 'medium' | 'low' | 'noisy';

interface AudioState {
  status: AudioPipelineStatus;
  isMicAllowed: boolean;
  isAmbientActive: boolean;
  rmsLevel: number;
  liveTranscription: string;
  lastFinalQuestion: string | null;

  // Mic Quality Gate & Measurement
  micQuality: MicQuality | null;
  micQualityLabel: string | null;
  isGuidanceDismissed: boolean;
  showGuidanceModal: boolean;

  // Web Audio Context & Nodes
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  mediaStream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;
  recognition: any;
  onFinalUtterance: ((text: string) => void) | null;

  // Actions
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleAmbientMode: () => Promise<void>;
  startPushToTalk: () => Promise<void>;
  stopPushToTalk: () => Promise<string | null>;
  setLiveTranscription: (text: string) => void;
  setStatus: (status: AudioPipelineStatus) => void;
  clearTranscript: () => void;
  setOnFinalUtterance: (fn: ((text: string) => void) | null) => void;
  dismissGuidance: () => void;
  setShowGuidanceModal: (show: boolean) => void;
  setMicQuality: (quality: MicQuality | null, label?: string | null) => void;
}

const getStoredGuidanceDismissed = (): boolean => {
  try {
    return sessionStorage.getItem('conv_way_mic_guidance_dismissed') === 'true';
  } catch {
    return false;
  }
};

export const useAudioStore = create<AudioState>((set, get) => ({
  status: 'IDLE',
  isMicAllowed: false,
  isAmbientActive: false,
  rmsLevel: 0,
  liveTranscription: '',
  lastFinalQuestion: null,

  micQuality: null,
  micQualityLabel: null,
  isGuidanceDismissed: getStoredGuidanceDismissed(),
  showGuidanceModal: false,

  audioContext: null,
  analyserNode: null,
  mediaStream: null,
  mediaRecorder: null,
  recognition: null,
  onFinalUtterance: null,

  setOnFinalUtterance: (fn) => set({ onFinalUtterance: fn }),

  dismissGuidance: () => {
    try {
      sessionStorage.setItem('conv_way_mic_guidance_dismissed', 'true');
    } catch {}
    set({ isGuidanceDismissed: true, showGuidanceModal: false });
  },

  setShowGuidanceModal: (showGuidanceModal) => set({ showGuidanceModal }),

  setMicQuality: (micQuality, label) =>
    set({
      micQuality,
      micQualityLabel:
        label !== undefined
          ? label
          : micQuality === 'medium'
          ? 'Mic transcript, quality: medium'
          : micQuality === 'low'
          ? 'Mic transcript, quality: low'
          : micQuality === 'noisy'
          ? 'Transcript too noisy. Try a quieter room'
          : null,
    }),

  startListening: async () => {
    try {
      // Step 2 & Owner Decisions:
      // echoCancellation MUST BE FALSE to capture phone speaker playback without AEC suppression.
      // noiseSuppression and autoGainControl MUST BE TRUE to control ambient noise and level fluctuations.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);

      // Step 3: Signal cleanup in browser (100 Hz high-pass filter + dynamics compressor)
      const cleanup = attachBrowserAudioCleanup(audioCtx, source);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      cleanup.processedSource.connect(analyser);

      // Start RMS monitoring loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkAudio = () => {
        if (!get().isMicAllowed) return;
        analyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        set({ rmsLevel: Math.min(1.0, rms * 3.5) });

        // Dynamic audio ducking / auto-pause trigger
        const { audioDuckingMode } = useSettingsStore.getState();
        const { playerRef, isPlaying, volume } = usePlaybackStore.getState();

        if (rms > 0.12 && isPlaying && playerRef) {
          if (audioDuckingMode === 'duck' && volume > 20) {
            if (typeof playerRef.setVolume === 'function') {
              playerRef.setVolume(18);
            }
          } else if (audioDuckingMode === 'pause') {
            if (typeof playerRef.pauseVideo === 'function') {
              playerRef.pauseVideo();
            }
          }
        }

        requestAnimationFrame(checkAudio);
      };
      requestAnimationFrame(checkAudio);

      // Setup Native Web Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      let recognitionInstance: any = null;
      if (SpeechRecognition) {
        recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        const currentLang = useSettingsStore.getState().uiLanguage;
        recognitionInstance.lang = currentLang === 'en' ? 'en-US' : `${currentLang}-IN`;

        recognitionInstance.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              const text = transcript.trim();
              set({ lastFinalQuestion: text, liveTranscription: text });
              const { onFinalUtterance, isAmbientActive } = get();
              if (onFinalUtterance && isAmbientActive && text.length > 2) {
                onFinalUtterance(text);
              }
            } else {
              interim += transcript;
            }
          }
          if (interim) {
            set({ liveTranscription: interim });
          }
        };

        recognitionInstance.onerror = (e: any) => {
          console.warn('[AudioStore] Speech recognition error:', e.error);
        };

        try {
          recognitionInstance.start();
        } catch {}
      }

      set({
        mediaStream: stream,
        audioContext: audioCtx,
        analyserNode: analyser,
        recognition: recognitionInstance,
        isMicAllowed: true,
        status: 'LISTENING',
      });
    } catch (err) {
      console.warn('[AudioStore] Microphone access denied or unavailable:', err);
      set({ isMicAllowed: false, status: 'IDLE' });
    }
  },

  stopListening: () => {
    const { mediaStream, audioContext, recognition } = get();
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }
    if (recognition) {
      try {
        recognition.stop();
      } catch {}
    }

    // Restore volume
    const { playerRef } = usePlaybackStore.getState();
    if (playerRef && typeof playerRef.setVolume === 'function') {
      playerRef.setVolume(100);
    }

    set({
      mediaStream: null,
      audioContext: null,
      analyserNode: null,
      recognition: null,
      isMicAllowed: false,
      isAmbientActive: false,
      status: 'IDLE',
      rmsLevel: 0,
    });
  },

  toggleAmbientMode: async () => {
    const { isAmbientActive, startListening, stopListening, isGuidanceDismissed } = get();
    if (!isGuidanceDismissed) {
      set({ showGuidanceModal: true });
      return;
    }

    if (isAmbientActive) {
      stopListening();
    } else {
      await startListening();
      set({ isAmbientActive: true });
    }
  },

  startPushToTalk: async () => {
    if (!get().isGuidanceDismissed) {
      set({ showGuidanceModal: true });
      return;
    }

    let stream = get().mediaStream;
    if (!stream) {
      await get().startListening();
      stream = get().mediaStream;
    }

    if (stream) {
      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        (recorder as any)._chunks = chunks;
        recorder.start();
        set({ mediaRecorder: recorder, status: 'RECORDING', liveTranscription: '' });
      } catch (e) {
        console.warn('[AudioStore] MediaRecorder init error:', e);
      }
    }
  },

  stopPushToTalk: async (): Promise<string | null> => {
    const state = get();
    set({ status: 'THINKING' });

    // Restore volume
    const { playerRef } = usePlaybackStore.getState();
    if (playerRef && typeof playerRef.setVolume === 'function') {
      playerRef.setVolume(100);
    }

    // Check if native speech recognition already caught a transcription
    if (state.liveTranscription && state.liveTranscription.trim().length > 3) {
      const q = state.liveTranscription.trim();
      set({
        status: 'IDLE',
        micQuality: 'medium',
        micQualityLabel: 'Mic transcript, quality: medium',
      });
      return q;
    }

    // If native speech recognition returned nothing, transcribe recorded blob via Gnani Prisma
    const recorder = state.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      return new Promise<string | null>((resolve) => {
        recorder.onstop = async () => {
          const chunks = (recorder as any)._chunks || [];
          if (chunks.length === 0) {
            set({ status: 'IDLE' });
            resolve(null);
            return;
          }

          const blob = new Blob(chunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', blob, 'speech.webm');
          formData.append('language', `${useSettingsStore.getState().uiLanguage}-IN`);

          try {
            const res = await fetch('/api/voice/transcribe', {
              method: 'POST',
              body: formData,
            });
            if (res.ok) {
              const data = (await res.json()) as any;
              const text = (data.transcript || '').trim();
              const conf = typeof data.confidence === 'number' ? data.confidence : null;

              let quality: MicQuality = 'medium';
              let label = 'Mic transcript, quality: medium';

              // Step 5: Quality Gate
              // Use Prisma's confidence values to drop low-confidence segments.
              // If confidence is not returned, use measured WER / word count threshold.
              if (conf !== null) {
                if (conf >= 0.75) {
                  quality = 'medium';
                  label = 'Mic transcript, quality: medium';
                } else if (conf >= 0.45) {
                  quality = 'low';
                  label = 'Mic transcript, quality: low';
                } else {
                  quality = 'noisy';
                  label = 'Transcript too noisy. Try a quieter room';
                }
              } else {
                const words = text.split(/\s+/).filter(Boolean);
                if (words.length < 2 || text.length < 5) {
                  quality = 'noisy';
                  label = 'Transcript too noisy. Try a quieter room';
                } else if (words.length <= 4) {
                  quality = 'low';
                  label = 'Mic transcript, quality: low';
                } else {
                  quality = 'medium';
                  label = 'Mic transcript, quality: medium';
                }
              }

              if (quality === 'noisy') {
                // If measured WER / confidence indicates noisy room, do NOT produce answers from it
                set({
                  status: 'IDLE',
                  micQuality: 'noisy',
                  micQualityLabel: label,
                  liveTranscription: '',
                });
                resolve(null);
                return;
              }

              set({
                status: 'IDLE',
                micQuality: quality,
                micQualityLabel: label,
                liveTranscription: text,
              });
              resolve(text || null);
              return;
            }
          } catch (e) {
            console.warn('[AudioStore] Prisma fallback failed:', e);
          }
          set({ status: 'IDLE' });
          resolve(null);
        };
        recorder.stop();
      });
    }

    set({ status: 'IDLE' });
    return null;
  },

  setLiveTranscription: (text) => set({ liveTranscription: text }),
  setStatus: (status) => set({ status }),
  clearTranscript: () => set({ liveTranscription: '', lastFinalQuestion: null }),
}));

