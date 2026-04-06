/**
 * Engineering Actions — batch cleanup utilities for audio tracks.
 * Provides silence trimming, DC offset detection, click/pop detection,
 * fade tools, and batch normalization.
 */

import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { isAudioClip } from '@/types/audio';
import type { Track, AudioClip } from '@/types/audio';

export interface EngineeringIssue {
  type: 'dc-offset' | 'silence-head' | 'silence-tail' | 'click' | 'clipping' | 'low-level';
  trackId: string;
  trackName: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  fixable: boolean;
  fixAction?: () => void;
}

export interface EngineeringReport {
  issues: EngineeringIssue[];
  trackCount: number;
  issueCount: number;
  criticalCount: number;
  timestamp: number;
}

/**
 * Detect DC offset in audio buffer.
 * Returns the mean sample value — ideally 0.
 */
export function detectDCOffset(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sum = 0;
  const stride = Math.max(1, Math.floor(data.length / 10000));
  let count = 0;
  for (let i = 0; i < data.length; i += stride) {
    sum += data[i]!;
    count++;
  }
  return sum / count;
}

/**
 * Detect leading silence duration in seconds.
 */
export function detectLeadingSilence(buffer: AudioBuffer, thresholdDb: number = -60): number {
  const data = buffer.getChannelData(0);
  const threshold = Math.pow(10, thresholdDb / 20);
  const windowSize = Math.floor(buffer.sampleRate * 0.01); // 10ms windows

  for (let i = 0; i < data.length - windowSize; i += windowSize) {
    let rms = 0;
    for (let j = i; j < i + windowSize; j++) {
      rms += data[j]! * data[j]!;
    }
    rms = Math.sqrt(rms / windowSize);
    if (rms > threshold) {
      return i / buffer.sampleRate;
    }
  }
  return buffer.duration;
}

/**
 * Detect trailing silence duration in seconds.
 */
export function detectTrailingSilence(buffer: AudioBuffer, thresholdDb: number = -60): number {
  const data = buffer.getChannelData(0);
  const threshold = Math.pow(10, thresholdDb / 20);
  const windowSize = Math.floor(buffer.sampleRate * 0.01);

  for (let i = data.length - windowSize; i >= 0; i -= windowSize) {
    let rms = 0;
    for (let j = i; j < Math.min(i + windowSize, data.length); j++) {
      rms += data[j]! * data[j]!;
    }
    rms = Math.sqrt(rms / windowSize);
    if (rms > threshold) {
      return buffer.duration - (i + windowSize) / buffer.sampleRate;
    }
  }
  return buffer.duration;
}

/**
 * Detect clicks/pops by finding sudden amplitude jumps.
 * Returns sample positions of detected clicks.
 */
export function detectClicks(buffer: AudioBuffer, sensitivity: number = 0.3): number[] {
  const data = buffer.getChannelData(0);
  const clicks: number[] = [];
  const stride = 1;

  for (let i = 1; i < data.length - 1; i += stride) {
    const diff = Math.abs(data[i]! - data[i - 1]!);
    if (diff > sensitivity) {
      clicks.push(i / buffer.sampleRate);
      i += Math.floor(buffer.sampleRate * 0.01); // skip ahead 10ms to avoid duplicates
    }
  }

  return clicks;
}

/**
 * Run a full engineering scan across all tracks.
 */
