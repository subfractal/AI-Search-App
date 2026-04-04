import type {
  MixAnalysis,
  TrackAnalysis,
  FrequencyAnalysis,
  LevelAnalysis,
  AISuggestion,
} from '@/types/ai';
import type { Track } from '@/types/audio';
import { isAudioClip } from '@/types/audio';
import { analyzeTrack } from './analysis-engine';
import { generateId } from '@/utils/id';

export function analyzeMix(
  tracks: Track[],
  sampleRate: number,
): MixAnalysis {
  const trackAnalyses: TrackAnalysis[] = [];

  for (const track of tracks) {
    const audioClip = track.clips.find(isAudioClip);
    if (audioClip) {
      trackAnalyses.push(analyzeTrack(track.id, audioClip.buffer, sampleRate));
    }
  }

  const overallLevel = aggregateLevels(trackAnalyses);
  const frequencyBalance = aggregateFrequency(trackAnalyses);
  const stereoWidth = estimateStereoWidth(tracks);

  return {
    tracks: trackAnalyses,
    overallLevel,
    frequencyBalance,
    stereoWidth,
    timestamp: Date.now(),
  };
}

function aggregateLevels(analyses: TrackAnalysis[]): LevelAnalysis {
  if (analyses.length === 0) {
    return { rms: -Infinity, peak: -Infinity, dynamicRange: 0, clipping: false };
  }

  let maxRms = -Infinity;
  let maxPeak = -Infinity;
  let clipping = false;

  for (const a of analyses) {
    if (a.level.rms > maxRms) maxRms = a.level.rms;
    if (a.level.peak > maxPeak) maxPeak = a.level.peak;
    if (a.level.clipping) clipping = true;
  }

  return {
    rms: maxRms,
    peak: maxPeak,
    dynamicRange: maxPeak - maxRms,
    clipping,
  };
}

function aggregateFrequency(analyses: TrackAnalysis[]): FrequencyAnalysis {
  if (analyses.length === 0) {
    return { low: -60, lowMid: -60, mid: -60, highMid: -60, high: -60 };
  }

  const result = { low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 };
  for (const a of analyses) {
    result.low += a.frequency.low;
    result.lowMid += a.frequency.lowMid;
    result.mid += a.frequency.mid;
    result.highMid += a.frequency.highMid;
    result.high += a.frequency.high;
  }

  const n = analyses.length;
  result.low /= n;
  result.lowMid /= n;
  result.mid /= n;
  result.highMid /= n;
  result.high /= n;

  return result;
}

function estimateStereoWidth(tracks: Track[]): number {
  let totalPanSpread = 0;
  let count = 0;

  for (const track of tracks) {
    if (!track.mute && track.clips.length > 0) {
      totalPanSpread += Math.abs(track.pan);
      count++;
    }
  }

  return count > 0 ? totalPanSpread / count : 0;
}

