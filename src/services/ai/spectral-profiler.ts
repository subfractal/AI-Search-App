/**
 * Spectral Profiler — extracts advanced spectral features from AudioBuffer.
 * Used by track classifier and Omni-Spectral Matrix.
 * Reuses FFT approach from analysis-engine.ts.
 */

import type { SpectralProfile } from '@/types/commands';

function computeFFTMagnitudes(
  buffer: AudioBuffer,
  fftSize: number = 4096,
): { magnitudes: Float32Array; binHz: number } {
  const data = buffer.getChannelData(0);
  const n = Math.min(data.length, fftSize);
  const real = new Float32Array(n);
  const imag = new Float32Array(n);

  // Hann window
  for (let i = 0; i < n; i++) {
    real[i] = data[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  }

  // Simple DFT (matching analysis-engine approach)
  const outReal = new Float32Array(n);
  const outImag = new Float32Array(n);
  const step = Math.max(1, Math.floor(n / 512));

  for (let k = 0; k < n / 2; k++) {
    let sr = 0;
    let si = 0;
    for (let t = 0; t < n; t += step) {
      const angle = (2 * Math.PI * k * t) / n;
      sr += real[t]! * Math.cos(angle) + imag[t]! * Math.sin(angle);
      si += -real[t]! * Math.sin(angle) + imag[t]! * Math.cos(angle);
    }
    outReal[k] = sr;
    outImag[k] = si;
  }

  const half = n / 2;
  const magnitudes = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    magnitudes[i] = Math.sqrt(outReal[i]! * outReal[i]! + outImag[i]! * outImag[i]!);
  }

  return { magnitudes, binHz: buffer.sampleRate / n };
}

/**
 * Spectral centroid — weighted mean frequency.
 * Higher centroid = brighter sound.
 */
export function computeSpectralCentroid(
  magnitudes: Float32Array,
  binHz: number,
): number {
  let weightedSum = 0;
  let totalMag = 0;
  for (let i = 1; i < magnitudes.length; i++) {
    const freq = i * binHz;
    weightedSum += freq * magnitudes[i]!;
    totalMag += magnitudes[i]!;
  }
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

/**
 * Spectral rolloff — frequency below which 85% of energy lives.
 */
export function computeSpectralRolloff(
  magnitudes: Float32Array,
  binHz: number,
  percentile: number = 0.85,
): number {
  let totalEnergy = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    totalEnergy += magnitudes[i]! * magnitudes[i]!;
  }
  const threshold = totalEnergy * percentile;
  let cumulative = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    cumulative += magnitudes[i]! * magnitudes[i]!;
    if (cumulative >= threshold) {
      return i * binHz;
    }
  }
  return magnitudes.length * binHz;
}

/**
 * Spectral flatness — 0 = tonal, 1 = noise-like.
 * Geometric mean / arithmetic mean of magnitudes.
 */
export function computeSpectralFlatness(magnitudes: Float32Array): number {
  const n = magnitudes.length;
  if (n === 0) return 0;

  let logSum = 0;
  let arithmeticSum = 0;
  let validBins = 0;

  for (let i = 1; i < n; i++) {
    const m = Math.max(magnitudes[i]!, 1e-10);
    logSum += Math.log(m);
    arithmeticSum += m;
    validBins++;
  }

  if (validBins === 0 || arithmeticSum === 0) return 0;
  const geometricMean = Math.exp(logSum / validBins);
  const arithmeticMean = arithmeticSum / validBins;
  return Math.min(1, geometricMean / arithmeticMean);
}

/**
 * Spectral bandwidth — spread around centroid.
 */
export function computeSpectralBandwidth(
  magnitudes: Float32Array,
  binHz: number,
  centroid: number,
): number {
  let weightedSum = 0;
  let totalMag = 0;
  for (let i = 1; i < magnitudes.length; i++) {
    const freq = i * binHz;
    const diff = freq - centroid;
    weightedSum += diff * diff * magnitudes[i]!;
    totalMag += magnitudes[i]!;
  }
  return totalMag > 0 ? Math.sqrt(weightedSum / totalMag) : 0;
}

type DominantBand = 'low' | 'lowMid' | 'mid' | 'highMid' | 'high';

function findDominantBand(
  magnitudes: Float32Array,
  binHz: number,
): DominantBand {
  const bands: { name: DominantBand; low: number; high: number }[] = [
    { name: 'low', low: 20, high: 250 },
    { name: 'lowMid', low: 250, high: 1000 },
    { name: 'mid', low: 1000, high: 4000 },
    { name: 'highMid', low: 4000, high: 8000 },
    { name: 'high', low: 8000, high: 20000 },
  ];

  let maxEnergy = -Infinity;
  let dominant: DominantBand = 'mid';

  for (const band of bands) {
    const lowBin = Math.floor(band.low / binHz);
    const highBin = Math.min(Math.ceil(band.high / binHz), magnitudes.length - 1);
    let energy = 0;
    for (let i = lowBin; i <= highBin; i++) {
      energy += magnitudes[i]! * magnitudes[i]!;
    }
    if (energy > maxEnergy) {
      maxEnergy = energy;
      dominant = band.name;
    }
  }

  return dominant;
}

/**
 * Build a complete spectral profile for a track's audio buffer.
 */
export function buildSpectralProfile(
  trackId: string,
  buffer: AudioBuffer,
): SpectralProfile {
  const { magnitudes, binHz } = computeFFTMagnitudes(buffer);
  const centroid = computeSpectralCentroid(magnitudes, binHz);
  const bandwidth = computeSpectralBandwidth(magnitudes, binHz, centroid);
  const rolloff = computeSpectralRolloff(magnitudes, binHz);
  const flatness = computeSpectralFlatness(magnitudes);
  const dominantBand = findDominantBand(magnitudes, binHz);

  return { trackId, centroid, bandwidth, rolloff, flatness, dominantBand };
}