export function runEngineeringScan(tracks?: Track[]): EngineeringReport {
  const allTracks = tracks ?? useSessionStore.getState().tracks;
  const issues: EngineeringIssue[] = [];

  for (const track of allTracks) {
    if (track.mute) continue;
    const audioClip = track.clips.find(isAudioClip) as AudioClip | undefined;
    if (!audioClip) continue;

    const buffer = audioClip.buffer;

    // DC Offset detection
    const dcOffset = detectDCOffset(buffer);
    if (Math.abs(dcOffset) > 0.005) {
      issues.push({
        type: 'dc-offset',
        trackId: track.id,
        trackName: track.name,
        description: `DC offset of ${(dcOffset * 100).toFixed(2)}% detected. This wastes headroom.`,
        severity: Math.abs(dcOffset) > 0.02 ? 'warning' : 'info',
        fixable: false,
      });
    }

    // Leading silence
    const leadSilence = detectLeadingSilence(buffer);
    if (leadSilence > 0.5) {
      issues.push({
        type: 'silence-head',
        trackId: track.id,
        trackName: track.name,
        description: `${leadSilence.toFixed(1)}s of leading silence. Consider trimming.`,
        severity: leadSilence > 2 ? 'warning' : 'info',
        fixable: false,
      });
    }

    // Trailing silence
    const tailSilence = detectTrailingSilence(buffer);
    if (tailSilence > 0.5) {
      issues.push({
        type: 'silence-tail',
        trackId: track.id,
        trackName: track.name,
        description: `${tailSilence.toFixed(1)}s of trailing silence. Consider trimming.`,
        severity: tailSilence > 2 ? 'warning' : 'info',
        fixable: false,
      });
    }

    // Click detection
    const clicks = detectClicks(buffer);
    if (clicks.length > 5) {
      issues.push({
        type: 'click',
        trackId: track.id,
        trackName: track.name,
        description: `${clicks.length} potential clicks/pops detected.`,
        severity: clicks.length > 20 ? 'critical' : 'warning',
        fixable: false,
      });
    }

    // Clipping detection
    const data = buffer.getChannelData(0);
    let clipCount = 0;
    const stride = Math.max(1, Math.floor(data.length / 20000));
    for (let i = 0; i < data.length; i += stride) {
      if (Math.abs(data[i]!) >= 0.999) clipCount++;
    }
    if (clipCount > 0) {
      issues.push({
        type: 'clipping',
        trackId: track.id,
        trackName: track.name,
        description: `Clipping detected (~${clipCount * stride} samples). Reduce gain by 3 dB.`,
        severity: 'critical',
        fixable: true,
        fixAction: () => {
          const session = useSessionStore.getState();
          const t = session.tracks.find(tr => tr.id === track.id);
          if (t) {
            const newVol = t.volume - 3;
            useMixerStore.getState().setVolume(track.id, newVol);
            session.updateTrack(track.id, { volume: newVol });
          }
        },
      });
    }

    // Low level detection
    let peak = 0;
    for (let i = 0; i < data.length; i += stride) {
      const abs = Math.abs(data[i]!);
      if (abs > peak) peak = abs;
    }
    const peakDb = 20 * Math.log10(Math.max(peak, 1e-10));
    if (peakDb < -24) {
      issues.push({
        type: 'low-level',
        trackId: track.id,
        trackName: track.name,
        description: `Peak level is ${peakDb.toFixed(1)} dB — very quiet. Consider normalizing.`,
        severity: peakDb < -36 ? 'warning' : 'info',
        fixable: true,
        fixAction: () => {
          const adjustment = -6 - peakDb;
          const session = useSessionStore.getState();
          const t = session.tracks.find(tr => tr.id === track.id);
          if (t) {
            const newVol = Math.round((t.volume + adjustment) * 10) / 10;
            useMixerStore.getState().setVolume(track.id, newVol);
            session.updateTrack(track.id, { volume: newVol });
          }
        },
      });
    }
  }

  return {
    issues,
    trackCount: allTracks.length,
    issueCount: issues.length,
    criticalCount: issues.filter(i => i.severity === 'critical').length,
    timestamp: Date.now(),
  };
}

/**
 * Auto-fix all fixable issues.
 */
export function autoFixIssues(report: EngineeringReport): number {
  let fixed = 0;
  for (const issue of report.issues) {
    if (issue.fixable && issue.fixAction) {
      try {
        issue.fixAction();
        fixed++;
      } catch (err) {
        console.warn(`[DAW] Failed to auto-fix ${issue.type} on ${issue.trackName}:`, err);
      }
    }
  }
  return fixed;
}
