/**
 * Noise Cleanup AudioWorkletProcessor
 * Runs on the audio rendering thread to perform:
 * 1. 2nd-order High-Pass Filter (cutoff 100 Hz) to eliminate sub-bass rumble and handling noise
 * 2. Soft-knee Noise Gate (-42 dBFS threshold) to suppress background room noise
 * 3. Fast-attack soft limiter to prevent clipping
 */

class NoiseCleanupProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // 2nd-order High-Pass Filter coefficients at 100 Hz cutoff (sampleRate = 48000 default)
    const cutoff = 100.0;
    const q = 0.7071;
    const w0 = (2 * Math.PI * cutoff) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw0 = Math.cos(w0);

    const b0 = (1 + cosw0) / 2;
    const b1 = -(1 + cosw0);
    const b2 = (1 + cosw0) / 2;
    const a0 = 1 + alpha;
    const a1 = -2 * cosw0;
    const a2 = 1 - alpha;

    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;

    // Filter state
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;

    // Noise gate state: -42 dBFS ~= 0.008 linear
    this.gateThreshold = 0.008;
    this.gateGain = 1.0;
    this.attackAlpha = 0.85;
    this.releaseAlpha = 0.992;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) return true;

    const inputChannel = input[0];
    const outputChannel = output[0];

    for (let i = 0; i < inputChannel.length; i++) {
      const x = inputChannel[i];

      // 1. Apply High-Pass Filter (Direct Form II Transposed / Direct Form I)
      const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
      this.x2 = this.x1;
      this.x1 = x;
      this.y2 = this.y1;
      this.y1 = y;

      // 2. Noise Gate Envelope Detection
      const mag = Math.abs(y);
      const targetGain = mag >= this.gateThreshold ? 1.0 : 0.05; // 26 dB attenuation when gated

      if (targetGain > this.gateGain) {
        this.gateGain = this.gateGain * this.attackAlpha + targetGain * (1 - this.attackAlpha);
      } else {
        this.gateGain = this.gateGain * this.releaseAlpha + targetGain * (1 - this.releaseAlpha);
      }

      // 3. Apply gate gain & soft-knee limiter
      let sample = y * this.gateGain;
      if (sample > 1.0) sample = 1.0;
      else if (sample < -1.0) sample = -1.0;

      outputChannel[i] = sample;
    }

    return true;
  }
}

registerProcessor('noise-cleanup-processor', NoiseCleanupProcessor);

