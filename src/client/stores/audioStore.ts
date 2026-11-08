import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';
import { usePlaybackStore } from './playbackStore';

export type AudioPipelineStatus = 'IDLE' | 'LISTENING' | 'RECORDING' | 'THINKING' | 'SPEAKING';

interface AudioState {
  status: AudioPipelineStatus;
  isMicAllowed: boolean;
  isAmbientActive: boolean;
  rmsLevel: number;
  liveTranscription: string;
  lastFinalQuestion: string | null;

  // Web Audio Context & Nodes
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  mediaStream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;
  recognition: any;

  // Actions
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleAmbientMode: () => Promise<void>;
  startPushToTalk: () => Promise<void>;
  stopPushToTalk: () => Promise<string | null>;
  setLiveTranscription: (text: string) => void;
  setStatus: (status: AudioPipelineStatus) => void;
  clearTranscript: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  status: 'IDLE',
  isMicAllowed: false,
  isAmbientActive: false,
  rmsLevel: 0,
  liveTranscription: '',
  lastFinalQuestion: null,

  audioContext: null,
  analyserNode: null,
  mediaStream: null,
  mediaRecorder: null,
  recognition: null,

  startListening: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

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
              set({ lastFinalQuestion: transcript.trim(), liveTranscription: transcript.trim() });
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
    const { isAmbientActive, startListening, stopListening } = get();
    if (isAmbientActive) {
      stopListening();
    } else {
      await startListening();
      set({ isAmbientActive: true });
    }
  },

  startPushToTalk: async () => {
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
      set({ status: 'IDLE' });
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
              const data = await res.json() as any;
              set({ status: 'IDLE', liveTranscription: data.transcript });
              resolve(data.transcript || null);
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
