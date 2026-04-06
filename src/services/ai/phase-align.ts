/**
 * Phase Align — multi-track phase alignment utility.
 * Detects inter-track delay offsets, polarity issues, and provides
 * micro-alignment suggestions.
 */

import { useSessionStore } from '@/stores/session-store';
import { isAudioClip } from '@/types/audio';
import type { Track, AudioClip } from '@/types/audio';

export type AlignMode = 'preserve-transients' | 'maximize-low-end' | 'natural-feel';

export interface PhaseAlignResult {
  trackAId: string;
  trackBId: string;
  trackAName: string;
  trackBName: string;
  correlation: number;
  delaySamples: number;
  delayMs: number;
  polarityFlip: boolean;
  alignMode: AlignMode;
  beforeCorrelation: number;
  afterCorrelation: number;
}

export interface PhaseAlignReport {
  pairs: PhaseAlignResult[];
  timestamp: number;
}

/**
 * Cross-correlate two signals to find the delay offset.
 * Returns the lag (in samples) that maximizes correlation.
 */
function crossCorrelate(
  a: Float32Array,
  b: Float32Array,
  maxLag: number,
): { lag: number; correlation: number; polarityFlip: boolean } {
  const n = Math.min(a.length, b.length, 20000); // limit for performance
  let bestLag = 0;
  let bestCorr = -Infinity;
  let bestFlip = false;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0;
    let sumA2 = 0;
    let sumB2 = 0;
    let count = 0;

    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j < 0 || j >= b.length) continue;
      sum += a[i]! * b[j]!;
      sumA2 += a[i]! * a[i]!;
      sumB2 += b[j]! * b[j]!;
      count++;
    }

    const denom = Math.sqrt(sumA2 * sumB2);
    const corr = denom > 0 ? sum / denom : 0;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
      bestFlip = false;
    }
    // Also check inverted polarity
    if (-corr > bestCorr) {
      bestCorr = -corr;
      bestLag = lag;
      bestFlip = true;
    }
  }

  return { lag: bestLag, correlation: bestCorr, polarityFlip: bestFlip };
}

/**
 * Filter signal to low frequencies only (for maximize-low-end mode).
 * Simple single-pole lowpass at ~250Hz.
 */
function lowpassFilter(
  data: Float32Array,
  sampleRate: number,
  cutoff: number = 250,
): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const out = new Float32Array(data.length);
  out[0] = data[0]!;
  for (let i = 1; i < data.length; i++) {
    out[i] = out[i - 1]! + alpha * (data[i]! - out[i - 1]!);
  }
  return out;
}

/**
 * Analyze phase alignment between all track pairs.
 */
export function analyzePhaseAlignment(
  mode: AlignMode = 'natural-feel',
  tracks?: Track[],
): PhaseAlignReport {
  const allTracks = tracks ?? useSessionStore.getState().tracks;
  const audioTracks = allTracks
    .filter(t => !t.mute && t.clips.some(isAudioClip))
    .map(t => ({
      track: t,
      clip: t.clips.find(isAudioClip) as AudioClip,
    }));

  const pairs: PhaseAlignResult[] = [];
  const sampleRate = useSessionStore.getState().config.sampleRate;
  // Max lag: ~10ms worth of samples
  const maxLag = Math.floor(sampleRate * 0.01);

  for (let i = 0; i < audioTracks.length; i++) {
    for (let j = i + 1; j < audioTracks.length; j++) {
      const a = audioTracks[i]!;
      const b = audioTracks[j]!;

      let dataA: Float32Array = a.clip.buffer.getChannelData(0) as Float32Array;
      let dataB: Float32Array = b.clip.buffer.getChannelData(0) as Float32Array;

      // Apply mode-specific preprocessing
      if (mode === 'maximize-low-end') {
        dataA = lowpassFilter(dataA, sampleRate);
        dataB = lowpassFilter(dataB, sampleRate);
      }

      // Before alignment correlation
      const beforeResult = crossCorrelate(dataA, dataB, 0);
      const beforeCorrelation = beforeResult.correlation;

      // Find optimal alignment
      const result = crossCorrelate(dataA, dataB, maxLag);

      pairs.push({
        trackAId: a.track.id,
        trackBId: b.track.id,
        trackAName: a.track.name,
        trackBName: b.track.name,
        correlation: result.correlation,
        delaySamples: result.lag,
        delayMs: (result.lag / sampleRate) * 1000,
        polarityFlip: result.polarityFlip,
        alignMode: mode,
        beforeCorrelation,
        afterCorrelation: result.correlation,
      });
    }
  }

  // Sort by most problematic first
  pairs.sort((a, b) => a.correlation - b.correlation);

  return { pairs, timestamp: Date.now() };
}

/**
 * Apply phase alignment — adjusts clip start times by the detected delay.
 */
export function applyPhaseAlignment(result: PhaseAlignResult): void {
  const session = useSessionStore.getState();
  const sampleRate = session.config.sampleRate;

  if (result.delaySamples !== 0) {
    // Shift track B's clip by the delay amount
    const track = session.tracks.find(t => t.id === result.trackBId);
    const clip = track?.clips.find(isAudioClip);
    if (clip) {
      const delaySeconds = result.delaySamples / sampleRate;
      session.moveClipTime(result.trackBId, clip.id, clip.startTime + delaySeconds);
    }
  }
}