export function generateSuggestions(
  analysis: MixAnalysis,
  tracks: Track[],
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  for (const ta of analysis.tracks) {
    if (ta.level.clipping) {
      const track = tracks.find((t) => t.id === ta.trackId);
      suggestions.push({
        id: generateId('sug'),
        type: 'clipping',
        priority: 'auto',
        targetTrackId: ta.trackId,
        title: `Clipping detected on "${track?.name ?? 'track'}"`,
        description: `Peak level is ${ta.level.peak.toFixed(1)} dB. ` +
          'Reducing volume by 3 dB to prevent distortion.',
        confidence: 0.95,
        status: 'pending',
        action: {
          type: 'setVolume',
          trackId: ta.trackId,
          value: (track?.volume ?? 0) - 3,
        },
        timestamp: Date.now(),
      });
    }
  }

  const rmsValues = analysis.tracks
    .map((t) => ({ trackId: t.trackId, rms: t.level.rms }))
    .sort((a, b) => b.rms - a.rms);

  if (rmsValues.length >= 2) {
    const loudest = rmsValues[0]!;
    const quietest = rmsValues[rmsValues.length - 1]!;
    const diff = loudest.rms - quietest.rms;

    if (diff > 12) {
      const loudTrack = tracks.find((t) => t.id === loudest.trackId);
      const quietTrack = tracks.find((t) => t.id === quietest.trackId);
      suggestions.push({
        id: generateId('sug'),
        type: 'level',
        priority: 'inline',
        targetTrackId: loudest.trackId,
        title: 'Level imbalance detected',
        description:
          `"${loudTrack?.name}" is ${diff.toFixed(0)} dB louder than ` +
          `"${quietTrack?.name}". Consider reducing it by ${(diff / 2).toFixed(0)} dB.`,
        confidence: 0.7,
        status: 'pending',
        action: {
          type: 'setVolume',
          trackId: loudest.trackId,
          value: (loudTrack?.volume ?? 0) - diff / 2,
        },
        timestamp: Date.now(),
      });
    }
  }

  // Low end buildup — add high-pass filter to tracks with heavy low end
  if (analysis.frequencyBalance.low - analysis.frequencyBalance.mid > 10) {
    // Find tracks contributing most low end
    const lowEndTracks = analysis.tracks
      .filter((t) => t.frequency.low > t.frequency.mid + 6)
      .map((t) => t.trackId);

    const filterActions: AISuggestion['action'][] = lowEndTracks.map((trackId) => ({
      type: 'addEffect' as const,
      trackId,
      effectType: 'filter',
      effectParams: { frequency: 80, type: 'highpass', Q: 0.7, rolloff: -12 },
    }));

    if (filterActions.length > 0) {
      const targetNames = lowEndTracks
        .map((id) => tracks.find((t) => t.id === id)?.name)
        .filter(Boolean);
      suggestions.push({
        id: generateId('sug'),
        type: 'eq',
        priority: 'sidebar',
        targetTrackId: lowEndTracks[0] ?? null,
        title: 'Low end buildup',
        description:
          `Excessive low-frequency energy detected. ` +
          `Will add 80 Hz high-pass filter to: ${targetNames.join(', ') || 'affected tracks'}.`,
        confidence: 0.65,
        status: 'pending',
        action: filterActions.length === 1
          ? filterActions[0]!
          : { type: 'batch', trackId: lowEndTracks[0]!, actions: filterActions as AISuggestion['action'][] as import('@/types/ai').SuggestionAction[] },
        timestamp: Date.now(),
      });
    } else {
      // Generic — apply EQ cut on all tracks
      const batchActions = tracks
        .filter((t) => !t.mute && t.clips.length > 0)
        .map((t) => ({
          type: 'addEffect' as const,
          trackId: t.id,
          effectType: 'eq',
          effectParams: { low: -6, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500 },
        }));
      suggestions.push({
        id: generateId('sug'),
        type: 'eq',
        priority: 'sidebar',
        targetTrackId: null,
        title: 'Low end buildup',
        description:
          'The mix has significant low-frequency energy. ' +
          'Will reduce low EQ by 6 dB across tracks to clean up the mix.',
        confidence: 0.65,
        status: 'pending',
        action: { type: 'batch', trackId: '', actions: batchActions },
        timestamp: Date.now(),
      });
    }
  }

  // Harsh highs — add EQ cut on high frequencies
  if (analysis.frequencyBalance.high - analysis.frequencyBalance.mid > 8) {
    const harshTracks = analysis.tracks
      .filter((t) => t.frequency.high > t.frequency.mid + 5)
      .map((t) => t.trackId);

    const eqActions = (harshTracks.length > 0
      ? harshTracks
      : tracks.filter((t) => !t.mute && t.clips.length > 0).map((t) => t.id)
    ).map((trackId) => ({
      type: 'addEffect' as const,
      trackId,
      effectType: 'eq',
      effectParams: { low: 0, mid: 0, high: -4, lowFrequency: 400, highFrequency: 2500 },
    }));

    const targetNames = (harshTracks.length > 0 ? harshTracks : [])
      .map((id) => tracks.find((t) => t.id === id)?.name)
      .filter(Boolean);

    suggestions.push({
      id: generateId('sug'),
      type: 'eq',
      priority: 'sidebar',
      targetTrackId: harshTracks[0] ?? null,
      title: 'Harsh high frequencies',
      description:
        'High-frequency energy is elevated. ' +
        `Will cut highs by 4 dB${targetNames.length > 0 ? ` on: ${targetNames.join(', ')}` : ' across tracks'} to reduce harshness.`,
      confidence: 0.6,
      status: 'pending',
      action: eqActions.length === 1
        ? eqActions[0]!
        : { type: 'batch', trackId: eqActions[0]?.trackId ?? '', actions: eqActions },
      timestamp: Date.now(),
    });
  }

  // Narrow stereo — spread tracks with calculated pan positions
  const activeTracks = tracks.filter(
    (t) => !t.mute && t.clips.length > 0,
  );
  const allCentered = activeTracks.every(
    (t) => Math.abs(t.pan) < 0.1,
  );
  if (activeTracks.length >= 3 && allCentered) {
    // Create pan spread: leave first track center, alternate L/R
    const panActions = activeTracks.slice(1).map((track, i) => ({
      type: 'setPan' as const,
      trackId: track.id,
      value: i % 2 === 0 ? -0.4 - (i * 0.1) : 0.4 + (i * 0.1),
    }));

    // Clamp pan values to [-1, 1]
    for (const a of panActions) {
      a.value = Math.max(-1, Math.min(1, a.value));
    }

    const trackNames = activeTracks.slice(1)
      .map((t, i) => `${t.name} ${panActions[i]!.value < 0 ? 'L' : 'R'}`)
      .join(', ');

    suggestions.push({
      id: generateId('sug'),
      type: 'pan',
      priority: 'sidebar',
      targetTrackId: null,
      title: 'Narrow stereo image',
      description:
        `All ${activeTracks.length} tracks are centered. Will spread: ${trackNames} ` +
        'for a wider, more engaging mix.',
      confidence: 0.8,
      status: 'pending',
      action: { type: 'batch', trackId: '', actions: panActions },
      timestamp: Date.now(),
    });
  }

  // Dynamic range — suggest compressor if dynamic range is very high
  for (const ta of analysis.tracks) {
    if (ta.level.dynamicRange > 30 && !ta.level.clipping) {
      const track = tracks.find((t) => t.id === ta.trackId);
      suggestions.push({
        id: generateId('sug'),
        type: 'compression',
        priority: 'sidebar',
        targetTrackId: ta.trackId,
        title: `Wide dynamics on "${track?.name ?? 'track'}"`,
        description:
          `Dynamic range is ${ta.level.dynamicRange.toFixed(0)} dB. ` +
          'Will add a gentle compressor to even out the levels.',
        confidence: 0.6,
        status: 'pending',
        action: {
          type: 'addEffect',
          trackId: ta.trackId,
          effectType: 'compressor',
          effectParams: { threshold: -20, ratio: 3, attack: 0.01, release: 0.2, knee: 10 },
        },
        timestamp: Date.now(),
      });
    }
  }

  // Noise floor — suggest if noise floor is high
  for (const ta of analysis.tracks) {
    if (ta.noiseFloor > -30) {
      const track = tracks.find((t) => t.id === ta.trackId);
      suggestions.push({
        id: generateId('sug'),
        type: 'noise',
        priority: 'sidebar',
        targetTrackId: ta.trackId,
        title: `High noise floor on "${track?.name ?? 'track'}"`,
        description:
          `Noise floor at ${ta.noiseFloor.toFixed(0)} dB. ` +
          'Will add a gate filter to reduce background noise in quiet sections.',
        confidence: 0.55,
        status: 'pending',
        action: {
          type: 'addEffect',
          trackId: ta.trackId,
          effectType: 'filter',
          effectParams: { frequency: 200, type: 'highpass', Q: 0.5, rolloff: -12 },
        },
        timestamp: Date.now(),
      });
    }
  }

  return suggestions;
}
