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

  if (analysis.frequencyBalance.low - analysis.frequencyBalance.mid > 10) {
    suggestions.push({
      id: generateId('sug'),
      type: 'eq',
      priority: 'sidebar',
      targetTrackId: null,
      title: 'Low end buildup',
      description:
        'The mix has significant low-frequency energy compared to mids. ' +
        'Consider high-passing some tracks below 80 Hz to clean up the low end.',
      confidence: 0.65,
      status: 'pending',
      action: null,
      timestamp: Date.now(),
    });
  }

  if (analysis.frequencyBalance.high - analysis.frequencyBalance.mid > 8) {
    suggestions.push({
      id: generateId('sug'),
      type: 'eq',
      priority: 'sidebar',
      targetTrackId: null,
      title: 'Harsh high frequencies',
      description:
        'High-frequency energy is elevated relative to the midrange. ' +
        'This can cause listener fatigue. Consider taming the highs.',
      confidence: 0.6,
      status: 'pending',
      action: null,
      timestamp: Date.now(),
    });
  }

  const activeTracks = tracks.filter(
    (t) => !t.mute && t.clips.length > 0,
  );
  const allCentered = activeTracks.every(
    (t) => Math.abs(t.pan) < 0.1,
  );
  if (activeTracks.length >= 3 && allCentered) {
    suggestions.push({
      id: generateId('sug'),
      type: 'pan',
      priority: 'sidebar',
      targetTrackId: null,
      title: 'Narrow stereo image',
      description:
        'All tracks are panned center. Spreading some elements ' +
        'left and right will create a wider, more engaging mix.',
      confidence: 0.8,
      status: 'pending',
      action: null,
      timestamp: Date.now(),
    });
  }

  return suggestions;
}
