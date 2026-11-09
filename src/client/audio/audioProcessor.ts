/**
 * Browser Audio Signal Cleanup Pipeline
 * 1. High-Pass Filter (~100 Hz cutoff): Eliminates sub-100Hz HVAC and chassis rumble
 * 2. Loudness Normalizer: Scales quiet speaker levels to target digital RMS (-16 LUFS)
 * 3. Soft-Knee Noise Gate: Suppresses background noise during pauses
 */

export interface CleanupOptions {
  sampleRate?: number;
  highpassCutoffHz?: number;
  gateThresholdDb?: number;
  targetRms?: number;
}

/**
 * 2nd-order Butterworth High-Pass Filter implementation (100 Hz cutoff).
 */
export function applyHighPassFilter(
  samples: Float32Array,
  sampleRate = 16000,
  cutoffHz = 100
): Float32Array {
  const output = new Float32Array(samples.length);

  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const q = 0.7071;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw0 = Math.cos(w0);

  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;

  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = nb0 * x + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[i] = y;
  }

  return output;
}

/**
 * Soft-knee noise gate (-42 dBFS threshold) that suppresses stationary ambient noise.
 */
export function applyNoiseGate(
  samples: Float32Array,
  thresholdDb = -42
): Float32Array {
  const thresholdLinear = Math.pow(10, thresholdDb / 20); // ~0.0079
  const output = new Float32Array(samples.length);

  let gateGain = 1.0;
  const attackAlpha = 0.85;
  const releaseAlpha = 0.995;

  for (let i = 0; i < samples.length; i++) {
    const mag = Math.abs(samples[i]);
    const targetGain = mag >= thresholdLinear ? 1.0 : 0.08; // -22 dB attenuation when closed

    if (targetGain > gateGain) {
      gateGain = gateGain * attackAlpha + targetGain * (1 - attackAlpha);
    } else {
      gateGain = gateGain * releaseAlpha + targetGain * (1 - releaseAlpha);
    }

    output[i] = samples[i] * gateGain;
  }

  return output;
}

/**
 * Loudness normalization: normalizes audio RMS to target nominal level (~0.18) with soft limiting.
 */
export function applyLoudnessNormalization(
  samples: Float32Array,
  targetRms = 0.18
): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  const currentRms = Math.sqrt(sumSq / Math.max(1, samples.length));

  if (currentRms < 0.001) return new Float32Array(samples); // Near silence

  const gainFactor = Math.min(4.0, targetRms / currentRms);
  const output = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    const scaled = samples[i] * gainFactor;
    // Soft knee limiter
    output[i] = Math.tanh(scaled);
  }

  return output;
}

/**
 * Full signal cleanup chain: High-pass filter -> Loudness normalization -> Noise gate.
 */
export function processAudioSignalCleanup(
  samples: Float32Array,
  options: CleanupOptions = {}
): Float32Array {
  const sampleRate = options.sampleRate || 16000;
  const cutoffHz = options.highpassCutoffHz || 100;
  const thresholdDb = options.gateThresholdDb || -42;
  const targetRms = options.targetRms || 0.18;

  // 1. High-Pass Filter (removes rumble below 100 Hz)
  const filtered = applyHighPassFilter(samples, sampleRate, cutoffHz);

  // 2. Loudness Normalization
  const normalized = applyLoudnessNormalization(filtered, targetRms);

  // 3. Noise Gate
  const gated = applyNoiseGate(normalized, thresholdDb);

  return gated;
}

/**
 * Benchmarks DSP execution time in milliseconds per 1.0 second of audio.
 */
export function benchmarkAudioProcessorCpu(sampleRate = 48000, durationSec = 1.0): {
  msPerSecondAudio: number;
  cpuPercentEquivalent: number;
} {
  const numSamples = Math.floor(sampleRate * durationSec);
  const testBuffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    testBuffer[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.3;
  }

  const start = performance.now();
  // Run 10 iterations to get a stable benchmark
  const iterations = 10;
  for (let iter = 0; iter < iterations; iter++) {
    processAudioSignalCleanup(testBuffer, { sampleRate });
  }
  const elapsedMs = performance.now() - start;
  const avgMsPerSec = elapsedMs / iterations / durationSec;
  // Percentage of real-time: (avgMsPerSec / 1000) * 100
  const cpuPercentEquivalent = Math.round((avgMsPerSec / 10) * 100) / 100;

  return {
    msPerSecondAudio: Math.round(avgMsPerSec * 100) / 100,
    cpuPercentEquivalent,
  };
}

/**
 * Builds the Web Audio API processing graph for live microphone streams in the browser.
 */
export function attachBrowserAudioCleanup(
  audioCtx: AudioContext,
  sourceNode: MediaStreamAudioSourceNode
): {
  processedSource: AudioNode;
  highpassFilter: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
} {
  // 1. 100 Hz High-Pass BiquadFilter
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.setValueAtTime(100, audioCtx.currentTime);
  highpass.Q.setValueAtTime(0.7071, audioCtx.currentTime);

  // 2. Dynamics Compressor for loudness normalization and noise gating
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-36, audioCtx.currentTime);
  compressor.knee.setValueAtTime(10, audioCtx.currentTime);
  compressor.ratio.setValueAtTime(4, audioCtx.currentTime);
  compressor.attack.setValueAtTime(0.01, audioCtx.currentTime);
  compressor.release.setValueAtTime(0.15, audioCtx.currentTime);

  // Connect source -> Highpass -> Compressor
  sourceNode.connect(highpass);
  highpass.connect(compressor);

  return {
    processedSource: compressor,
    highpassFilter: highpass,
    compressor,
  };
}

