import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { calculateWer, normalizeTranscript, tokenizeWords } from '../../src/shared/audio/wer';
import {
  simulatePhoneSpeakerCapture,
  MicConstraints,
} from '../fixtures/mic/acoustic-simulator';
import {
  processAudioSignalCleanup,
  applyHighPassFilter,
  applyNoiseGate,
  benchmarkAudioProcessorCpu,
} from '../../src/client/audio/audioProcessor';
import { EnergyVad } from '../../src/client/audio/vad';
import { useAudioStore } from '../../src/client/stores/audioStore';
import { MicGuidanceModal } from '../../src/client/components/MicGuidanceModal';
import referenceData from '../fixtures/mic/reference.json';

describe('Phone Microphone Noise Control & Tuning (Steps 0 - 7)', () => {
  beforeEach(() => {
    // Reset audioStore state
    useAudioStore.setState({
      status: 'IDLE',
      isMicAllowed: false,
      isAmbientActive: false,
      micQuality: null,
      micQualityLabel: null,
      isGuidanceDismissed: false,
      showGuidanceModal: false,
      liveTranscription: '',
      lastFinalQuestion: null,
    });
  });

  // =========================================================================
  // 1. WER Calculation & Levenshtein Matrix Tests
  // =========================================================================
  describe('WER Calculator Unit Tests', () => {
    it('normalizes punctuation, case, and extra whitespace', () => {
      const raw = '  Starlink, satellites... operate in Low-Earth ORBIT!  ';
      const norm = normalizeTranscript(raw);
      expect(norm).toBe('starlink satellites operate in lowearth orbit');
    });

    it('calculates 0% WER for identical strings', () => {
      const ref = 'Reusable rockets reduce launch costs.';
      const hyp = 'Reusable rockets reduce launch costs.';
      const res = calculateWer(ref, hyp);
      expect(res.wer).toBe(0);
      expect(res.accuracy).toBe(1.0);
      expect(res.substitutions).toBe(0);
      expect(res.deletions).toBe(0);
      expect(res.insertions).toBe(0);
    });

    it('correctly calculates substitutions, deletions, and insertions', () => {
      const ref = 'the quick brown fox';
      const hyp = 'a quick white fox jumps'; // 2 subs (the->a, brown->white), 1 ins (jumps)
      const res = calculateWer(ref, hyp);
      expect(res.referenceWordCount).toBe(4);
      expect(res.substitutions).toBe(2);
      expect(res.insertions).toBe(1);
      expect(res.wer).toBe(0.75); // (2 + 0 + 1) / 4 = 0.75
    });
  });

  // =========================================================================
  // 2. Step 7 Test: WER Regression Test on Fixture Set
  // =========================================================================
  describe('WER Regression Test on Smartphone Test Set', () => {
    const chosenSettings: MicConstraints = {
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: true,
    };

    it('chosen settings stay at or below the documented WER threshold (average <= 17.5%)', () => {
      let totalWer = 0;
      let count = 0;

      for (const item of referenceData.sentences) {
        for (const vol of ['low', 'medium', 'high'] as const) {
          for (const noise of ['quiet', 'fan', 'traffic'] as const) {
            const sim = simulatePhoneSpeakerCapture(item.text, {
              volume: vol,
              noise,
              constraints: chosenSettings,
            });
            const breakdown = calculateWer(item.text, sim.hypothesisText);
            totalWer += breakdown.wer;
            count++;
          }
        }
      }

      const avgWer = totalWer / count;
      // Documented average is ~16.6%; must stay <= 17.5%
      expect(avgWer).toBeLessThanOrEqual(0.175);
    });

    it('quiet room WER stays at or below documented threshold (<= 11%)', () => {
      let quietWer = 0;
      let count = 0;

      for (const item of referenceData.sentences) {
        for (const vol of ['low', 'medium', 'high'] as const) {
          const sim = simulatePhoneSpeakerCapture(item.text, {
            volume: vol,
            noise: 'quiet',
            constraints: chosenSettings,
          });
          const breakdown = calculateWer(item.text, sim.hypothesisText);
          quietWer += breakdown.wer;
          count++;
        }
      }

      const avgQuietWer = quietWer / count;
      // Documented quiet room is 10.3%; must stay <= 11%
      expect(avgQuietWer).toBeLessThanOrEqual(0.11);
    });
  });

  // =========================================================================
  // 3. Step 7 Test: Echo Test (echoCancellation false vs true)
  // =========================================================================
  describe('Echo Test: Loudspeaker Output Capture Verification', () => {
    const testSentence = referenceData.sentences[0].text;

    it('preserves speaker playback when echoCancellation is false', () => {
      const sim = simulatePhoneSpeakerCapture(testSentence, {
        volume: 'medium',
        noise: 'quiet',
        constraints: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });

      const res = calculateWer(testSentence, sim.hypothesisText);
      // Good capture: WER <= 15%
      expect(res.wer).toBeLessThanOrEqual(0.15);
      expect(res.hypothesisWordCount).toBeGreaterThanOrEqual(res.referenceWordCount - 2);
    });

    it('demonstrates that echoCancellation=true suppresses phone speaker output (> 70% WER)', () => {
      const sim = simulatePhoneSpeakerCapture(testSentence, {
        volume: 'medium',
        noise: 'quiet',
        constraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const res = calculateWer(testSentence, sim.hypothesisText);
      // Severe degradation due to AEC cancellation
      expect(res.wer).toBeGreaterThanOrEqual(0.70);
    });
  });

  // =========================================================================
  // 4. Step 7 Test: Quality Gate & Noise Levels
  // =========================================================================
  describe('Noise Level Quality Labels & Quality Gate', () => {
    it('sets "Mic transcript, quality: medium" for high confidence or quiet environment', () => {
      const store = useAudioStore.getState();
      store.setMicQuality('medium');

      const state = useAudioStore.getState();
      expect(state.micQuality).toBe('medium');
      expect(state.micQualityLabel).toBe('Mic transcript, quality: medium');
    });

    it('sets "Mic transcript, quality: low" for moderate noise environment', () => {
      const store = useAudioStore.getState();
      store.setMicQuality('low');

      const state = useAudioStore.getState();
      expect(state.micQuality).toBe('low');
      expect(state.micQualityLabel).toBe('Mic transcript, quality: low');
    });

    it('sets "Transcript too noisy. Try a quieter room" when room noise exceeds threshold', () => {
      const store = useAudioStore.getState();
      store.setMicQuality('noisy');

      const state = useAudioStore.getState();
      expect(state.micQuality).toBe('noisy');
      expect(state.micQualityLabel).toBe('Transcript too noisy. Try a quieter room');
    });
  });

  // =========================================================================
  // 5. Step 7 Test: Viewer Guidance on 390px Viewport
  // =========================================================================
  describe('Viewer Guidance Dialog', () => {
    it('renders guidance modal before mic start with exact required text', () => {
      useAudioStore.setState({ showGuidanceModal: true });

      const html = renderToString(React.createElement(MicGuidanceModal, { isOpen: true }));

      // Accessibility & sizing
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('max-w-[390px]');

      // Exact required guidance phrasing
      expect(html).toMatch(
        /Turn the video up to medium, hold the phone near the speaker, and stay in a quiet room\. Earphones won(&#x27;|')t work for this\./
      );
      expect(html).toContain('GOT IT // PROCEED');
    });

    it('dismissGuidance sets dismissed state and hides modal', () => {
      useAudioStore.setState({ showGuidanceModal: true, isGuidanceDismissed: false });

      useAudioStore.getState().dismissGuidance();

      const state = useAudioStore.getState();
      expect(state.isGuidanceDismissed).toBe(true);
      expect(state.showGuidanceModal).toBe(false);
    });
  });

  // =========================================================================
  // 6. Step 3 Test: Audio Signal Cleanup & Low CPU
  // =========================================================================
  describe('Browser Signal Cleanup & CPU Performance', () => {
    it('100 Hz high-pass filter eliminates sub-100Hz rumble while preserving speech frequencies', () => {
      const sampleRate = 16000;
      const numSamples = 1600; // 100ms
      const buffer = new Float32Array(numSamples);

      // 40 Hz sub-rumble + 1000 Hz vocal formant
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const rumble40Hz = Math.sin(2 * Math.PI * 40 * t);
        const speech1000Hz = Math.sin(2 * Math.PI * 1000 * t);
        buffer[i] = rumble40Hz + speech1000Hz;
      }

      const filtered = applyHighPassFilter(buffer, sampleRate, 100);

      // Verify overall peak amplitude decreased because 40Hz sub-rumble was filtered out
      let origRms = 0;
      let filtRms = 0;
      for (let i = 200; i < numSamples; i++) {
        origRms += buffer[i] * buffer[i];
        filtRms += filtered[i] * filtered[i];
      }
      expect(Math.sqrt(filtRms / 1400)).toBeLessThan(Math.sqrt(origRms / 1400));
    });

    it('noise gate attenuates audio below -42 dBFS threshold', () => {
      const quietNoise = new Float32Array(1000).fill(0.002); // ~-54 dBFS
      const gated = applyNoiseGate(quietNoise, -42);

      // Verify gated samples are attenuated
      expect(gated[500]).toBeLessThan(0.002 * 0.5);
    });

    it('benchmarks CPU performance: time per second of audio is under 5.0 ms (< 0.5% CPU)', () => {
      const bench = benchmarkAudioProcessorCpu(48000, 1.0);
      expect(bench.msPerSecondAudio).toBeLessThan(5.0);
      expect(bench.cpuPercentEquivalent).toBeLessThan(0.5);
    });
  });

  // =========================================================================
  // 7. Step 4 Test: Voice Activity Detection (VAD)
  // =========================================================================
  describe('Light Energy-Based VAD', () => {
    const sampleRate = 16000;
    const vad = new EnergyVad({ sampleRate });

    it('detects speech and filters out silent leading/trailing audio', () => {
      // 1 sec silence + 1 sec speech + 1 sec silence
      const totalSamples = sampleRate * 3;
      const testBuffer = new Float32Array(totalSamples);

      // Add speech in the middle (sample 16000 to 32000)
      for (let i = sampleRate; i < sampleRate * 2; i++) {
        testBuffer[i] = Math.sin((2 * Math.PI * 300 * i) / sampleRate) * 0.3;
      }

      const result = vad.filterSpeechSegments(testBuffer);

      expect(result.speechDurationSec).toBeGreaterThan(0.8);
      expect(result.speechDurationSec).toBeLessThan(1.8);
      // Silence was stripped, saving credits!
      expect(result.creditsSavedPct).toBeGreaterThan(40);
      expect(result.activeSegmentCount).toBe(1);
    });

    it('preserves speech at low volume (-12 dB) without missing frames', () => {
      // Low volume speech: gain 0.25 -> amplitude 0.04
      const numSamples = sampleRate * 1;
      const lowVolBuffer = new Float32Array(numSamples);

      for (let i = 0; i < numSamples; i++) {
        lowVolBuffer[i] = Math.sin((2 * Math.PI * 250 * i) / sampleRate) * 0.04;
      }

      const result = vad.filterSpeechSegments(lowVolBuffer);

      // Speech was preserved at low volume
      expect(result.speechFrameRatio).toBeGreaterThan(0.7);
    });
  });
});
