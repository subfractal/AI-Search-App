import { create } from 'zustand';
import type { TransportState } from '@/types/audio';
import * as transport from '@/services/transport-service';

interface TransportStore {
  state: TransportState;
  bpm: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;

  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  toggleRecord: () => void;
  setBpm: (bpm: number) => void;
  setLoop: (start: number, end: number, enabled: boolean) => void;
  toggleLoop: () => void;
}

export const useTransportStore = create<TransportStore>((set, get) => ({
  state: 'stopped',
  bpm: 120,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 16,

  play: async () => {
    await transport.play();
    set({ state: 'playing' });
  },

  pause: () => {
    transport.pause();
    set({ state: 'paused' });
  },

  stop: () => {
    transport.stop();
    set({ state: 'stopped' });
  },

  toggleRecord: () => {
    const current = get().state;
    if (current === 'recording') {
      transport.stop();
      set({ state: 'stopped' });
    } else {
      set({ state: 'recording' });
    }
  },

  setBpm: (bpm) => {
    transport.setBpm(bpm);
    set({ bpm });
  },

  setLoop: (start, end, enabled) => {
    transport.setLoop(start, end, enabled);
    set({ loopStart: start, loopEnd: end, loopEnabled: enabled });
  },

  toggleLoop: () => {
    const { loopStart, loopEnd, loopEnabled } = get();
    const next = !loopEnabled;
    transport.setLoop(loopStart, loopEnd, next);
    set({ loopEnabled: next });
  },
}));
