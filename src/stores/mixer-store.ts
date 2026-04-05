import { create } from 'zustand';
import type { ChannelStrip } from '@/types/mixer';
import * as trackManager from '@/services/track-manager';

interface MixerStore {
  strips: Record<string, ChannelStrip>;
  masterVolume: number;

  initStrip: (trackId: string) => void;
  removeStrip: (trackId: string) => void;
  setVolume: (trackId: string, volume: number) => void;
  setPan: (trackId: string, pan: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  setMasterVolume: (volume: number) => void;
}

export const useMixerStore = create<MixerStore>((set, get) => ({
  strips: {},
  masterVolume: 0,

  initStrip: (trackId) =>
    set((state) => ({
      strips: {
        ...state.strips,
        [trackId]: {
          trackId,
          volume: 0,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
        },
      },
    })),

  removeStrip: (trackId) =>
    set((state) => {
      const { [trackId]: _, ...rest } = state.strips;
      return { strips: rest };
    }),

  setVolume: (trackId, volume) => {
    trackManager.setTrackVolume(trackId, volume);
    set((state) => ({
      strips: {
        ...state.strips,
        [trackId]: { ...state.strips[trackId]!, volume },
      },
    }));
  },

  setPan: (trackId, pan) => {
    trackManager.setTrackPan(trackId, pan);
    set((state) => ({
      strips: {
        ...state.strips,
        [trackId]: { ...state.strips[trackId]!, pan },
      },
    }));
  },

  toggleMute: (trackId) => {
    const strip = get().strips[trackId];
    if (!strip) return;
    const mute = !strip.mute;
    trackManager.setTrackMute(trackId, mute);
    set((state) => ({
      strips: {
        ...state.strips,
        [trackId]: { ...state.strips[trackId]!, mute },
      },
    }));
  },

  toggleSolo: (trackId) => {
    const strip = get().strips[trackId];
    if (!strip) return;
    const solo = !strip.solo;
    trackManager.setTrackSolo(trackId, solo);
    set((state) => ({
      strips: {
        ...state.strips,
        [trackId]: { ...state.strips[trackId]!, solo },
      },
    }));
  },

  setMasterVolume: (volume) => set({ masterVolume: volume }),
}));
