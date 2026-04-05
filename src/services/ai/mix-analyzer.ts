import type {
  MixAnalysis,
  TrackAnalysis,
  FrequencyAnalysis,
  LevelAnalysis,
  LoudnessResult,
  AISuggestion,
  SuggestionEvidence,
  SuggestionConstraint,
  MixGenre,
  PhaseCorrelation,
} from '@/types/ai';
import type { Track } from '@/types/audio';
import { isAudioClip } from '@/types/audio';
import { analyzeTrack, analyzeTrackRegions } from './analysis-engine';
import { calculateLUFS } from './loudness-meter';
import { analyzeAllMasking } from './masking-detector';
import { analyzeGainStaging } from './gain-staging';
import { getGenreProfile, STREAMING_TARGETS } from './genre-profiles';
import { analyzePhaseCorrelation } from './phase-detector';
import { generateId } from '@/utils/id';

function formatRegionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ev(label: string, value: string | number | boolean): SuggestionEvidence {
  return { label, value };
}
function cst(label: string, value: string): SuggestionConstraint {
  return { label, value };
}

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
  const maskingPairs = analyzeAllMasking(trackAnalyses);

  // Phase correlation analysis for stereo tracks
  const phaseCorrelations: PhaseCorrelation[] = [];
  for (const track of tracks) {
    const audioClip = track.clips.find(isAudioClip);
    if (audioClip && audioClip.buffer.numberOfChannels >= 2) {
      phaseCorrelations.push(
        analyzePhaseCorrelation(track.id, audioClip.buffer),
      );
    }
  }

  // Calculate overall loudness from first available buffer
  let overallLoudness: LoudnessResult | null = null;
  try {
    const firstClip = tracks.flatMap((t) => t.clips).find(isAudioClip);
    if (firstClip) {
      overallLoudness = calculateLUFS(firstClip.buffer);
    }
  } catch {
    // Loudness calculation may fail
  }

  return {
    tracks: trackAnalyses,
    overallLevel,
    overallLoudness,
    frequencyBalance,
    stereoWidth,
    maskingPairs,
    phaseCorrelations,
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
  genre: MixGenre = 'general',
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const profile = getGenreProfile(genre);

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
        rationale: 'Peaks above 0 dBFS cause digital distortion and audible crackling.',
        evidence: [
          ev('Peak', `${ta.level.peak > 0 ? '+' : ''}${ta.level.peak.toFixed(1)} dB`),
          ev('Track', track?.name ?? 'unknown'),
        ],
        constraints: [cst('Max gain change', '−3 dB')],
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
        rationale: 'Large level differences make quieter elements inaudible and distort the mix balance.',
        evidence: [
          ev('Loudest', `${loudTrack?.name} (${loudest.rms.toFixed(1)} dB)`),
          ev('Quietest', `${quietTrack?.name} (${quietest.rms.toFixed(1)} dB)`),
          ev('Difference', `${diff.toFixed(1)} dB`),
        ],
        constraints: [cst('Max volume delta', '±3 dB')],
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
        rationale: 'Excessive sub-bass energy causes muddiness and reduces headroom for the entire mix.',
        evidence: [
          ev('Sub energy', `${analysis.frequencyBalance.low.toFixed(1)} dB`),
          ev('Mid energy', `${analysis.frequencyBalance.mid.toFixed(1)} dB`),
          ev('Tracks', targetNames.join(', ') || 'multiple'),
        ],
        constraints: [cst('Action', 'Preview recommended')],
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
        rationale: 'Excessive sub-bass energy causes muddiness and reduces headroom for the entire mix.',
        evidence: [
          ev('Sub energy', `${analysis.frequencyBalance.low.toFixed(1)} dB`),
          ev('Mid energy', `${analysis.frequencyBalance.mid.toFixed(1)} dB`),
        ],
        constraints: [cst('Action', 'Preview recommended')],
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
      rationale: 'Elevated high frequencies cause listener fatigue and sibilance issues.',
      evidence: [
        ev('HF energy', `${analysis.frequencyBalance.high.toFixed(1)} dB`),
        ev('Mid energy', `${analysis.frequencyBalance.mid.toFixed(1)} dB`),
        ...(targetNames.length > 0 ? [ev('Tracks', targetNames.join(', '))] : []),
      ],
      constraints: [cst('Action', 'Preview recommended')],
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
      rationale: 'A mono-heavy mix lacks depth and dimension. Pan separation improves clarity.',
      evidence: [
        ev('Width', `${Math.round(analysis.stereoWidth * 100)}%`),
        ev('Centered tracks', activeTracks.length),
      ],
      constraints: [cst('Max pan delta', '±0.35')],
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
        rationale: 'Very wide dynamics make quiet parts inaudible and loud parts jarring.',
        evidence: [
          ev('DR', `${ta.level.dynamicRange.toFixed(1)} dB`),
          ev('Track', track?.name ?? 'unknown'),
        ],
        constraints: [cst('Action', 'Preview recommended')],
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
        rationale: 'Audible noise floor degrades mix clarity, especially during quiet passages.',
        evidence: [
          ev('Noise floor', `${ta.noiseFloor.toFixed(0)} dB`),
          ev('Track', track?.name ?? 'unknown'),
        ],
        constraints: [cst('Action', 'Offline recommended')],
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

  // Masking detection — flag frequency collisions with specific band recommendations
  if (analysis.maskingPairs.length > 0) {
    for (const pair of analysis.maskingPairs.slice(0, 3)) {
      const trackA = tracks.find((t) => t.id === pair.trackAId);
      const trackB = tracks.find((t) => t.id === pair.trackBId);
      const nonDominantId =
        pair.dominantTrackId === pair.trackAId ? pair.trackBId : pair.trackAId;
      const nonDominantTrack = tracks.find((t) => t.id === nonDominantId);

      // Provide specific EQ recommendations based on which bands are masked
      const hasMud = pair.maskedBands.some((b) => b.includes('Low-Mid'));
      const hasPresence = pair.maskedBands.some((b) => b.includes('Mid (1k'));
      const hasLow = pair.maskedBands.some((b) => b.includes('Low ('));

      let eqParams: Record<string, number | string> = { low: -3, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500 };
      let eqAdvice = '';

      if (hasMud) {
        eqParams = { low: -4, mid: 0, high: 0, lowFrequency: 350, highFrequency: 2500 };
        eqAdvice = 'Cut 200-500 Hz to remove mud. ';
      } else if (hasPresence) {
        eqParams = { low: 0, mid: -3, high: 0, lowFrequency: 400, highFrequency: 3000 };
        eqAdvice = 'Cut 1-4 kHz to reduce presence clash. ';
      } else if (hasLow) {
        eqAdvice = 'Add 80 Hz high-pass filter to clean low end. ';
      }

      suggestions.push({
        id: generateId('sug'),
        type: 'masking',
        priority: 'inline',
        targetTrackId: nonDominantId,
        title: `Masking: "${trackA?.name}" vs "${trackB?.name}"`,
        description:
          `Frequency collision in ${pair.maskedBands.join(', ')}. ` +
          `${eqAdvice}` +
          `Severity: ${Math.round(pair.severity * 100)}%. ` +
          `Apply EQ cut on "${nonDominantTrack?.name}".`,
        rationale: 'Frequency masking makes instruments compete for the same spectral space, reducing clarity.',
        evidence: [
          ev('Bands', pair.maskedBands.join(', ')),
          ev('Severity', `${Math.round(pair.severity * 100)}%`),
          ev('Tracks', `${trackA?.name} & ${trackB?.name}`),
        ],
        constraints: [cst('Action', 'Manual review')],
        confidence: Math.min(0.85, pair.severity),
        status: 'pending',
        action: {
          type: 'addEffect',
          trackId: nonDominantId,
          effectType: 'eq',
          effectParams: eqParams,
        },
        timestamp: Date.now(),
      });
    }
  }

  // Genre-aware loudness suggestions with streaming platform targets
  if (analysis.overallLoudness) {
    const lufs = analysis.overallLoudness.integrated;
    const targetLufs = profile.targetLufs;

    // Check against genre-specific target
    if (lufs > targetLufs + 3 && lufs > -Infinity) {
      const failingPlatforms = STREAMING_TARGETS
        .filter((p) => lufs > p.integratedLufs)
        .map((p) => `${p.name} (${p.integratedLufs} LUFS)`)
        .join(', ');

      suggestions.push({
        id: generateId('sug'),
        type: 'loudness',
        priority: 'sidebar',
        targetTrackId: null,
        title: `Mix too loud for ${profile.name}`,
        description:
          `Integrated loudness is ${lufs.toFixed(1)} LUFS. ` +
          `${profile.name} target: ${targetLufs} LUFS. ` +
          (failingPlatforms ? `Will be turned down on: ${failingPlatforms}.` : ''),
        rationale: 'Exceeding platform loudness targets causes automatic gain reduction and pumping artifacts.',
        evidence: [
          ev('LUFS', `${lufs.toFixed(1)}`),
          ev('Target', `${targetLufs} LUFS`),
          ev('True peak', `${analysis.overallLoudness!.truePeak.toFixed(1)} dBTP`),
        ],
        constraints: [cst('Scope', 'Master bus: manual only')],
        confidence: 0.8,
        status: 'pending',
        action: null,
        timestamp: Date.now(),
      });
    } else if (lufs < targetLufs - 6 && lufs > -Infinity) {
      suggestions.push({
        id: generateId('sug'),
        type: 'loudness',
        priority: 'sidebar',
        targetTrackId: null,
        title: `Mix too quiet for ${profile.name}`,
        description:
          `Integrated loudness is ${lufs.toFixed(1)} LUFS. ` +
          `${profile.name} target: ${targetLufs} LUFS. ` +
          `Consider raising levels for competitive loudness.`,
        rationale: 'A mix significantly below genre loudness targets will sound weak next to other releases.',
        evidence: [
          ev('LUFS', `${lufs.toFixed(1)}`),
          ev('Target', `${targetLufs} LUFS`),
        ],
        constraints: [cst('Scope', 'Master bus: manual only')],
        confidence: 0.7,
        status: 'pending',
        action: null,
        timestamp: Date.now(),
      });
    }

    // True peak ceiling enforcement — industry standard -1.0 dBTP
    if (analysis.overallLoudness.truePeak > profile.maxTruePeak) {
      const failingPeakPlatforms = STREAMING_TARGETS
        .filter((p) => analysis.overallLoudness!.truePeak > p.maxTruePeak)
        .map((p) => p.name)
        .join(', ');

      suggestions.push({
        id: generateId('sug'),
        type: 'loudness',
        priority: 'auto',
        targetTrackId: null,
        title: `True peak exceeds ${profile.maxTruePeak} dBTP ceiling`,
        description:
          `True peak is ${analysis.overallLoudness.truePeak > 0 ? '+' : ''}${analysis.overallLoudness.truePeak.toFixed(1)} dBTP. ` +
          `Industry standard ceiling is -1.0 dBTP to prevent inter-sample clipping. ` +
          (failingPeakPlatforms ? `Exceeds limits for: ${failingPeakPlatforms}.` : '') +
          ` Consider adding a limiter with -1.0 dBTP ceiling.`,
        rationale: 'True peaks above -1.0 dBTP cause inter-sample clipping in lossy codecs (MP3, AAC).',
        evidence: [
          ev('True peak', `${analysis.overallLoudness.truePeak > 0 ? '+' : ''}${analysis.overallLoudness.truePeak.toFixed(1)} dBTP`),
          ev('Ceiling', `${profile.maxTruePeak} dBTP`),
        ],
        constraints: [cst('Scope', 'Master bus: manual only')],
        confidence: 0.92,
        status: 'pending',
        action: null,
        timestamp: Date.now(),
      });
    }

    // Dynamic range check — genre-aware
    const dr = analysis.overallLevel.dynamicRange;
    if (dr < profile.dynamicRangeMin) {
      suggestions.push({
        id: generateId('sug'),
        type: 'compression',
        priority: 'sidebar',
        targetTrackId: null,
        title: `Over-compressed for ${profile.name}`,
        description:
          `Dynamic range is ${dr.toFixed(1)} dB, below the ${profile.dynamicRangeMin} dB minimum for ${profile.name}. ` +
          `This can sound fatiguing. Consider reducing compression or limiter settings.`,
        rationale: 'Excessive compression eliminates dynamics and causes listener fatigue.',
        evidence: [
          ev('DR', `${dr.toFixed(1)} dB`),
          ev('Genre min', `${profile.dynamicRangeMin} dB`),
        ],
        confidence: 0.65,
        status: 'pending',
        action: null,
        timestamp: Date.now(),
      });
    }
  }

  // Phase correlation warnings — detect mono incompatibility
  for (const phase of analysis.phaseCorrelations) {
    if (!phase.monoCompatible) {
      const track = tracks.find((t) => t.id === phase.trackId);
      suggestions.push({
        id: generateId('sug'),
        type: 'general',
        priority: 'inline',
        targetTrackId: phase.trackId,
        title: `Phase issue on "${track?.name ?? 'track'}"`,
        description:
          `Phase correlation is ${phase.correlation.toFixed(2)} (negative = out of phase). ` +
          `This track will lose energy or cancel when summed to mono. ` +
          `Check stereo processing or flip polarity on one channel.`,
        rationale: 'Negative phase correlation causes signal cancellation in mono playback systems.',
        evidence: [
          ev('Correlation', phase.correlation.toFixed(2)),
          ev('Track', track?.name ?? 'unknown'),
        ],
        constraints: [cst('Action', 'Manual review')],
        confidence: 0.8,
        status: 'pending',
        action: null,
        timestamp: Date.now(),
      });
    } else if (phase.correlation < 0.3 && phase.correlation >= 0) {
      const track = tracks.find((t) => t.id === phase.trackId);
      suggestions.push({
        id: generateId('sug'),
        type: 'general',
        priority: 'sidebar',
        targetTrackId: phase.trackId,
        title: `Wide stereo on "${track?.name ?? 'track'}"`,
        description:
          `Phase correlation is ${phase.correlation.toFixed(2)}. Very wide stereo content ` +
          `may not translate well to mono playback (phone speakers, PA systems). ` +
          `Consider narrowing bass frequencies while keeping highs wide.`,
        rationale: 'Very wide stereo may lose energy on mono playback systems like phone speakers.',
        evidence: [
          ev('Correlation', phase.correlation.toFixed(2)),
          ev('Track', track?.name ?? 'unknown'),
        ],
        confidence: 0.5,
        status: 'pending',
        action: null,
        timestamp: Date.now(),
      });
    }
  }

  // Region-specific analysis — find localized issues
  for (const ta of analysis.tracks) {
    const track = tracks.find((t) => t.id === ta.trackId);
    const audioClip = track?.clips.find(isAudioClip);
    if (!audioClip || audioClip.buffer.length / (audioClip.buffer.sampleRate || 44100) < 5) continue;

    const regions = analyzeTrackRegions(
      ta.trackId,
      audioClip.buffer,
      audioClip.buffer.sampleRate,
      5,
    );

    for (const region of regions) {
      // Region clipping
      if (region.level.clipping && !ta.level.clipping) {
        const startFmt = formatRegionTime(region.region.start);
        const endFmt = formatRegionTime(region.region.end);
        suggestions.push({
          id: generateId('sug'),
          type: 'clipping',
          priority: 'inline',
          targetTrackId: ta.trackId,
          title: `Clipping at ${startFmt}–${endFmt} on "${track?.name ?? 'track'}"`,
          description:
            `Peak level is ${region.level.peak.toFixed(1)} dB in this region. ` +
            'Consider reducing gain or applying a limiter.',
          rationale: 'Localized clipping indicates transients or loud passages that exceed 0 dBFS.',
          evidence: [
            ev('Peak', `${region.level.peak.toFixed(1)} dB`),
            ev('Region', `${startFmt}–${endFmt}`),
          ],
          constraints: [cst('Max gain', '−3 dB')],
          confidence: 0.85,
          status: 'pending',
          action: null,
          regionStart: region.region.start,
          regionEnd: region.region.end,
          timestamp: Date.now(),
        });
      }

      // Region low-end buildup compared to whole-track average
      const lowDiff = region.frequency.low - ta.frequency.low;
      if (lowDiff > 8 && region.frequency.low - region.frequency.mid > 12) {
        const startFmt = formatRegionTime(region.region.start);
        const endFmt = formatRegionTime(region.region.end);
        suggestions.push({
          id: generateId('sug'),
          type: 'eq',
          priority: 'sidebar',
          targetTrackId: ta.trackId,
          title: `Low end buildup at ${startFmt}–${endFmt}`,
          description:
            `Low frequency energy is ${lowDiff.toFixed(0)} dB above track average ` +
            `in this section of "${track?.name ?? 'track'}".`,
          rationale: 'Localized low-end energy spikes cause muddiness in specific sections.',
          evidence: [
            ev('Sub excess', `+${lowDiff.toFixed(0)} dB vs avg`),
            ev('Region', `${startFmt}–${endFmt}`),
          ],
          confidence: 0.6,
          status: 'pending',
          action: null,
          regionStart: region.region.start,
          regionEnd: region.region.end,
          timestamp: Date.now(),
        });
      }

      // Region volume spike
      const peakDiff = region.level.peak - ta.level.rms;
      if (peakDiff > 20 && region.level.peak > -3) {
        const startFmt = formatRegionTime(region.region.start);
        suggestions.push({
          id: generateId('sug'),
          type: 'level',
          priority: 'sidebar',
          targetTrackId: ta.trackId,
          title: `Volume spike at ${startFmt} on "${track?.name ?? 'track'}"`,
          description:
            `Peak reaches ${region.level.peak.toFixed(1)} dB, ` +
            `${peakDiff.toFixed(0)} dB above track RMS average.`,
          rationale: 'Sudden volume spikes cause inconsistent listening experience and potential clipping.',
          evidence: [
            ev('Peak', `${region.level.peak.toFixed(1)} dB`),
            ev('Above avg', `+${peakDiff.toFixed(0)} dB`),
          ],
          confidence: 0.55,
          status: 'pending',
          action: null,
          regionStart: region.region.start,
          regionEnd: region.region.end,
          timestamp: Date.now(),
        });
      }
    }
  }

  // Gain staging suggestion
  if (analysis.tracks.length >= 2) {
    const gainResult = analyzeGainStaging(analysis.tracks);
    const tracksNeedingAdjustment = gainResult.tracks.filter(
      (t) => Math.abs(t.adjustment) > 2,
    );
    if (tracksNeedingAdjustment.length > 0) {
      const batchActions = tracksNeedingAdjustment.map((t) => ({
        type: 'setVolume' as const,
        trackId: t.trackId,
        value: t.suggestedVolume,
      }));

      const headroom = analysis.overallLevel.peak < 0
        ? `${Math.abs(analysis.overallLevel.peak).toFixed(1)} dB`
        : 'none (clipping)';
      suggestions.push({
        id: generateId('sug'),
        type: 'gain-staging',
        priority: 'sidebar',
        targetTrackId: null,
        title: 'Gain staging needed',
        description:
          `${tracksNeedingAdjustment.length} track(s) need level adjustment for proper headroom. ` +
          `Target: -6 dBFS peak per track.`,
        rationale: 'Proper gain staging ensures headroom for mixing and prevents distortion in the signal chain.',
        evidence: [
          ev('Tracks to adjust', tracksNeedingAdjustment.length),
          ev('Headroom', headroom),
        ],
        constraints: [cst('Max gain', '±3 dB')],
        confidence: 0.75,
        status: 'pending',
        action: {
          type: 'batch',
          trackId: '',
          actions: batchActions,
        },
        timestamp: Date.now(),
      });
    }
  }

  return suggestions;
}
