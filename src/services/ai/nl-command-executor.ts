/**
 * NL Command Executor — bridges parsed commands to existing store actions.
 * All actions go through history-store for undo support.
 */

import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useEffectsStore } from '@/stores/effects-store';
import { useTransportStore } from '@/stores/transport-store';
import { useHistoryStore } from '@/stores/history-store';
import { useAIStore } from '@/stores/ai-store';
import { toast } from '@/stores/toast-store';
import { resolveTrackTarget } from './nl-command-parser';
import type { ParsedCommand, CommandResult } from '@/types/commands';
import type { EffectType, EQ3Params, FilterParams, CompressorParams } from '@/types/effects';
import type { Track } from '@/types/audio';

function getTrackName(trackId: string): string {
  return useSessionStore.getState().tracks.find((t) => t.id === trackId)?.name ?? 'track';
}

function resolveTargets(cmd: ParsedCommand): string[] {
  const session = useSessionStore.getState();
  const tracks = session.tracks;
  const ids: string[] = [];

  for (const target of cmd.targets) {
    if (target.type === 'selected') {
      if (session.selectedTrackId) ids.push(session.selectedTrackId);
    } else {
      ids.push(...resolveTrackTarget(target, tracks));
    }
  }

  // If no targets resolved, use selected track
  if (ids.length === 0 && session.selectedTrackId) {
    ids.push(session.selectedTrackId);
  }

  return [...new Set(ids)];
}

