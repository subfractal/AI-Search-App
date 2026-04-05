import { create } from 'zustand';
import type { TransportState } from '@/types/audio';
import * as transport from '@/services/transport-service';
import { setMetronomeEnabled } from '@/services/metronome-service';
import { scheduleMidiClips, clearAllScheduledMidi } from '@/services/midi-playback';
import { useSessionStore } from '@/stores/session-store';

interface TransportStore {
  state: TransportState;
  bpm: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  metronomeEnabled: boolean;

  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  toggleRecord: () => void;
  sceneCount: number;
  launchScene: (sceneIndex: number) => void;
  stopScene: (sceneIndex: number) => void;
  setBpm: (bpm: number) => void;
  setLoop: (start: number, end: number, enabled: boolean) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
}

export const useTransportStore = create<TransportStore>((set, get) => ({
  state: 'stopped',
  bpm: 120,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 16,
  metronomeEnabled: false,
  sceneCount: 8,

  play: async () => {
    await transport.play();
    scheduleMidiClips(useSessionStore.getState().tracks);
    set({ state: 'playing' });
  },

  pause: () => {
    transport.pause();
    set({ state: 'paused' });
  },

  stop: () => {
    clearAllScheduledMidi();
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

  launchScene: (sceneIndex) => {
    const tracks = useSessionStore.getState().tracks;
    for (const track of tracks) {
      if (!track.sequencer) continue;
      const slot = track.sequencer.launcherSlots.find((s) => s.sceneIndex === sceneIndex);
      if (slot?.clip) {
        useSessionStore.getState().setTrackSequencer(track.id, 'launcher');
      }
    }
  },

  stopScene: (sceneIndex) => {
    const tracks = useSessionStore.getState().tracks;
    for (const track of tracks) {
      if (!track.sequencer) continue;
      const slot = track.sequencer.launcherSlots.find((s) => s.sceneIndex === sceneIndex);
      if (slot) {
        useSessionStore.getState().returnTrackToArrangement(track.id);
      }
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

  toggleMetronome: () => {
    const next = !get().metronomeEnabled;
    setMetronomeEnabled(next);
    set({ metronomeEnabled: next });
  },
}));
