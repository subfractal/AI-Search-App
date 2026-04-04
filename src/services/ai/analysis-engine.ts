import type { LevelAnalysis, FrequencyAnalysis, TrackAnalysis } from '@/types/ai';
import { calculateLUFS } from './loudness-meter';

export function analyzeLevels(buffer: AudioBuffer): LevelAnalysis {
  const data = buffer.getChannelData(0);
  let sumSquares = 0;
  let peak = 0;
  let clipping = false;

  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]!);
    sumSquares += data[i]! * data[i]!;
    if (abs > peak) peak = abs;
    if (abs >= 0.999) clipping = true;
  }

  const rms = Math.sqrt(sumSquares / data.length);
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-10));
  const peakDb = 20 * Math.log10(Math.max(peak, 1e-10));

  return {
    rms: rmsDb,
    peak: peakDb,
    dynamicRange: peakDb - rmsDb,
    clipping,
  };
}

export function analyzeFrequencySpectrum(
  buffer: AudioBuffer,
  sampleRate: number,
): FrequencyAnalysis {
  const data = buffer.getChannelData(0);
  const fftSize = 4096;
  const numSamples = Math.min(data.length, fftSize);

  const real = new Float32Array(numSamples);
  const imag = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    real[i] = data[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / numSamples));
  }

  simpleDFT(real, imag, numSamples);

  const magnitudes = new Float32Array(numSamples / 2);
  for (let i = 0; i < numSamples / 2; i++) {
    magnitudes[i] = Math.sqrt(real[i]! * real[i]! + imag[i]! * imag[i]!);
  }

  const binHz = sampleRate / numSamples;

  const bandEnergy = (lowHz: number, highHz: number): number => {
    const lowBin = Math.floor(lowHz / binHz);
    const highBin = Math.min(Math.ceil(highHz / binHz), numSamples / 2 - 1);
    let sum = 0;
    for (let i = lowBin; i <= highBin; i++) {
      sum += magnitudes[i]! * magnitudes[i]!;
    }
    return 10 * Math.log10(Math.max(sum / (highBin - lowBin + 1), 1e-10));
  };

  return {
    low: bandEnergy(20, 250),
    lowMid: bandEnergy(250, 1000),
    mid: bandEnergy(1000, 4000),
    highMid: bandEnergy(4000, 8000),
    high: bandEnergy(8000, 20000),
  };
}

function simpleDFT(
  real: Float32Array,
  imag: Float32Array,
  n: number,
): void {
  const outReal = new Float32Array(n);
  const outImag = new Float32Array(n);

  const step = Math.max(1, Math.floor(n / 512));

  for (let k = 0; k < n / 2; k++) {
    let sumReal = 0;
    let sumImag = 0;
    for (let t = 0; t < n; t += step) {
      const angle = (2 * Math.PI * k * t) / n;
      sumReal += real[t]! * Math.cos(angle) + imag[t]! * Math.sin(angle);
      sumImag += -real[t]! * Math.sin(angle) + imag[t]! * Math.cos(angle);
    }
    outReal[k] = sumReal;
    outImag[k] = sumImag;
  }

  real.set(outReal);
  imag.set(outImag);
}

export function detectSilence(
  buffer: AudioBuffer,
  thresholdDb: number = -50,
): Array<{ start: number; end: number }> {
  const data = buffer.getChannelData(0);
  const threshold = Math.pow(10, thresholdDb / 20);
  const windowSize = Math.floor(buffer.sampleRate * 0.05);
  const regions: Array<{ start: number; end: number }> = [];

  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < data.length; i += windowSize) {
    let rms = 0;
    const end = Math.min(i + windowSize, data.length);
    for (let j = i; j < end; j++) {
      rms += data[j]! * data[j]!;
    }
    rms = Math.sqrt(rms / (end - i));

    if (rms < threshold) {
      if (!inSilence) {
        inSilence = true;
        silenceStart = i / buffer.sampleRate;
      }
    } else if (inSilence) {
      inSilence = false;
      regions.push({
        start: silenceStart,
        end: i / buffer.sampleRate,
      });
    }
  }

  if (inSilence) {
    regions.push({
      start: silenceStart,
      end: data.length / buffer.sampleRate,
    });
  }

  return regions;
}

export function estimateNoiseFloor(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const windowSize = Math.floor(buffer.sampleRate * 0.1);
  const rmsValues: number[] = [];

  for (let i = 0; i < data.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(i + windowSize, data.length);
    for (let j = i; j < end; j++) {
      sum += data[j]! * data[j]!;
    }
    rmsValues.push(Math.sqrt(sum / (end - i)));
  }

  rmsValues.sort((a, b) => a - b);
  const p10 = rmsValues[Math.floor(rmsValues.length * 0.1)] ?? 1e-10;
  return 20 * Math.log10(Math.max(p10, 1e-10));
}

export function analyzeTrack(
  trackId: string,
  buffer: AudioBuffer,
  sampleRate: number,
): TrackAnalysis {
  let loudness = null;
  try {
    loudness = calculateLUFS(buffer);
  } catch {
    // Loudness calculation may fail on very short buffers
  }

  return {
    trackId,
    level: analyzeLevels(buffer),
    frequency: analyzeFrequencySpectrum(buffer, sampleRate),
    loudness,
    silenceRegions: detectSilence(buffer),
    noiseFloor: estimateNoiseFloor(buffer),
  };
}
