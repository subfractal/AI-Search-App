/**
 * Audio-to-MIDI Transcription — converts monophonic audio to MIDI notes
 * using pitch detection (autocorrelation) and onset detection.
 */

import type { MidiNote } from '@/types/audio';
import type { TranscriptionMode, TranscriptionResult } from '@/types/session-scan';

/**
 * Autocorrelation-based pitch detection (YIN-like simplified).
 * Returns frequency in Hz or 0 if no clear pitch.
 */
function detectPitch(
  data: Float32Array,
  sampleRate: number,
  minFreq: number = 60,
  maxFreq: number = 2000,
): number {
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);
  const n = data.length;

  if (n < maxPeriod * 2) return 0;

  // Normalized autocorrelation
  let bestPeriod = 0;
  let bestCorr = -1;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let corr = 0;
    let norm1 = 0;
    let norm2 = 0;
    const limit = Math.min(n - period, period * 2);

    for (let i = 0; i < limit; i++) {
      corr += data[i]! * data[i + period]!;
      norm1 += data[i]! * data[i]!;
      norm2 += data[i + period]! * data[i + period]!;
    }

    const normFactor = Math.sqrt(norm1 * norm2);
    if (normFactor > 0) {
      const normalizedCorr = corr / normFactor;
      if (normalizedCorr > bestCorr) {
        bestCorr = normalizedCorr;
        bestPeriod = period;
      }
    }
  }

  if (bestCorr < 0.5 || bestPeriod === 0) return 0;
  return sampleRate / bestPeriod;
}

/**
 * Detect onsets using spectral flux (simplified energy-based).
 * Returns array of onset times in seconds.
 */
function detectOnsets(
  data: Float32Array,
  sampleRate: number,
  threshold: number = 0.15,
): number[] {
  const frameSize = 1024;
  const hopSize = 256;
  const onsets: number[] = [];

  let prevEnergy = 0;
  const minGap = sampleRate * 0.05; // Min 50ms between onsets
  let lastOnsetSample = -minGap;

  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += data[i + j]! * data[i + j]!;
    }
    energy /= frameSize;

    const flux = Math.max(0, energy - prevEnergy);
    if (flux > threshold && (i - lastOnsetSample) > minGap) {
      onsets.push(i / sampleRate);
      lastOnsetSample = i;
    }
    prevEnergy = energy;
  }

  return onsets;
}

/**
 * Convert frequency to MIDI note number.
 */
function freqToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/**
 * Transcribe monophonic audio (melody or bass) to MIDI notes.
 */
function transcribeMono(
  buffer: AudioBuffer,
  mode: TranscriptionMode,
): MidiNote[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Mode-specific frequency ranges
  const freqRange = mode === 'bass'
    ? { min: 30, max: 500 }
    : { min: 80, max: 2000 };

  // Detect onsets
  const onsets = detectOnsets(data, sampleRate);
  if (onsets.length === 0) return [];

  const notes: MidiNote[] = [];
  const analysisWindowSize = Math.floor(sampleRate * 0.05); // 50ms analysis window

  for (let i = 0; i < onsets.length; i++) {
    const onsetSample = Math.floor(onsets[i]! * sampleRate);
    const endSample = i < onsets.length - 1
      ? Math.floor(onsets[i + 1]! * sampleRate)
      : Math.min(onsetSample + sampleRate, data.length);

    // Extract analysis window starting slightly after onset
    const windowStart = onsetSample + Math.floor(analysisWindowSize * 0.2);
    const windowEnd = Math.min(windowStart + analysisWindowSize * 4, endSample);
    if (windowEnd - windowStart < analysisWindowSize) continue;

    const window = data.subarray(windowStart, windowEnd);
    const freq = detectPitch(window, sampleRate, freqRange.min, freqRange.max);
    if (freq === 0) continue;

    const midi = freqToMidi(freq);
    if (midi < 20 || midi > 108) continue;

    // Estimate velocity from onset energy
    let energy = 0;
    const velWindow = Math.min(512, endSample - onsetSample);
    for (let j = 0; j < velWindow; j++) {
      const idx = onsetSample + j;
      if (idx < data.length) energy += data[idx]! * data[idx]!;
    }
    const rms = Math.sqrt(energy / velWindow);
    const velocity = Math.round(Math.min(127, Math.max(20, rms * 500)));

    const duration = (endSample - onsetSample) / sampleRate;
    notes.push({
      pitch: midi,
      velocity,
      startTime: onsets[i]!,
      duration: Math.max(0.05, duration * 0.9),
    });
  }

  return notes;
}

/**
 * Transcribe polyphonic audio to chord MIDI notes (simplified).
 * Uses frame-by-frame pitch detection with harmonic peak picking.
 */
function transcribeChords(buffer: AudioBuffer): MidiNote[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const frameSize = 4096;
  const hopSize = Math.floor(sampleRate * 0.5); // Analyze every 500ms
  const notes: MidiNote[] = [];

  for (let offset = 0; offset < data.length - frameSize; offset += hopSize) {
    const frame = data.subarray(offset, offset + frameSize);

    // Apply Hann window and compute magnitude spectrum
    const re = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      re[i] = frame[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frameSize - 1)));
    }

    // Compute chroma from DFT
    const chroma = new Float32Array(12);
    for (let k = 1; k < frameSize / 2; k++) {
      let sumRe = 0;
      let sumIm = 0;
      // Goertzel-like for specific bins (simplified)
      for (let n = 0; n < frameSize; n++) {
        const angle = (2 * Math.PI * k * n) / frameSize;
        sumRe += re[n]! * Math.cos(angle);
        sumIm -= re[n]! * Math.sin(angle);
      }
      const mag = Math.sqrt(sumRe * sumRe + sumIm * sumIm);
      const freq = (k * sampleRate) / frameSize;
      if (freq > 60 && freq < 2000 && mag > 0.01) {
        const midi = 12 * Math.log2(freq / 440) + 69;
        const pc = ((Math.round(midi) % 12) + 12) % 12;
        chroma[pc] = (chroma[pc] ?? 0) + mag;
      }
    }

    // Pick top 3-4 pitch classes as chord tones
    const indexed = Array.from(chroma).map((v, i) => ({ pc: i, mag: v }));
    indexed.sort((a, b) => b.mag - a.mag);
    const threshold = indexed[0]!.mag * 0.3;
    const chordTones = indexed.filter((x) => x.mag > threshold).slice(0, 4);

    const startTime = offset / sampleRate;
    const duration = hopSize / sampleRate;

    for (const tone of chordTones) {
      notes.push({
        pitch: 60 + tone.pc, // Place in octave 4
        velocity: Math.round(Math.min(100, tone.mag * 200)),
        startTime,
        duration: duration * 0.95,
      });
    }
  }

  return notes;
}

/**
 * Main transcription function — converts audio to MIDI.
 */
export function transcribeAudio(
  buffer: AudioBuffer,
  trackId: string,
  mode: TranscriptionMode = 'melody',
): TranscriptionResult {
  let notes: MidiNote[];

  if (mode === 'chords') {
    notes = transcribeChords(buffer);
  } else {
    notes = transcribeMono(buffer, mode);
  }

  // Estimate confidence from note density and pitch consistency
  const totalDuration = buffer.duration;
  const coverageRatio = notes.reduce((sum, n) => sum + n.duration, 0) / totalDuration;
  const confidence = Math.min(0.95, Math.max(0.2, coverageRatio * 1.2));

  return { notes, mode, confidence, trackId };
}
