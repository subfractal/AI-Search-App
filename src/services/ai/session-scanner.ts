/**
 * Session Intelligence Scanner — unified project scan that detects
 * tempo, key, chords, track roles, sections, and energy curve.
 * Combines existing analyzers into a single "Analysis Layer."
 */

import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { analyzeMix } from './mix-analyzer';
import { detectSections } from './section-detector';
import { classifyTrack } from './track-classifier';
import { analyzeHarmonicTopography } from './harmonic-analyzer';
import { isAudioClip, isMidiClip } from '@/types/audio';
import type { Track, AudioClip } from '@/types/audio';
import type {
  SessionScanResult,
  TempoEstimate,
  KeyEstimate,
  TrackRoleGuess,
} from '@/types/session-scan';

/**
 * Estimate tempo from audio onset intervals using autocorrelation.
 */
function estimateTempo(tracks: Track[], sampleRate: number): TempoEstimate {
  // Collect onset energy from first audio clip
  const clip = tracks
    .flatMap((t) => t.clips)
    .find(isAudioClip) as AudioClip | undefined;

  if (!clip) {
    const config = useSessionStore.getState().config;
    return { bpm: config.bpm, confidence: 0.5, timeSignature: '4/4' };
  }

  const data = clip.buffer.getChannelData(0);
  const frameSize = 1024;
  const hopSize = 512;
  const onsetEnergy: number[] = [];

  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < frameSize; j++) {
      energy += data[i + j]! * data[i + j]!;
    }
    onsetEnergy.push(energy / frameSize);
  }

  // Spectral flux for onset detection
  const flux: number[] = [];
  for (let i = 1; i < onsetEnergy.length; i++) {
    flux.push(Math.max(0, onsetEnergy[i]! - onsetEnergy[i - 1]!));
  }

  // Autocorrelation on flux to find periodicity
  const minLag = Math.floor(sampleRate * 60 / (200 * hopSize)); // 200 BPM
  const maxLag = Math.floor(sampleRate * 60 / (60 * hopSize));  // 60 BPM
  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, flux.length / 2); lag++) {
    let corr = 0;
    const n = Math.min(flux.length - lag, 200);
    for (let i = 0; i < n; i++) {
      corr += flux[i]! * flux[i + lag]!;
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const beatPeriodSeconds = (bestLag * hopSize) / sampleRate;
  const bpm = Math.round(60 / beatPeriodSeconds);
  const clampedBpm = Math.max(60, Math.min(200, bpm));
  const confidence = bestCorr > 0 ? Math.min(0.95, 0.5 + bestCorr / 10) : 0.3;

  return { bpm: clampedBpm, confidence, timeSignature: '4/4' };
}

/**
 * Estimate key from pitch class histogram (chroma features).
 */
function estimateKey(tracks: Track[], sampleRate: number): KeyEstimate {
  const clip = tracks
    .flatMap((t) => t.clips)
    .find(isAudioClip) as AudioClip | undefined;

  if (!clip) {
    return { key: 'C', scale: 'major', confidence: 0.3 };
  }

  const data = clip.buffer.getChannelData(0);
  const chroma = new Float32Array(12);
  const fftSize = 4096;

  // Compute pitch class profile from DFT magnitude
  const maxFrames = Math.min(50, Math.floor(data.length / fftSize));
  for (let frame = 0; frame < maxFrames; frame++) {
    const offset = frame * fftSize;
    const re = new Float32Array(fftSize);
    for (let i = 0; i < fftSize && offset + i < data.length; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
      re[i] = data[offset + i]! * w;
    }
    // Simplified DFT for key bins
    for (let k = 1; k < fftSize / 2; k++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        sumRe += re[n]! * Math.cos(angle);
        sumIm -= re[n]! * Math.sin(angle);
      }
      const mag = Math.sqrt(sumRe * sumRe + sumIm * sumIm);
      const freq = (k * sampleRate) / fftSize;
      if (freq > 60 && freq < 4000) {
        const midi = 12 * Math.log2(freq / 440) + 69;
        const pc = ((Math.round(midi) % 12) + 12) % 12;
        chroma[pc]! += mag;
      }
    }
  }

  // Krumhansl-Schmuckler key profiles
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let bestKey = 'C';
  let bestScale: 'major' | 'minor' = 'major';
  let bestCorr = -Infinity;

  for (let root = 0; root < 12; root++) {
    for (const [profile, scale] of [
      [majorProfile, 'major'],
      [minorProfile, 'minor'],
    ] as const) {
      let corr = 0;
      for (let i = 0; i < 12; i++) {
        corr += chroma[(i + root) % 12]! * profile[i]!;
      }
      if (corr > bestCorr) {
        bestCorr = corr;
        bestKey = noteNames[root]!;
        bestScale = scale;
      }
    }
  }

  const confidence = bestCorr > 0 ? Math.min(0.95, 0.4 + bestCorr / 100) : 0.3;
  return { key: bestKey, scale: bestScale, confidence };
}

