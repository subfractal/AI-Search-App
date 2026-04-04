import { create } from 'zustand';
import type {
  InstrumentConfig,
  InstrumentType,
  SynthParams,
  DrumPattern,
} from '@/types/instruments';
import {
  DEFAULT_SYNTH_PARAMS,
  DEFAULT_DRUM_PATTERN,
} from '@/types/instruments';
import {
  createInstrument,
  updateSynthParams,
} from '@/services/instrument-service';

interface InstrumentStore {
  instruments: Record<string, InstrumentConfig>;

  assignInstrument: (trackId: string, type: InstrumentType) => void;
  removeInstrument: (trackId: string) => void;
  updateSynth: (trackId: string, params: Partial<SynthParams>) => void;
  setDrumPattern: (trackId: string, pattern: DrumPattern) => void;
  toggleDrumStep: (
    trackId: string,
    soundIndex: number,
    stepIndex: number,
  ) => void;
}

export const useInstrumentStore = create<InstrumentStore>((set, get) => ({
  instruments: {},

  assignInstrument: (trackId, type) => {
    const params = DEFAULT_SYNTH_PARAMS;
    createInstrument(trackId, type, params);

    const config: InstrumentConfig = {
      type,
      name: type === 'drum-machine' ? 'Drum Machine' :
        type === 'fm-synth' ? 'FM Synth' :
          type === 'am-synth' ? 'AM Synth' :
            type === 'mono-synth' ? 'Mono Lead' : 'Analog Synth',
      synthParams: params,
      drumPattern: type === 'drum-machine'
        ? structuredClone(DEFAULT_DRUM_PATTERN) : undefined,
    };

    set((state) => ({
      instruments: { ...state.instruments, [trackId]: config },
    }));
  },

  removeInstrument: (trackId) => {
    set((state) => {
      const { [trackId]: _, ...rest } = state.instruments;
      return { instruments: rest };
    });
  },

  updateSynth: (trackId, params) => {
    updateSynthParams(trackId, params);
    set((state) => {
      const config = state.instruments[trackId];
      if (!config?.synthParams) return state;
      return {
        instruments: {
          ...state.instruments,
          [trackId]: {
            ...config,
            synthParams: { ...config.synthParams, ...params },
          },
        },
      };
    });
  },

  setDrumPattern: (trackId, pattern) => {
    set((state) => {
      const config = state.instruments[trackId];
      if (!config) return state;
      return {
        instruments: {
          ...state.instruments,
          [trackId]: { ...config, drumPattern: pattern },
        },
      };
    });
  },

  toggleDrumStep: (trackId, soundIndex, stepIndex) => {
    const config = get().instruments[trackId];
    if (!config?.drumPattern) return;

    const newSteps = config.drumPattern.steps.map((row) => [...row]);
    const row = newSteps[soundIndex];
    if (row) {
      row[stepIndex] = !row[stepIndex];
    }

    set((state) => ({
      instruments: {
        ...state.instruments,
        [trackId]: {
          ...config,
          drumPattern: { ...config.drumPattern!, steps: newSteps },
        },
      },
    }));
  },
}));
