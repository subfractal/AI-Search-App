import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { useEffectsStore } from '@/stores/effects-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useHistoryStore } from '@/stores/history-store';
import { analyzeMix } from './mix-analyzer';
import { analyzeGainStaging } from './gain-staging';
import { detectSections } from './section-detector';
import { getGenreProfile } from './genre-profiles';
import { calculateLUFS } from './loudness-meter';
import { generateId } from '@/utils/id';
import { isAudioClip } from '@/types/audio';
import type {
  MixGenre,
  MasteringStage,
  MasteringResult,
  MasteringDecision,
  MasteringSnapshot,
  AudioSection,
} from '@/types/ai';

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

/** Find which section a track's dominant content falls in */
function getDominantSection(sections: AudioSection[]): AudioSection | null {
  if (sections.length === 0) return null;
  // Return the section with the highest energy (most representative for mastering)
  return sections.reduce((best, s) => (s.energy > best.energy ? s : best), sections[0]!);
}

/** Adjust compression params based on section characteristics */
function sectionAwareCompression(
  preset: MasteringPreset,
  sections: AudioSection[],
): { threshold: number; ratio: number; attack: number; release: number; sectionNote: string } {
  const dominant = getDominantSection(sections);
  if (!dominant || sections.length <= 1) {
    return {
      threshold: preset.compThreshold,
      ratio: preset.compRatio,
      attack: preset.compAttack,
      release: preset.compRelease,
      sectionNote: '',
    };
  }

  // High-energy sections (chorus/drop) need more aggressive compression
  const hasHighEnergy = sections.some((s) => s.energy > 0.7 && (s.label === 'chorus' || s.label === 'drop'));
  const hasLowEnergy = sections.some((s) => s.energy < 0.3 && (s.label === 'intro' || s.label === 'verse'));

  if (hasHighEnergy && hasLowEnergy) {
    // Wide dynamic range across sections — use moderate settings to preserve dynamics
    return {
      threshold: preset.compThreshold + 2,
      ratio: Math.max(1.5, preset.compRatio - 0.5),
      attack: preset.compAttack * 1.2,
      release: preset.compRelease * 1.1,
      sectionNote: 'Adjusted for wide section dynamics (intro/verse vs chorus)',
    };
  }

  if (hasHighEnergy) {
    return {
      threshold: preset.compThreshold - 1,
      ratio: preset.compRatio + 0.5,
      attack: preset.compAttack,
      release: preset.compRelease * 0.9,
      sectionNote: 'Tightened for high-energy sections (chorus/drop)',
    };
  }

  return {
    threshold: preset.compThreshold,
    ratio: preset.compRatio,
    attack: preset.compAttack,
    release: preset.compRelease,
    sectionNote: '',
  };
}

/** Adjust EQ based on section frequency characteristics */
function sectionAwareEQ(
  baseEqLow: number,
  baseEqHigh: number,
  preset: MasteringPreset,
  sections: AudioSection[],
): { eqLow: number; eqMid: number; eqHigh: number; sectionNote: string } {
  const hasIntro = sections.some((s) => s.label === 'intro');
  const hasChorus = sections.some((s) => s.label === 'chorus' || s.label === 'drop');

  if (hasIntro && hasChorus) {
    // Balance EQ for both sparse intro and dense chorus
    return {
      eqLow: Math.round((baseEqLow * 0.8) * 10) / 10,
      eqMid: preset.eqMid,
      eqHigh: Math.round((baseEqHigh * 0.9) * 10) / 10,
      sectionNote: 'EQ balanced for intro/chorus dynamics',
    };
  }

  return { eqLow: baseEqLow, eqMid: preset.eqMid, eqHigh: baseEqHigh, sectionNote: '' };
}

