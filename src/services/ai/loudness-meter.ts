import type { LoudnessResult } from '@/types/ai';

/**
 * Simplified ITU-R BS.1770 loudness measurement.
 * K-weighting is approximated with a high-shelf boost and high-pass filter.
 */
export function calculateLUFS(buffer: AudioBuffer): LoudnessResult {
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);

  // Apply K-weighting approximation in-place on a copy
  const weighted = applyKWeighting(data, sampleRate);

  // 400ms window for momentary loudness
  const momentaryWindowSamples = Math.floor(sampleRate * 0.4);
  // 3s window for short-term loudness
  const shortTermWindowSamples = Math.floor(sampleRate * 3);

  // Calculate momentary loudness (last 400ms or full buffer if shorter)
  const momentaryStart = Math.max(0, weighted.length - momentaryWindowSamples);
  const momentary = windowLoudness(weighted, momentaryStart, weighted.length);

  // Calculate short-term loudness (last 3s or full buffer if shorter)
  const shortTermStart = Math.max(0, weighted.length - shortTermWindowSamples);
  const shortTerm = windowLoudness(weighted, shortTermStart, weighted.length);

  // Integrated loudness with gating (BS.1770 algorithm)
  const integrated = gatedLoudness(weighted, momentaryWindowSamples);

  // Loudness range (LRA) — difference between 10th and 95th percentile
  const range = calculateLRA(weighted, shortTermWindowSamples);

  // True peak via 4x oversampling
  const truePeak = calculateTruePeak(buffer);

  return { integrated, shortTerm, momentary, range, truePeak };
}

function applyKWeighting(data: Float32Array, sampleRate: number): Float32Array {
  const out = new Float32Array(data.length);

  // High-shelf filter: +4 dB above ~1681 Hz (simplified biquad)
  const fc = 1681;
  const gainDb = 4;
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / 2 * Math.sqrt((A + 1 / A) * 2);

  const b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha);
  const b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
  const b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha);
  const a0 = (A + 1) - (A - 1) * cosw0 + 2 * Math.sqrt(A) * alpha;
  const a1 = 2 * ((A - 1) - (A + 1) * cosw0);
  const a2 = (A + 1) - (A - 1) * cosw0 - 2 * Math.sqrt(A) * alpha;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i]!;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }

  // High-pass filter at 38 Hz (second stage of K-weighting)
  const hpFc = 38;
  const hpW0 = (2 * Math.PI * hpFc) / sampleRate;
  const hpCos = Math.cos(hpW0);
  const hpAlpha = Math.sin(hpW0) / (2 * 0.5);

  const hpB0 = (1 + hpCos) / 2;
  const hpB1 = -(1 + hpCos);
  const hpB2 = (1 + hpCos) / 2;
  const hpA0 = 1 + hpAlpha;
  const hpA1 = -2 * hpCos;
  const hpA2 = 1 - hpAlpha;

  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  for (let i = 0; i < out.length; i++) {
    const x = out[i]!;
    const y = (hpB0 * x + hpB1 * x1 + hpB2 * x2 - hpA1 * y1 - hpA2 * y2) / hpA0;
    out[i] = y;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
  }

  return out;
}

function windowLoudness(data: Float32Array, start: number, end: number): number {
  let sum = 0;
  const len = end - start;
  if (len <= 0) return -Infinity;
  for (let i = start; i < end; i++) {
    sum += data[i]! * data[i]!;
  }
  const meanSquare = sum / len;
  return meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity;
}

function gatedLoudness(data: Float32Array, windowSize: number): number {
  const hop = Math.floor(windowSize * 0.75);
  const windowLoudnessValues: number[] = [];

  for (let i = 0; i + windowSize <= data.length; i += hop) {
    const l = windowLoudness(data, i, i + windowSize);
    windowLoudnessValues.push(l);
  }

  if (windowLoudnessValues.length === 0) return -Infinity;

  // Absolute gate at -70 LUFS
  const aboveAbsolute = windowLoudnessValues.filter((l) => l > -70);
  if (aboveAbsolute.length === 0) return -Infinity;

  // Calculate ungated mean
  const ungatedMean =
    -0.691 +
    10 *
      Math.log10(
        aboveAbsolute.reduce(
          (s, l) => s + Math.pow(10, (l + 0.691) / 10),
          0,
        ) / aboveAbsolute.length,
      );

  // Relative gate at ungated mean - 10 LUFS
  const relativeThreshold = ungatedMean - 10;
  const aboveRelative = aboveAbsolute.filter((l) => l > relativeThreshold);
  if (aboveRelative.length === 0) return -Infinity;

  return (
    -0.691 +
    10 *
      Math.log10(
        aboveRelative.reduce(
          (s, l) => s + Math.pow(10, (l + 0.691) / 10),
          0,
        ) / aboveRelative.length,
      )
  );
}

function calculateLRA(data: Float32Array, windowSize: number): number {
  const hop = Math.floor(windowSize * 0.75);
  const values: number[] = [];

  for (let i = 0; i + windowSize <= data.length; i += hop) {
    const l = windowLoudness(data, i, i + windowSize);
    if (l > -70) values.push(l);
  }

  if (values.length < 2) return 0;
  values.sort((a, b) => a - b);

  const p10 = values[Math.floor(values.length * 0.1)]!;
  const p95 = values[Math.floor(values.length * 0.95)]!;
  return Math.max(0, p95 - p10);
}

export function calculateTruePeak(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let maxPeak = 0;

  // 4x oversampling via linear interpolation (simplified)
  for (let i = 0; i < data.length - 1; i++) {
    const s0 = Math.abs(data[i]!);
    if (s0 > maxPeak) maxPeak = s0;
    // Check interpolated samples
    for (let j = 1; j <= 3; j++) {
      const t = j / 4;
      const interp = Math.abs(data[i]! * (1 - t) + data[i + 1]! * t);
      if (interp > maxPeak) maxPeak = interp;
    }
  }
  // Check last sample
  const last = Math.abs(data[data.length - 1]!);
  if (last > maxPeak) maxPeak = last;

  return maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;
}
