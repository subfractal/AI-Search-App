import { create } from 'zustand';
import { generateId } from '@/utils/id';
import type {
  MidiEffectType,
  MidiEffectParams,
  MidiEffectConfig,
} from '@/types/midi-effects';
import {
  DEFAULT_ARP_PARAMS,
  DEFAULT_CHORD_PARAMS,
  DEFAULT_SCALE_PARAMS,
  DEFAULT_TRANSPOSER_PARAMS,
  DEFAULT_VELOCITY_PARAMS,
  DEFAULT_NOTE_REPEAT_PARAMS,
  DEFAULT_HUMANIZE_PARAMS,
  DEFAULT_MIDI_DELAY_PARAMS,
} from '@/types/midi-effects';

const MIDI_DEFAULTS: Record<MidiEffectType, MidiEffectParams> = {
  arpeggiator: DEFAULT_ARP_PARAMS,
  chord: DEFAULT_CHORD_PARAMS,
  scale: DEFAULT_SCALE_PARAMS,
  transposer: DEFAULT_TRANSPOSER_PARAMS,
  velocity: DEFAULT_VELOCITY_PARAMS,
  noteRepeat: DEFAULT_NOTE_REPEAT_PARAMS,
  humanize: DEFAULT_HUMANIZE_PARAMS,
  midiDelay: DEFAULT_MIDI_DELAY_PARAMS,
};

interface MidiEffectsStore {
  trackMidiEffects: Record<string, MidiEffectConfig[]>;
  addMidiEffect: (trackId: string, type: MidiEffectType, params?: MidiEffectParams) => string;
  removeMidiEffect: (trackId: string, effectId: string) => void;
  updateMidiEffect: (trackId: string, effectId: string, params: Partial<MidiEffectParams>) => void;
  toggleMidiEffect: (trackId: string, effectId: string) => void;
  clearTrackMidiEffects: (trackId: string) => void;
}

export const useMidiEffectsStore = create<MidiEffectsStore>((set) => ({
  trackMidiEffects: {},

  addMidiEffect: (trackId, type, params) => {
    const id = generateId('mfx');
    const config: MidiEffectConfig = {
      id,
      type,
      enabled: true,
      params: params ?? MIDI_DEFAULTS[type],
    };
    set((state) => ({
      trackMidiEffects: {
        ...state.trackMidiEffects,
        [trackId]: [...(state.trackMidiEffects[trackId] ?? []), config],
      },
    }));
    return id;
  },

  removeMidiEffect: (trackId, effectId) =>
    set((state) => ({
      trackMidiEffects: {
        ...state.trackMidiEffects,
        [trackId]: (state.trackMidiEffects[trackId] ?? []).filter((e) => e.id !== effectId),
      },
    })),

  updateMidiEffect: (trackId, effectId, params) =>
    set((state) => ({
      trackMidiEffects: {
        ...state.trackMidiEffects,
        [trackId]: (state.trackMidiEffects[trackId] ?? []).map((e) =>
          e.id === effectId ? { ...e, params: { ...e.params, ...params } } : e,
        ),
      },
    })),

  toggleMidiEffect: (trackId, effectId) =>
    set((state) => ({
      trackMidiEffects: {
        ...state.trackMidiEffects,
        [trackId]: (state.trackMidiEffects[trackId] ?? []).map((e) =>
          e.id === effectId ? { ...e, enabled: !e.enabled } : e,
        ),
      },
    })),

  clearTrackMidiEffects: (trackId) =>
    set((state) => ({
      trackMidiEffects: {
        ...state.trackMidiEffects,
        [trackId]: [],
      },
    })),
}));