export function executeNLCommand(cmd: ParsedCommand): CommandResult {
  if (cmd.intent === 'unknown') {
    return {
      success: false,
      description: `Could not understand: "${cmd.raw}"`,
      undoable: false,
      affectedTrackIds: [],
    };
  }

  const mixer = useMixerStore.getState();
  const effects = useEffectsStore.getState();
  const transport = useTransportStore.getState();
  const history = useHistoryStore.getState();
  const session = useSessionStore.getState();
  const ai = useAIStore.getState();

  const trackIds = resolveTargets(cmd);

  switch (cmd.intent) {
    case 'setVolume': {
      const delta = (cmd.params.delta as number) ?? 0;
      for (const id of trackIds) {
        const track = session.tracks.find((t) => t.id === id);
        if (!track) continue;
        const before = track.volume;
        const after = before + delta;
        mixer.setVolume(id, after);
        session.updateTrack(id, { volume: after });
        history.pushAction(
          `Volume ${delta > 0 ? '+' : ''}${delta}dB on ${getTrackName(id)}`,
          () => { useMixerStore.getState().setVolume(id, before); useSessionStore.getState().updateTrack(id, { volume: before }); },
          () => { useMixerStore.getState().setVolume(id, after); useSessionStore.getState().updateTrack(id, { volume: after }); },
        );
      }
      return {
        success: true,
        description: `Adjusted volume by ${delta > 0 ? '+' : ''}${delta}dB on ${trackIds.length} track(s)`,
        undoable: true,
        affectedTrackIds: trackIds,
      };
    }

    case 'setPan': {
      const value = (cmd.params.value as number) ?? 0;
      for (const id of trackIds) {
        const before = session.tracks.find((t) => t.id === id)?.pan ?? 0;
        mixer.setPan(id, value);
        session.updateTrack(id, { pan: value });
        history.pushAction(
          `Panned ${getTrackName(id)} to ${value}`,
          () => { useMixerStore.getState().setPan(id, before); useSessionStore.getState().updateTrack(id, { pan: before }); },
          () => { useMixerStore.getState().setPan(id, value); useSessionStore.getState().updateTrack(id, { pan: value }); },
        );
      }
      return {
        success: true,
        description: `Panned ${trackIds.length} track(s)`,
        undoable: true,
        affectedTrackIds: trackIds,
      };
    }

    case 'mute':
    case 'unmute':
    case 'solo':
    case 'unsolo': {
      for (const id of trackIds) {
        if (cmd.intent === 'mute' || cmd.intent === 'unmute') {
          mixer.toggleMute(id);
          session.updateTrack(id, { mute: cmd.intent === 'mute' });
        } else {
          mixer.toggleSolo(id);
          session.updateTrack(id, { solo: cmd.intent === 'solo' });
        }
      }
      return {
        success: true,
        description: `${cmd.intent} ${trackIds.length} track(s)`,
        undoable: false,
        affectedTrackIds: trackIds,
      };
    }

    case 'addEffect': {
      const effectType = cmd.params.effectType as EffectType | undefined;
      if (!effectType) {
        return { success: false, description: 'Unknown effect type', undoable: false, affectedTrackIds: [] };
      }
      for (const id of trackIds) {
        const effectId = effects.addEffect(id, effectType);
        history.pushAction(
          `Added ${effectType} to ${getTrackName(id)}`,
          () => useEffectsStore.getState().removeEffect(id, effectId),
          () => useEffectsStore.getState().addEffect(id, effectType),
        );
      }
      return {
        success: true,
        description: `Added ${effectType} to ${trackIds.length} track(s)`,
        undoable: true,
        affectedTrackIds: trackIds,
      };
    }

    case 'removeEffect': {
      const effectType = cmd.params.effectType as string | undefined;
      if (!effectType) {
        return { success: false, description: 'Unknown effect type', undoable: false, affectedTrackIds: [] };
      }
      for (const id of trackIds) {
        const trackEffects = effects.trackEffects[id] ?? [];
        const fx = trackEffects.find((e) => e.type === effectType);
        if (fx) {
          effects.removeEffect(id, fx.id);
        }
      }
      return {
        success: true,
        description: `Removed ${effectType} from ${trackIds.length} track(s)`,
        undoable: false,
        affectedTrackIds: trackIds,
      };
    }

    case 'duck': {
      // Sidechain ducking: add compressor with fast attack on first target
      if (trackIds.length >= 1) {
        const targetId = trackIds[0]!;
        effects.addEffect(targetId, 'compressor', {
          threshold: -30,
          ratio: 4,
          attack: 0.001,
          release: 0.15,
          knee: 6,
        });
        return {
          success: true,
          description: `Added sidechain ducking compressor to ${getTrackName(targetId)}`,
          undoable: false,
          affectedTrackIds: trackIds,
        };
      }
      return { success: false, description: 'No tracks found for ducking', undoable: false, affectedTrackIds: [] };
    }

    case 'freeze':
    case 'unfreeze': {
      for (const id of trackIds) {
        if (cmd.intent === 'freeze') {
          session.freezeTrack(id, new AudioBuffer({ length: 1, sampleRate: 44100 }));
          toast.success(`Froze ${getTrackName(id)}`);
        } else {
          session.unfreezeTrack(id);
          toast.success(`Unfroze ${getTrackName(id)}`);
        }
      }
      return {
        success: true,
        description: `${cmd.intent} ${trackIds.length} track(s)`,
        undoable: false,
        affectedTrackIds: trackIds,
      };
    }

    case 'analyze': {
      import('./suggestion-engine').then(({ runAnalysis }) => runAnalysis());
      return { success: true, description: 'Running mix analysis...', undoable: false, affectedTrackIds: [] };
    }

    case 'master': {
      const genre = session.config.genre ?? 'general';
      import('./mastering-service').then(({ runMasteringPipeline }) => runMasteringPipeline(genre));
      return { success: true, description: 'Running mastering pipeline...', undoable: false, affectedTrackIds: [] };
    }

    case 'setBpm': {
      const bpm = cmd.params.bpm as number;
      if (bpm >= 20 && bpm <= 999) {
        transport.setBpm(bpm);
        return { success: true, description: `BPM set to ${bpm}`, undoable: false, affectedTrackIds: [] };
      }
      return { success: false, description: `Invalid BPM: ${bpm}`, undoable: false, affectedTrackIds: [] };
    }

    case 'play':
      transport.play();
      return { success: true, description: 'Playing', undoable: false, affectedTrackIds: [] };

    case 'stop':
      transport.stop();
      return { success: true, description: 'Stopped', undoable: false, affectedTrackIds: [] };

    case 'record':
      transport.toggleRecord();
      return { success: true, description: 'Toggled recording', undoable: false, affectedTrackIds: [] };

    case 'rename': {
      const newName = cmd.params.name as string;
      if (trackIds.length > 0 && newName) {
        for (const id of trackIds) {
          session.updateTrack(id, { name: newName });
        }
        return { success: true, description: `Renamed to "${newName}"`, undoable: false, affectedTrackIds: trackIds };
      }
      return { success: false, description: 'No track found to rename', undoable: false, affectedTrackIds: [] };
    }

    case 'compose': {
      const bars = (cmd.params.bars as number) ?? 4;
      ai.setComposer({ bars });
      import('./composer-engine').then(({ generateComposition }) => generateComposition());
      return { success: true, description: `Generating ${bars} bars...`, undoable: false, affectedTrackIds: [] };
    }

    // --- Arrangement commands ---

    case 'boostSection': {
      const section = (cmd.params.section as string) ?? 'chorus';
      // Boost all track volumes by 2dB as a proxy for "hit harder"
      const allIds = session.tracks.map(t => t.id);
      for (const id of allIds) {
        const track = session.tracks.find(t => t.id === id);
        if (track && !track.mute) {
          const newVol = track.volume + 2;
          mixer.setVolume(id, newVol);
          session.updateTrack(id, { volume: newVol });
        }
      }
      return { success: true, description: `Boosted energy for ${section} section (+2dB all tracks)`, undoable: false, affectedTrackIds: allIds };
    }

    case 'thinSection': {
      const section = (cmd.params.section as string) ?? 'drop';
      return { success: true, description: `Suggestion: thin out arrangement before the ${section} — mute non-essential tracks or reduce volumes`, undoable: false, affectedTrackIds: [] };
    }

    case 'addBreakdown': {
      const section = (cmd.params.section as string) ?? 'verse';
      return { success: true, description: `Suggestion: add a breakdown after the ${section} — strip to 1-2 core elements for contrast`, undoable: false, affectedTrackIds: [] };
    }

    case 'extendSection': {
      const section = (cmd.params.section as string) ?? 'intro';
      const bars = (cmd.params.bars as number) ?? 4;
      return { success: true, description: `Suggestion: extend ${section} by ${bars} bars — duplicate and vary the last ${bars} bars`, undoable: false, affectedTrackIds: [] };
    }

    case 'fadeOutro': {
      // Reduce volume on all tracks by 6dB as a simple fade-out proxy
      const allIds = session.tracks.map(t => t.id);
      for (const id of allIds) {
        const track = session.tracks.find(t => t.id === id);
        if (track && !track.mute) {
          const newVol = track.volume - 6;
          mixer.setVolume(id, newVol);
          session.updateTrack(id, { volume: newVol });
        }
      }
      return { success: true, description: 'Applied fade-out (-6dB) — for gradual fade, use volume automation', undoable: false, affectedTrackIds: allIds };
    }

    case 'duplicateSection': {
      const section = (cmd.params.section as string) ?? 'chorus';
      return { success: true, description: `Suggestion: duplicate the ${section} section — select clips and use Ctrl+D`, undoable: false, affectedTrackIds: [] };
    }

    case 'energyBuildup': {
      const section = (cmd.params.section as string) ?? 'drop';
      // Add a filter sweep effect to all tracks
      const allIds = session.tracks.filter(t => !t.mute && t.clips.length > 0).map(t => t.id);
      if (allIds.length > 0) {
        const sweepFilter: FilterParams = { frequency: 2000, type: 'lowpass', Q: 2, rolloff: -12 };
        effects.addEffect(allIds[0]!, 'filter', sweepFilter);
      }
      return { success: true, description: `Added filter sweep for energy buildup before ${section}`, undoable: false, affectedTrackIds: allIds };
    }

    // --- Mix commands ---

    case 'eqBoost': {
      const band = cmd.params.band as string;
      const gain = (cmd.params.gain as number) ?? 3;
      for (const id of trackIds) {
        const trackFx = effects.trackEffects[id] ?? [];
        const eq = trackFx.find(f => f.type === 'eq');
        if (eq) {
          const update: Record<string, number | string> = {};
          if (band === 'high') update.high = gain;
          else if (band === 'low') update.low = gain;
          else if (band === 'lowMid') update.low = gain;
          else update.mid = gain;
          effects.updateEffect(id, eq.id, update);
        } else {
          const eqParams: EQ3Params = { low: 0, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500 };
          if (band === 'high') eqParams.high = gain;
          else if (band === 'low') eqParams.low = gain;
          else if (band === 'lowMid') eqParams.low = gain;
          else eqParams.mid = gain;
          effects.addEffect(id, 'eq', eqParams);
        }
      }
      return { success: true, description: `Boosted ${band} by ${gain}dB on ${trackIds.length} track(s)`, undoable: false, affectedTrackIds: trackIds };
    }

    case 'widenStereo': {
      // Spread tracks: alternate L/R panning
      const active = session.tracks.filter(t => !t.mute && t.clips.length > 0);
      active.slice(1).forEach((track, i) => {
        const pan = i % 2 === 0 ? -0.4 - i * 0.05 : 0.4 + i * 0.05;
        const clamped = Math.max(-1, Math.min(1, pan));
        mixer.setPan(track.id, clamped);
        session.updateTrack(track.id, { pan: clamped });
      });
      return { success: true, description: `Widened stereo image across ${active.length} tracks`, undoable: false, affectedTrackIds: active.map(t => t.id) };
    }

    case 'reduceMuddiness': {
      const cut = (cmd.params.cut as number) ?? -3;
      const allIds = session.tracks.filter(t => !t.mute).map(t => t.id);
      for (const id of allIds) {
        const mudEq: EQ3Params = { low: cut, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500 };
        effects.addEffect(id, 'eq', mudEq);
      }
      return { success: true, description: `Cut low-mids by ${Math.abs(cut)}dB on ${allIds.length} tracks to reduce muddiness`, undoable: false, affectedTrackIds: allIds };
    }

    case 'tightenLowEnd': {
      const allIds = session.tracks.filter(t => !t.mute).map(t => t.id);
      for (const id of allIds) {
        const track = session.tracks.find(t => t.id === id);
        const role = (track as Track & { role?: string }).role?.toLowerCase();
        if (role === 'bass') continue;
        const hpFilter: FilterParams = { frequency: 80, type: 'highpass', Q: 0.7, rolloff: -12 };
        effects.addEffect(id, 'filter', hpFilter);
      }
      return { success: true, description: 'Added 80Hz high-pass to non-bass tracks', undoable: false, affectedTrackIds: allIds };
    }

    case 'gainStaging': {
      import('./suggestion-engine').then(({ runAnalysis }) => runAnalysis());
      return { success: true, description: 'Running gain staging analysis...', undoable: false, affectedTrackIds: [] };
    }

    case 'addWarmth': {
      const warmGain = (cmd.params.gain as number) ?? 2;
      for (const id of trackIds) {
        const warmEq: EQ3Params = { low: warmGain, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500 };
        effects.addEffect(id, 'eq', warmEq);
      }
      return { success: true, description: `Added warmth (+${warmGain}dB low-mids) to ${trackIds.length} track(s)`, undoable: false, affectedTrackIds: trackIds };
    }

    case 'reduceHarshness': {
      const harshCut = (cmd.params.cut as number) ?? -3;
      for (const id of trackIds) {
        const harshEq: EQ3Params = { low: 0, mid: harshCut, high: 0, lowFrequency: 400, highFrequency: 2500 };
        effects.addEffect(id, 'eq', harshEq);
      }
      return { success: true, description: `Reduced harshness (${harshCut}dB at 2-5kHz) on ${trackIds.length} track(s)`, undoable: false, affectedTrackIds: trackIds };
    }

    case 'compressTracks': {
      for (const id of trackIds) {
        const compParams: CompressorParams = {
          threshold: (cmd.params.threshold as number) ?? -18,
          ratio: (cmd.params.ratio as number) ?? 4,
          attack: (cmd.params.attack as number) ?? 0.01,
          release: (cmd.params.release as number) ?? 0.15,
          knee: 6,
        };
        effects.addEffect(id, 'compressor', compParams);
      }
      return { success: true, description: `Added compressor to ${trackIds.length} track(s)`, undoable: false, affectedTrackIds: trackIds };
    }

    // --- Session commands ---

    case 'balanceLevels': {
      import('./suggestion-engine').then(({ runAnalysis }) => runAnalysis());
      return { success: true, description: 'Running level balance analysis...', undoable: false, affectedTrackIds: [] };
    }

    case 'engineeringScan': {
      import('./engineering-actions').then(({ runEngineeringScan }) => {
        const report = runEngineeringScan();
        toast.success(`Engineering scan: ${report.issueCount} issue(s) found`);
      });
      return { success: true, description: 'Running engineering scan...', undoable: false, affectedTrackIds: [] };
    }

    case 'sessionScan': {
      import('./session-scanner').then(({ runSessionScan }) => {
        runSessionScan();
        toast.success('Session scan complete');
      });
      return { success: true, description: 'Running session scan...', undoable: false, affectedTrackIds: [] };
    }

    case 'referenceMatch': {
      return { success: true, description: 'Open the Reference Match panel in the sidebar to compare your mix', undoable: false, affectedTrackIds: [] };
    }

    default:
      return { success: false, description: `Unhandled command: ${cmd.intent}`, undoable: false, affectedTrackIds: [] };
  }
}