/**
 * Classify all tracks in the session.
 */
function classifyAllTracks(tracks: Track[]): TrackRoleGuess[] {
  return tracks.map((track) => {
    const audioClip = track.clips.find(isAudioClip) as AudioClip | undefined;
    if (audioClip) {
      const classification = classifyTrack(track.id, audioClip.buffer, track.name);
      return {
        trackId: track.id,
        role: classification.suggestedRole,
        confidence: classification.confidence,
        spectralCategory: classification.spectralProfile ?? 'unknown',
      };
    }
    // MIDI track — classify by name/role heuristic
    return {
      trackId: track.id,
      role: track.role ?? 'general',
      confidence: 0.5,
      spectralCategory: 'midi',
    };
  });
}

/**
 * Compute energy curve (RMS per segment) across the session.
 */
function computeEnergyCurve(tracks: Track[], sampleRate: number): number[] {
  const segmentDuration = 2; // seconds
  const segmentSamples = Math.floor(sampleRate * segmentDuration);

  // Find max session length
  let maxLength = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      maxLength = Math.max(maxLength, clip.startTime + clip.duration);
    }
  }

  const numSegments = Math.max(1, Math.ceil(maxLength / segmentDuration));
  const energy: number[] = new Array(numSegments).fill(0);

  for (const track of tracks) {
    if (track.mute) continue;
    for (const clip of track.clips) {
      if (!isAudioClip(clip)) continue;
      const data = clip.buffer.getChannelData(0);
      const clipStartSeg = Math.floor(clip.startTime / segmentDuration);

      for (let seg = 0; seg < numSegments; seg++) {
        const segStart = (seg - clipStartSeg) * segmentSamples;
        const segEnd = segStart + segmentSamples;
        if (segStart >= data.length || segEnd <= 0) continue;

        const lo = Math.max(0, segStart);
        const hi = Math.min(data.length, segEnd);
        let rms = 0;
        for (let i = lo; i < hi; i++) {
          rms += data[i]! * data[i]!;
        }
        energy[seg] = (energy[seg] ?? 0) + Math.sqrt(rms / (hi - lo));
      }
    }
  }

  // Normalize 0–1
  const maxE = Math.max(...energy, 0.001);
  return energy.map((e) => e / maxE);
}

/**
 * Run a full session intelligence scan.
 */
export function runSessionScan(): SessionScanResult {
  const { tracks, config } = useSessionStore.getState();
  const aiState = useAIStore.getState();

  aiState.setAnalyzing(true);
  try {
    const tempo = estimateTempo(tracks, config.sampleRate);
    const key = estimateKey(tracks, config.sampleRate);
    const sections = detectSections(tracks, config.sampleRate);
    const trackRoles = classifyAllTracks(tracks);
    const energyCurve = computeEnergyCurve(tracks, config.sampleRate);
    const mixAnalysis = analyzeMix(tracks, config.sampleRate);

    // Harmonic analysis (if MIDI tracks exist)
    const hasMidi = tracks.some((t) => t.clips.some(isMidiClip));
    const harmony = hasMidi
      ? analyzeHarmonicTopography(tracks, config.bpm)
      : null;

    const chords = harmony?.chordProgression ?? [];

    aiState.setAnalysis(mixAnalysis);

    return {
      tempo,
      key,
      sections,
      chords,
      trackRoles,
      energyCurve,
      mixAnalysis,
      harmony,
      scannedAt: Date.now(),
    };
  } finally {
    aiState.setAnalyzing(false);
  }
}