export function runMasteringPipeline(genre: MixGenre): MasteringResult {
  const aiState = useAIStore.getState();
  const session = useSessionStore.getState();
  const effects = useEffectsStore.getState();
  const mixer = useMixerStore.getState();
  const history = useHistoryStore.getState();
  const preset = getMasteringPreset(genre);
  const stages: MasteringStage[] = [];
  const decisions: MasteringDecision[] = [];
  const undoActions: Array<{ undo: () => void; redo: () => void }> = [];

  aiState.setMasteringInProgress(true);

  // Clear pending suggestions — mastering supersedes individual suggestions
  aiState.clearSuggestions();
  aiState.resetAppliedSignatures();

  // Capture before-snapshot for A/B comparison
  const snapshot: MasteringSnapshot = { trackVolumes: {}, trackPans: {} };
  for (const track of session.tracks) {
    snapshot.trackVolumes[track.id] = track.volume;
    snapshot.trackPans[track.id] = track.pan;
  }

  try {
    // Detect song sections
    const sections = detectSections(session.tracks, session.config.sampleRate);

    // Stage 1: Gain Staging
    const analysis = analyzeMix(session.tracks, session.config.sampleRate);
    if (analysis.tracks.length >= 2) {
      const gainResult = analyzeGainStaging(analysis.tracks);
      // Apply gain staging manually (not via applyGainStaging) to track decisions
      for (const t of gainResult.tracks) {
        const beforeVol = session.tracks.find((tr) => tr.id === t.trackId)?.volume ?? 0;
        mixer.setVolume(t.trackId, t.suggestedVolume);
        session.updateTrack(t.trackId, { volume: t.suggestedVolume });

        decisions.push({
          id: generateId('md'),
          stage: 'Gain Staging',
          trackId: t.trackId,
          trackName: t.trackName,
          effectId: null,
          effectType: null,
          params: { volume: t.suggestedVolume, adjustment: t.adjustment },
          description: `${t.adjustment > 0 ? '+' : ''}${t.adjustment.toFixed(1)} dB → ${t.suggestedVolume.toFixed(1)} dB`,
          enabled: true,
        });

        const trackId = t.trackId;
        const newVol = t.suggestedVolume;
        undoActions.push({
          undo: () => {
            useMixerStore.getState().setVolume(trackId, beforeVol);
            useSessionStore.getState().updateTrack(trackId, { volume: beforeVol });
          },
          redo: () => {
            useMixerStore.getState().setVolume(trackId, newVol);
            useSessionStore.getState().updateTrack(trackId, { volume: newVol });
          },
        });
      }
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

    // Stage 2: EQ Balance (section-aware)
    const eqEffects: string[] = [];
    for (const track of session.tracks) {
      if (track.mute || track.clips.length === 0) continue;
      const ta = analysis.tracks.find((t) => t.trackId === track.id);
      if (!ta) continue;

      const needsEq =
        Math.abs(ta.frequency.low - ta.frequency.mid) > 8 ||
        Math.abs(ta.frequency.high - ta.frequency.mid) > 6;

      if (needsEq) {
        const baseEqLow = ta.frequency.low > ta.frequency.mid + 8 ? -4 : preset.eqLow;
        const baseEqHigh = ta.frequency.high > ta.frequency.mid + 6 ? -3 : preset.eqHigh;
        const { eqLow, eqMid, eqHigh, sectionNote } = sectionAwareEQ(baseEqLow, baseEqHigh, preset, sections);

        const eqParams = { low: eqLow, mid: eqMid, high: eqHigh, lowFrequency: 400, highFrequency: 2500 };
        const effectId = effects.addEffect(track.id, 'eq', eqParams);

        decisions.push({
          id: generateId('md'),
          stage: 'EQ Balance',
          trackId: track.id,
          trackName: track.name,
          effectId,
          effectType: 'eq',
          params: { low: eqLow, mid: eqMid, high: eqHigh, lowFrequency: 400, highFrequency: 2500 },
          description: `Low ${eqLow > 0 ? '+' : ''}${eqLow}dB, Mid ${eqMid}dB, High ${eqHigh > 0 ? '+' : ''}${eqHigh}dB${sectionNote ? ` (${sectionNote})` : ''}`,
          enabled: true,
        });

        const tId = track.id;
        const fxId = effectId;
        undoActions.push({
          undo: () => useEffectsStore.getState().removeEffect(tId, fxId),
          redo: () => useEffectsStore.getState().addEffect(tId, 'eq', eqParams),
        });

        eqEffects.push(`${track.name}: EQ adjusted`);
      }
    }
    stages.push({
      name: 'EQ Balance',
      description: eqEffects.length > 0
        ? `Applied corrective EQ to ${eqEffects.length} tracks${sections.length > 1 ? ' (section-aware)' : ''}`
        : 'No EQ correction needed',
      applied: eqEffects.length > 0,
      effects: eqEffects,
    });

    // Stage 3: Compression (section-aware)
    const compEffects: string[] = [];
    const { threshold: compThresh, ratio: compRatio, attack: compAttack, release: compRelease, sectionNote: compNote } =
      sectionAwareCompression(preset, sections);

    for (const ta of analysis.tracks) {
      const track = session.tracks.find((t) => t.id === ta.trackId);
      if (!track || track.mute) continue;
      const profile = getGenreProfile(genre);

      if (ta.level.dynamicRange > profile.dynamicRangeMax) {
        const compParams = {
          threshold: compThresh,
          ratio: compRatio,
          attack: compAttack,
          release: compRelease,
          knee: 10,
        };
        const effectId = effects.addEffect(track.id, 'compressor', compParams);

        decisions.push({
          id: generateId('md'),
          stage: 'Compression',
          trackId: track.id,
          trackName: track.name,
          effectId,
          effectType: 'compressor',
          params: { threshold: compThresh, ratio: compRatio, attack: compAttack, release: compRelease, knee: 10 },
          description: `${compRatio}:1 @ ${compThresh}dB${compNote ? ` — ${compNote}` : ''}`,
          enabled: true,
        });

        const tId = track.id;
        const fxId = effectId;
        undoActions.push({
          undo: () => useEffectsStore.getState().removeEffect(tId, fxId),
          redo: () => useEffectsStore.getState().addEffect(tId, 'compressor', compParams),
        });

        compEffects.push(`${track.name}: ${compRatio}:1 compression`);
      }
    }
    stages.push({
      name: 'Compression',
      description: compEffects.length > 0
        ? `Compressed ${compEffects.length} tracks for ${genre} dynamics${compNote ? ` (${compNote})` : ''}`
        : 'Dynamics within target range',
      applied: compEffects.length > 0,
      effects: compEffects,
    });

    // Stage 4: Limiting (apply to loudest track as master bus proxy)
    const sortedTracks = [...analysis.tracks].sort((a, b) => b.level.peak - a.level.peak);
    const loudestTrack = sortedTracks[0];
    if (loudestTrack && loudestTrack.level.peak > preset.limiterThreshold) {
      const track = session.tracks.find((t) => t.id === loudestTrack.trackId);
      const limiterParams = {
        threshold: preset.limiterThreshold,
        ratio: 20,
        attack: 0.001,
        release: 0.05,
        knee: 0,
      };
      const effectId = effects.addEffect(loudestTrack.trackId, 'compressor', limiterParams);

      decisions.push({
        id: generateId('md'),
        stage: 'Limiting',
        trackId: loudestTrack.trackId,
        trackName: track?.name ?? 'track',
        effectId,
        effectType: 'compressor',
        params: { threshold: preset.limiterThreshold, ratio: 20, attack: 0.001, release: 0.05, knee: 0 },
        description: `Ceiling limiter at ${preset.limiterThreshold} dBTP (20:1)`,
        enabled: true,
      });

      const tId = loudestTrack.trackId;
      const fxId = effectId;
      undoActions.push({
        undo: () => useEffectsStore.getState().removeEffect(tId, fxId),
        redo: () => useEffectsStore.getState().addEffect(tId, 'compressor', limiterParams),
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

    // Wrap all actions in a single history batch
    if (undoActions.length > 0) {
      history.batchAction(`Mastering pipeline (${genre})`, undoActions);
    }

    const result: MasteringResult = {
      stages,
      decisions,
      sections,
      snapshot,
      finalLufs,
      finalTruePeak,
      genre,
    };

    aiState.setMasteringResult(result);
    aiState.setMasteringDecisions(decisions);
    aiState.logActivity({
      id: `log-${Date.now()}`,
      description: `Mastering complete (${genre}): ${decisions.length} decisions across ${sections.length} sections, ${finalLufs.toFixed(1)} LUFS`,
      trackId: null,
      timestamp: Date.now(),
      undoable: undoActions.length > 0,
    });

    return result;
  } finally {
    aiState.setMasteringInProgress(false);
  }
}
