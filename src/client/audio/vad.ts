/**
 * Light Energy-Based Voice Activity Detector (VAD)
 * 1. Analyzes short-time energy (RMS) across 20ms frames.
 * 2. Tracks an adaptive noise floor to maintain sensitivity at low volume (-12 dB).
 * 3. Applies a 300ms hangover timer to prevent clipping word endings and micro-pauses.
 * 4. Filters out silent pauses and background noise, transmitting only speech segments to Prisma.
 */

export interface VadOptions {
  frameSizeMs?: number;
  sampleRate?: number;
  snrThresholdMultiplier?: number;
  absoluteFloorThreshold?: number;
  hangoverFrames?: number;
}

export interface VadResult {
  speechSamples: Float32Array;
  speechDurationSec: number;
  totalDurationSec: number;
  creditsSavedPct: number;
  speechFrameRatio: number;
  activeSegmentCount: number;
}

export class EnergyVad {
  private sampleRate: number;
  private frameSizeSamples: number;
  private snrThresholdMultiplier: number;
  private absoluteFloorThreshold: number;
  private hangoverFrames: number;

  private noiseFloor: number;
  private hangoverCount: number;

  constructor(options: VadOptions = {}) {
    this.sampleRate = options.sampleRate || 16000;
    const frameSizeMs = options.frameSizeMs || 20; // 20ms frames
    this.frameSizeSamples = Math.floor((this.sampleRate * frameSizeMs) / 1000);
    this.snrThresholdMultiplier = options.snrThresholdMultiplier || 2.2;
    this.absoluteFloorThreshold = options.absoluteFloorThreshold || 0.005; // -46 dBFS
    this.hangoverFrames = options.hangoverFrames || 15; // 15 * 20ms = 300ms hangover

    this.noiseFloor = 0.005;
    this.hangoverCount = 0;
  }

  /**
   * Calculates Root Mean Square (RMS) energy of an audio frame.
   */
  public computeFrameRms(frame: Float32Array): number {
    let sumSq = 0;
    for (let i = 0; i < frame.length; i++) {
      sumSq += frame[i] * frame[i];
    }
    return Math.sqrt(sumSq / Math.max(1, frame.length));
  }

  /**
   * Processes a single audio frame and returns whether speech is active.
   */
  public isSpeechFrame(frame: Float32Array): boolean {
    const rms = this.computeFrameRms(frame);

    // Dynamic threshold relative to tracked noise floor
    const speechThreshold = Math.max(
      this.absoluteFloorThreshold,
      this.noiseFloor * this.snrThresholdMultiplier
    );

    const isAboveThreshold = rms > speechThreshold;

    if (isAboveThreshold) {
      this.hangoverCount = this.hangoverFrames;
      // Gently update noise floor downwards if we were overestimating
      this.noiseFloor = Math.max(0.002, this.noiseFloor * 0.999);
      return true;
    } else {
      // Adaptively track stationary background noise floor during pauses
      this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;

      if (this.hangoverCount > 0) {
        this.hangoverCount--;
        return true; // Still within hangover period
      }
      return false;
    }
  }

  /**
   * Filters an entire audio buffer, returning only speech segments with silence stripped.
   */
  public filterSpeechSegments(samples: Float32Array): VadResult {
    const totalDurationSec = samples.length / this.sampleRate;
    const numFrames = Math.floor(samples.length / this.frameSizeSamples);
    const speechFrameMask = new Uint8Array(numFrames);

    let activeSpeechFrames = 0;
    let inSpeech = false;
    let segmentCount = 0;

    // Reset state for clean pass
    this.noiseFloor = 0.005;
    this.hangoverCount = 0;

    for (let f = 0; f < numFrames; f++) {
      const start = f * this.frameSizeSamples;
      const end = start + this.frameSizeSamples;
      const frame = samples.subarray(start, end);

      const isSpeech = this.isSpeechFrame(frame);
      if (isSpeech) {
        speechFrameMask[f] = 1;
        activeSpeechFrames++;
        if (!inSpeech) {
          inSpeech = true;
          segmentCount++;
        }
      } else {
        inSpeech = false;
      }
    }

    if (activeSpeechFrames === 0) {
      return {
        speechSamples: new Float32Array(0),
        speechDurationSec: 0,
        totalDurationSec,
        creditsSavedPct: 100,
        speechFrameRatio: 0,
        activeSegmentCount: 0,
      };
    }

    // Assemble speech samples
    const totalSpeechSamples = activeSpeechFrames * this.frameSizeSamples;
    const speechSamples = new Float32Array(totalSpeechSamples);
    let writeOffset = 0;

    for (let f = 0; f < numFrames; f++) {
      if (speechFrameMask[f] === 1) {
        const start = f * this.frameSizeSamples;
        const end = start + this.frameSizeSamples;
        speechSamples.set(samples.subarray(start, end), writeOffset);
        writeOffset += this.frameSizeSamples;
      }
    }

    const speechDurationSec = totalSpeechSamples / this.sampleRate;
    const creditsSavedPct = Math.round(((totalDurationSec - speechDurationSec) / totalDurationSec) * 1000) / 10;
    const speechFrameRatio = Math.round((activeSpeechFrames / numFrames) * 1000) / 1000;

    return {
      speechSamples,
      speechDurationSec: Math.round(speechDurationSec * 100) / 100,
      totalDurationSec: Math.round(totalDurationSec * 100) / 100,
      creditsSavedPct,
      speechFrameRatio,
      activeSegmentCount: segmentCount,
    };
  }
}

