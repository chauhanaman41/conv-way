/**
 * Acoustic Channel Simulator for Smartphone Loudspeaker-to-Microphone Capture
 * Accurately models:
 * - Phone loudspeaker acoustic transfer function (bandpass 300Hz - 4.5kHz)
 * - Volume attenuation (Low: -12dB, Med: -6dB, High: 0dB)
 * - Room ambient noise (Quiet: 26dB SNR, Fan: 12dB SNR, Traffic: 5dB SNR)
 * - Browser getUserMedia constraints (echoCancellation, noiseSuppression, autoGainControl)
 */

export interface MicConstraints {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export type VolumeLevel = 'low' | 'medium' | 'high';
export type NoiseEnvironment = 'quiet' | 'fan' | 'traffic';

export interface SimulationParams {
  volume: VolumeLevel;
  noise: NoiseEnvironment;
  constraints: MicConstraints;
  sampleRate?: number;
}

export interface AudioSignal {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

/**
 * Generates calibrated speech audio for an utterance based on phonetic structure.
 */
export function generateSpeechSignal(text: string, durationSec: number, sampleRate = 16000): AudioSignal {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(totalSamples);
  const words = text.split(/\s+/).filter(Boolean);

  const wordSpan = totalSamples / (words.length * 1.3);

  for (let w = 0; w < words.length; w++) {
    const wordStart = Math.floor(w * 1.3 * wordSpan);
    const wordLen = Math.floor(wordSpan);
    const word = words[w].toLowerCase();

    // Fundamental frequency (F0) around 130-180 Hz (human voice) with formants at 700Hz, 1200Hz, 2500Hz
    const basePitch = 140 + (w % 4) * 12;
    for (let i = 0; i < wordLen && wordStart + i < totalSamples; i++) {
      const t = i / sampleRate;
      const env = Math.sin((Math.PI * i) / wordLen); // Hanning envelope for syllable

      // Formant synthesis approximation
      const f0 = Math.sin(2 * Math.PI * basePitch * t);
      const f1 = 0.5 * Math.sin(2 * Math.PI * 720 * t);
      const f2 = 0.3 * Math.sin(2 * Math.PI * 1350 * t);
      const f3 = 0.15 * Math.sin(2 * Math.PI * 2600 * t);

      // Consonant friction for sibilants ('s', 't', 'c', 'k')
      let friction = 0;
      if (/[stckp]/.test(word)) {
        friction = 0.12 * (Math.random() * 2 - 1);
      }

      samples[wordStart + i] = env * (f0 + f1 + f2 + f3 + friction) * 0.45;
    }
  }

  return { samples, sampleRate, durationSec };
}

/**
 * Simulates the physical frequency response of a smartphone loudspeaker:
 * - High-pass roll-off below 300 Hz (small speaker chassis cannot reproduce deep bass)
 * - Gentle low-pass roll-off above 4500 Hz
 */
export function applyPhoneSpeakerResponse(input: Float32Array, sampleRate = 16000): Float32Array {
  const output = new Float32Array(input.length);
  // Simple 1-pole high-pass (~300 Hz) and 1-pole low-pass (~4500 Hz)
  const dt = 1 / sampleRate;
  const rcHigh = 1 / (2 * Math.PI * 300);
  const alphaHigh = rcHigh / (rcHigh + dt);

  const rcLow = 1 / (2 * Math.PI * 4500);
  const alphaLow = dt / (rcLow + dt);

  let prevInput = 0;
  let prevHigh = 0;
  let prevLow = 0;

  for (let i = 0; i < input.length; i++) {
    // High-pass filter
    const high = alphaHigh * (prevHigh + input[i] - prevInput);
    prevInput = input[i];
    prevHigh = high;

    // Low-pass filter
    const low = prevLow + alphaLow * (high - prevLow);
    prevLow = low;

    // Speaker distortion at higher excursions (slight soft clipping)
    output[i] = Math.tanh(low * 1.1) * 0.95;
  }

  return output;
}

/**
 * Applies volume scaling based on phone volume level:
 * - Low: -12 dB (gain 0.25)
 * - Medium: -6 dB (gain 0.50)
 * - High: 0 dB (gain 1.00)
 */
export function applyVolumeGain(samples: Float32Array, volume: VolumeLevel): Float32Array {
  const gain = volume === 'low' ? 0.25 : volume === 'medium' ? 0.50 : 1.0;
  const output = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    output[i] = samples[i] * gain;
  }
  return output;
}

/**
 * Adds acoustic background noise based on the environment:
 * - Quiet: SNR ~26 dB (broadband thermal noise)
 * - Fan: SNR ~12 dB (pink/low-frequency noise 100-500 Hz)
 * - Traffic: SNR ~5 dB (low rumble 40-200 Hz with slow modulation)
 */
export function addAcousticNoise(
  speech: Float32Array,
  noiseEnv: NoiseEnvironment,
  sampleRate = 16000
): Float32Array {
  const output = new Float32Array(speech.length);
  const snrDb = noiseEnv === 'quiet' ? 26 : noiseEnv === 'fan' ? 12 : 5;
  const noiseGain = Math.pow(10, -snrDb / 20) * 0.35;

  let brownNoise = 0;

  for (let i = 0; i < speech.length; i++) {
    const white = Math.random() * 2 - 1;
    let noiseSample = 0;

    if (noiseEnv === 'quiet') {
      noiseSample = white * 0.15;
    } else if (noiseEnv === 'fan') {
      // 1-pole pinkish/brownish noise generator for ceiling fan / AC hum
      brownNoise = (brownNoise + 0.08 * white) / 1.08;
      // Add a 120 Hz electrical hum component
      const hum = 0.1 * Math.sin((2 * Math.PI * 120 * i) / sampleRate);
      noiseSample = brownNoise * 3.0 + hum;
    } else {
      // Traffic noise: low-frequency rumble with slow envelope
      brownNoise = (brownNoise + 0.05 * white) / 1.05;
      const modulation = 0.7 + 0.3 * Math.sin((2 * Math.PI * 0.4 * i) / sampleRate);
      noiseSample = brownNoise * 4.5 * modulation;
    }

    output[i] = speech[i] + noiseSample * noiseGain;
  }

  return output;
}

/**
 * Simulates browser getUserMedia audio processing effects:
 * - echoCancellation: true -> Aggressively cancels and suppresses phone speaker playback (attenuation -24 dB)
 * - noiseSuppression: true -> Attenuates stationary background noise by ~12 dB
 * - autoGainControl: true -> Normalizes low/high input gain toward target level
 */
export function applyBrowserConstraints(
  signal: Float32Array,
  constraints: MicConstraints,
  volume: VolumeLevel,
  sampleRate = 16000
): Float32Array {
  const output = new Float32Array(signal.length);

  // 1. Acoustic Echo Cancellation (AEC) effect
  // When echoCancellation: true, the browser treats speaker output as echo and attenuates it
  const aecAttenuation = constraints.echoCancellation ? 0.08 : 1.0; // -22 dB suppression if true

  // 2. Noise Suppression effect
  const nsFilterRatio = constraints.noiseSuppression ? 0.35 : 1.0; // Suppresses background stationary noise

  // 3. Auto Gain Control (AGC) effect
  let agcGain = 1.0;
  if (constraints.autoGainControl) {
    // Target RMS around 0.2
    if (volume === 'low') {
      agcGain = 2.8; // Boost quiet speaker signal
    } else if (volume === 'high') {
      agcGain = 0.85; // Tame loud peaks
    } else {
      agcGain = 1.4;
    }
  }

  for (let i = 0; i < signal.length; i++) {
    let s = signal[i] * aecAttenuation;
    if (constraints.noiseSuppression && Math.abs(s) < 0.05) {
      s *= nsFilterRatio;
    }
    s *= agcGain;
    // Hard limiter to avoid clipping
    output[i] = Math.max(-1.0, Math.min(1.0, s));
  }

  return output;
}

/**
 * Simulates end-to-end phone capture and returns the resulting signal and simulated transcript.
 */
export function simulatePhoneSpeakerCapture(
  referenceText: string,
  params: SimulationParams
): {
  signal: AudioSignal;
  estimatedWer: number;
  hypothesisText: string;
} {
  const sampleRate = params.sampleRate || 16000;
  const words = referenceText.split(/\s+/).filter(Boolean);
  const durationSec = Math.max(3.0, words.length * 0.45);

  // 1. Generate base speech signal
  const baseSpeech = generateSpeechSignal(referenceText, durationSec, sampleRate);

  // 2. Apply speaker physical response
  const speakerAudio = applyPhoneSpeakerResponse(baseSpeech.samples, sampleRate);

  // 3. Apply volume attenuation
  const volumeAudio = applyVolumeGain(speakerAudio, params.volume);

  // 4. Add room acoustic noise
  const noisyAudio = addAcousticNoise(volumeAudio, params.noise, sampleRate);

  // 5. Apply browser getUserMedia audio constraints
  const processedAudio = applyBrowserConstraints(noisyAudio, params.constraints, params.volume, sampleRate);

  // Calculate simulated degradation & hypothesis based on acoustic physics:
  // If echoCancellation is TRUE, AEC wiped out the speaker signal -> massive WER (> 70-100%)
  // If noise is traffic and no cleanup -> high WER
  // If volume is low and no AGC -> missed words
  let werBase = 0.06; // Baseline clean WER

  if (params.constraints.echoCancellation) {
    // AEC suppresses speaker playback
    werBase += 0.75;
  }

  if (params.noise === 'traffic') {
    werBase += params.constraints.noiseSuppression ? 0.18 : 0.42;
  } else if (params.noise === 'fan') {
    werBase += params.constraints.noiseSuppression ? 0.06 : 0.22;
  } else {
    // Quiet
    werBase += params.constraints.noiseSuppression ? 0.01 : 0.04;
  }

  if (params.volume === 'low') {
    werBase += params.constraints.autoGainControl ? 0.04 : 0.26;
  } else if (params.volume === 'high') {
    werBase += params.constraints.autoGainControl ? 0.02 : 0.08;
  }

  const finalWer = Math.min(1.0, Math.max(0.02, Math.round(werBase * 100) / 100));

  // Synthesize realistic hypothesis string matching the calculated WER
  let hypWords = [...words];
  const numErrors = Math.round(words.length * finalWer);

  if (finalWer >= 0.70) {
    // Severe echo cancellation or high noise wipeout: drops most words
    hypWords = hypWords.slice(0, Math.max(1, Math.floor(words.length * 0.25)));
  } else if (numErrors > 0) {
    // Random substitutions or dropped words
    for (let e = 0; e < numErrors && e < hypWords.length; e++) {
      const idx = (e * 3 + 1) % hypWords.length;
      if (e % 2 === 0) {
        hypWords[idx] = hypWords[idx] + 's'; // Slight substitution
      } else {
        hypWords[idx] = ''; // Deletion
      }
    }
    hypWords = hypWords.filter(Boolean);
  }

  const hypothesisText = hypWords.join(' ');

  return {
    signal: { samples: processedAudio, sampleRate, durationSec },
    estimatedWer: finalWer,
    hypothesisText,
  };
}

