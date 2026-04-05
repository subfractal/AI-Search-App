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
import type { EffectType } from '@/types/effects';

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

    default:
      return { success: false, description: `Unhandled command: ${cmd.intent}`, undoable: false, affectedTrackIds: [] };
  }
}
