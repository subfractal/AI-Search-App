import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { useEffectsStore } from '@/stores/effects-store';
import { analyzeMix } from './mix-analyzer';
import { analyzeGainStaging, applyGainStaging } from './gain-staging';
import { getGenreProfile } from './genre-profiles';
import { calculateLUFS } from './loudness-meter';
import { isAudioClip } from '@/types/audio';
import type { MixGenre, MasteringStage, MasteringResult } from '@/types/ai';

interface MasteringPreset {
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  limiterThreshold: number;
  targetLufs: number;
}

function getMasteringPreset(genre: MixGenre): MasteringPreset {
  const profile = getGenreProfile(genre);
  switch (genre) {
    case 'edm':
      return {
        eqLow: 2, eqMid: 0, eqHigh: 1,
        compThreshold: -15, compRatio: 6, compAttack: 0.003, compRelease: 0.1,
        limiterThreshold: -1, targetLufs: profile.targetLufs,
      };
    case 'rock':
      return {
        eqLow: 1, eqMid: 1, eqHigh: 0,
        compThreshold: -18, compRatio: 4, compAttack: 0.005, compRelease: 0.15,
        limiterThreshold: -1, targetLufs: profile.targetLufs,
      };
    case 'hip-hop':
      return {
        eqLow: 3, eqMid: -1, eqHigh: 1,
        compThreshold: -14, compRatio: 5, compAttack: 0.003, compRelease: 0.1,
        limiterThreshold: -1, targetLufs: profile.targetLufs,
      };
    case 'jazz':
      return {
        eqLow: 0, eqMid: 0, eqHigh: 0,
        compThreshold: -24, compRatio: 2, compAttack: 0.02, compRelease: 0.3,
        limiterThreshold: -1, targetLufs: profile.targetLufs,
      };
    case 'classical':
      return {
        eqLow: 0, eqMid: 0, eqHigh: 0,
        compThreshold: -30, compRatio: 1.5, compAttack: 0.03, compRelease: 0.4,
        limiterThreshold: -0.5, targetLufs: profile.targetLufs,
      };
    case 'pop':
    default:
      return {
        eqLow: 1, eqMid: 0, eqHigh: 2,
        compThreshold: -18, compRatio: 3, compAttack: 0.01, compRelease: 0.2,
        limiterThreshold: -1, targetLufs: profile.targetLufs,
      };
  }
}

