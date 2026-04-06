/**
 * Stem Separator — client-side frequency-band source isolation.
 *
 * Uses frequency-band filtering to approximate stem separation:
 * - Vocals: mid-high frequencies (300Hz–5kHz), center-panned
 * - Drums: transient-heavy, full spectrum
 * - Bass: low frequencies (<300Hz)
 * - Other: remainder
 *
 * This is a simplified approach — real ML models like Demucs
 * would provide better quality but require server-side processing.
 */

import type { StemResult } from '@/types/session-scan';

// Band definitions for reference:
// bass: 0–300Hz, vocals: 300–5000Hz, drums: transient-based, other: 5000Hz+

/**
 * Apply a bandpass filter to audio data using windowed-sinc FIR.
 */
function bandpassFilter(
  data: Float32Array<ArrayBufferLike>,
  sampleRate: number,
  lowCut: number,
  highCut: number,
): Float32Array {
  const output = new Float32Array(data.length);
  const filterLength = 127;
  const halfLen = Math.floor(filterLength / 2);

  // Design FIR bandpass kernel
  const kernel = new Float32Array(filterLength);
  const lowNorm = lowCut / sampleRate;
  const highNorm = highCut / sampleRate;

  for (let i = 0; i < filterLength; i++) {
    const n = i - halfLen;
    if (n === 0) {
      kernel[i] = 2 * (highNorm - lowNorm);
    } else {
      const piN = Math.PI * n;
      kernel[i] = (Math.sin(2 * piN * highNorm) - Math.sin(2 * piN * lowNorm)) / piN;
    }
    // Hamming window
    kernel[i] = kernel[i]! * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (filterLength - 1)));
  }

  // Normalize kernel
  let sum = 0;
  for (let i = 0; i < filterLength; i++) sum += kernel[i]!;
  if (Math.abs(sum) > 0.001) {
    for (let i = 0; i < filterLength; i++) kernel[i] = kernel[i]! / sum;
  }

  // Convolve
  for (let i = halfLen; i < data.length - halfLen; i++) {
    let val = 0;
    for (let j = 0; j < filterLength; j++) {
      val += data[i - halfLen + j]! * kernel[j]!;
    }
    output[i] = val;
  }

  return output;
}

/**
 * Extract center-panned content from stereo audio (vocal isolation).
 * Mid = (L + R) / 2, Side = (L - R) / 2. Center content is in mid.
 */
function extractCenter(
  left: Float32Array<ArrayBufferLike>,
  right: Float32Array<ArrayBufferLike>,
): Float32Array {
  const mid = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    mid[i] = (left[i]! + right[i]!) * 0.5;
  }
  return mid;
}

/**
 * Extract side content (non-center) from stereo audio.
 */
function extractSides(
  left: Float32Array<ArrayBufferLike>,
  right: Float32Array<ArrayBufferLike>,
): Float32Array {
  const side = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    side[i] = (left[i]! - right[i]!) * 0.5;
  }
  return side;
}

/**
 * Detect transient energy for drum isolation.
 * Returns a gain envelope that emphasizes transients.
 */
function transientEnvelope(data: Float32Array, sampleRate: number): Float32Array {
  const envelope = new Float32Array(data.length);
  const attackSamples = Math.floor(sampleRate * 0.005); // 5ms
  const releaseSamples = Math.floor(sampleRate * 0.05); // 50ms

  let prevEnergy = 0;
  const hopSize = 128;

  for (let i = 0; i < data.length; i += hopSize) {
    let energy = 0;
    const end = Math.min(i + hopSize, data.length);
    for (let j = i; j < end; j++) {
      energy += data[j]! * data[j]!;
    }
    energy /= (end - i);

    const flux = Math.max(0, energy - prevEnergy);
    const gain = Math.min(1, flux * 50);

    for (let j = i; j < end && j < data.length; j++) {
      const distFromOnset = j - i;
      if (distFromOnset < attackSamples) {
        envelope[j] = gain;
      } else {
        const decay = Math.max(0, 1 - (distFromOnset - attackSamples) / releaseSamples);
        envelope[j] = gain * decay;
      }
    }

    prevEnergy = energy;
  }

  return envelope;
}

/**
 * Separate audio into stems using frequency-band filtering.
 */
export function separateStems(
  buffer: AudioBuffer,
  sourceTrackId: string,
): StemResult {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;

  // Create offline context for building AudioBuffer results
  const ctx = new OfflineAudioContext(numChannels, length, sampleRate);

  // ─── Bass stem: lowpass at 300Hz ───
  const bassData = bandpassFilter(left, sampleRate, 0.5, 300);
  const bassBuffer = ctx.createBuffer(1, length, sampleRate);
  bassBuffer.getChannelData(0).set(bassData);

  // ─── Vocal stem: mid signal, bandpassed 300–5000Hz ───
  const midSignal = numChannels > 1 ? extractCenter(left, right) : left;
  const vocalData = bandpassFilter(midSignal, sampleRate, 300, 5000);
  const vocalBuffer = ctx.createBuffer(1, length, sampleRate);
  vocalBuffer.getChannelData(0).set(vocalData);

  // ─── Drum stem: transient-emphasized fullband ───
  const monoData = numChannels > 1
    ? extractCenter(left, right)
    : Float32Array.from(left);
  const transients = transientEnvelope(monoData, sampleRate);
  const drumData = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    drumData[i] = monoData[i]! * Math.min(1, transients[i]! * 2 + 0.1);
  }
  const drumBuffer = ctx.createBuffer(1, length, sampleRate);
  drumBuffer.getChannelData(0).set(drumData);

  // ─── Other stem: highpass at 5kHz + side content ───
  const highData = bandpassFilter(left, sampleRate, 5000, 20000);
  const sideData = numChannels > 1 ? extractSides(left, right) : new Float32Array(length);
  const otherData = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    otherData[i] = highData[i]! * 0.7 + sideData[i]! * 0.5;
  }
  const otherBuffer = ctx.createBuffer(1, length, sampleRate);
  otherBuffer.getChannelData(0).set(otherData);

  return {
    sourceTrackId,
    stems: [
      { type: 'vocals', buffer: vocalBuffer, name: 'Vocals' },
      { type: 'drums', buffer: drumBuffer, name: 'Drums' },
      { type: 'bass', buffer: bassBuffer, name: 'Bass' },
      { type: 'other', buffer: otherBuffer, name: 'Other' },
    ],
  };
}
