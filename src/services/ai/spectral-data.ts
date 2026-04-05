/**
 * Spectral Data — prepares FFT data for visualization.
 * Computes sliding-window spectrogram from AudioBuffer.
 */

export interface SpectrogramData {
  /** 2D array: frames x frequency bins, values are magnitudes in dB */
  data: Float32Array[];
  timeStep: number;
  frequencyBins: number;
  sampleRate: number;
  maxMagnitude: number;
  minMagnitude: number;
}

/**
 * Compute spectrogram from an audio buffer.
 * Returns a 2D time-frequency representation.
 */
export function computeSpectrogram(
  buffer: AudioBuffer,
  fftSize: number = 1024,
  hopSize: number = 512,
): SpectrogramData {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const halfFFT = fftSize / 2;
  const frames: Float32Array[] = [];
  let maxMag = -Infinity;
  let minMag = Infinity;

  for (let offset = 0; offset + fftSize <= data.length; offset += hopSize) {
    // Window the signal (Hann)
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      real[i] = data[offset + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / fftSize));
    }

    // Simple DFT (matching existing analysis-engine approach)
    const outReal = new Float32Array(fftSize);
    const outImag = new Float32Array(fftSize);
    const step = Math.max(1, Math.floor(fftSize / 256));

    for (let k = 0; k < halfFFT; k++) {
      let sr = 0;
      let si = 0;
      for (let t = 0; t < fftSize; t += step) {
        const angle = (2 * Math.PI * k * t) / fftSize;
        sr += real[t]! * Math.cos(angle) + imag[t]! * Math.sin(angle);
        si += -real[t]! * Math.sin(angle) + imag[t]! * Math.cos(angle);
      }
      outReal[k] = sr;
      outImag[k] = si;
    }

    // Convert to magnitude (dB)
    const magnitudes = new Float32Array(halfFFT);
    for (let i = 0; i < halfFFT; i++) {
      const mag = Math.sqrt(outReal[i]! * outReal[i]! + outImag[i]! * outImag[i]!);
      const db = 20 * Math.log10(Math.max(mag, 1e-10));
      magnitudes[i] = db;
      if (db > maxMag) maxMag = db;
      if (db < minMag) minMag = db;
    }

    frames.push(magnitudes);
  }

  return {
    data: frames,
    timeStep: hopSize / sampleRate,
    frequencyBins: halfFFT,
    sampleRate,
    maxMagnitude: maxMag,
    minMagnitude: Math.max(minMag, -100),
  };
}

/**
 * Get frequency label for a given bin index.
 */
export function binToFrequency(bin: number, sampleRate: number, fftSize: number): number {
  return bin * sampleRate / fftSize;
}

/**
 * Format frequency for display.
 */
export function formatFrequency(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
  return `${Math.round(hz)}Hz`;
}