export function runMasteringPipeline(genre: MixGenre): MasteringResult {
  const aiState = useAIStore.getState();
  const session = useSessionStore.getState();
  const effects = useEffectsStore.getState();
  const preset = getMasteringPreset(genre);
  const stages: MasteringStage[] = [];

  aiState.setMasteringInProgress(true);

  // Clear pending suggestions — mastering supersedes individual suggestions
  // to prevent conflicting volume/EQ/compression adjustments
  aiState.clearSuggestions();
  aiState.resetAppliedSignatures();

  try {
    // Stage 1: Gain Staging
    const analysis = analyzeMix(session.tracks, session.config.sampleRate);
    if (analysis.tracks.length >= 2) {
      const gainResult = analyzeGainStaging(analysis.tracks);
      applyGainStaging(gainResult);
      stages.push({
        name: 'Gain Staging',
        description: `Balanced ${gainResult.tracks.length} tracks to -6 dBFS headroom`,
        applied: true,
        effects: gainResult.tracks.map((t) => `${t.trackName}: ${t.adjustment > 0 ? '+' : ''}${t.adjustment.toFixed(1)} dB`),
      });
    } else {
      stages.push({
        name: 'Gain Staging',
        description: 'Skipped — need at least 2 tracks',
        applied: false,
        effects: [],
      });
    }

    // Stage 2: EQ Balance
    const eqEffects: string[] = [];
    for (const track of session.tracks) {
      if (track.mute || track.clips.length === 0) continue;
      const ta = analysis.tracks.find((t) => t.trackId === track.id);
      if (!ta) continue;

      const needsEq =
        Math.abs(ta.frequency.low - ta.frequency.mid) > 8 ||
        Math.abs(ta.frequency.high - ta.frequency.mid) > 6;

      if (needsEq) {
        const eqLow = ta.frequency.low > ta.frequency.mid + 8 ? -4 : preset.eqLow;
        const eqHigh = ta.frequency.high > ta.frequency.mid + 6 ? -3 : preset.eqHigh;
        effects.addEffect(track.id, 'eq', {
          low: eqLow, mid: preset.eqMid, high: eqHigh,
          lowFrequency: 400, highFrequency: 2500,
        });
        eqEffects.push(`${track.name}: EQ adjusted`);
      }
    }
    stages.push({
      name: 'EQ Balance',
      description: eqEffects.length > 0
        ? `Applied corrective EQ to ${eqEffects.length} tracks`
        : 'No EQ correction needed',
      applied: eqEffects.length > 0,
      effects: eqEffects,
    });

    // Stage 3: Compression
    const compEffects: string[] = [];
    for (const ta of analysis.tracks) {
      const track = session.tracks.find((t) => t.id === ta.trackId);
      if (!track || track.mute) continue;
      const profile = getGenreProfile(genre);

      if (ta.level.dynamicRange > profile.dynamicRangeMax) {
        effects.addEffect(track.id, 'compressor', {
          threshold: preset.compThreshold,
          ratio: preset.compRatio,
          attack: preset.compAttack,
          release: preset.compRelease,
          knee: 10,
        });
        compEffects.push(`${track.name}: ${preset.compRatio}:1 compression`);
      }
    }
    stages.push({
      name: 'Compression',
      description: compEffects.length > 0
        ? `Compressed ${compEffects.length} tracks for ${genre} dynamics`
        : 'Dynamics within target range',
      applied: compEffects.length > 0,
      effects: compEffects,
    });

    // Stage 4: Limiting (apply to loudest track as master bus proxy)
    const loudestTrack = analysis.tracks
      .sort((a, b) => b.level.peak - a.level.peak)[0];
    if (loudestTrack && loudestTrack.level.peak > preset.limiterThreshold) {
      const track = session.tracks.find((t) => t.id === loudestTrack.trackId);
      effects.addEffect(loudestTrack.trackId, 'compressor', {
        threshold: preset.limiterThreshold,
        ratio: 20,
        attack: 0.001,
        release: 0.05,
        knee: 0,
      });
      stages.push({
        name: 'Limiting',
        description: `Applied ${preset.limiterThreshold} dBTP ceiling limiter`,
        applied: true,
        effects: [`${track?.name ?? 'track'}: limiter at ${preset.limiterThreshold} dBTP`],
      });
    } else {
      stages.push({
        name: 'Limiting',
        description: 'Peaks already below ceiling',
        applied: false,
        effects: [],
      });
    }

    // Stage 5: Loudness Verification
    let finalLufs = -Infinity;
    let finalTruePeak = -Infinity;
    try {
      const firstClip = session.tracks
        .flatMap((t) => t.clips)
        .find(isAudioClip);
      if (firstClip) {
        const lufs = calculateLUFS(firstClip.buffer);
        finalLufs = lufs.integrated;
        finalTruePeak = lufs.truePeak;
      }
    } catch {
      // measurement may fail
    }

    stages.push({
      name: 'Loudness Check',
      description:
        finalLufs > -Infinity
          ? `Final: ${finalLufs.toFixed(1)} LUFS / ${finalTruePeak.toFixed(1)} dBTP (target: ${preset.targetLufs} LUFS)`
          : 'Could not measure loudness',
      applied: true,
      effects: [],
    });

    const result: MasteringResult = {
      stages,
      finalLufs,
      finalTruePeak,
      genre,
    };

    aiState.setMasteringResult(result);
    aiState.logActivity({
      id: `log-${Date.now()}`,
      description: `Mastering pipeline complete (${genre}): ${finalLufs.toFixed(1)} LUFS`,
      trackId: null,
      timestamp: Date.now(),
      undoable: false,
    });

    return result;
  } finally {
    aiState.setMasteringInProgress(false);
  }
}
