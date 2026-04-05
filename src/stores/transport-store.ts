import { create } from 'zustand';
import type { TransportState } from '@/types/audio';
import * as transport from '@/services/transport-service';
import { setMetronomeEnabled } from '@/services/metronome-service';
import { scheduleMidiClips, clearAllScheduledMidi } from '@/services/midi-playback';
import { useSessionStore } from '@/stores/session-store';
import {
  requestMicrophoneAccess,
  startRecording,
  stopRecording,
  isRecording as isRecordingActive,
  createClipFromRecording,
} from '@/services/recording-service';

interface TransportStore {
  state: TransportState;
  bpm: number;
  position: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  metronomeEnabled: boolean;
  punchInEnabled: boolean;
  punchInTime: number;
  punchOutTime: number;

  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  toggleRecord: () => void;
  sceneCount: number;
  launchScene: (sceneIndex: number) => void;
  stopScene: (sceneIndex: number) => void;
  setBpm: (bpm: number) => void;
  setPosition: (seconds: number) => void;
  setLoop: (start: number, end: number, enabled: boolean) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
  togglePunchIn: () => void;
  setPunchRegion: (inTime: number, outTime: number) => void;
}

export const useTransportStore = create<TransportStore>((set, get) => ({
  state: 'stopped',
  bpm: 120,
  position: 0,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 16,
  metronomeEnabled: false,
  punchInEnabled: false,
  punchInTime: 0,
  punchOutTime: 8,
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
      // Stop recording and create clip from captured audio
      if (isRecordingActive()) {
        stopRecording().then(({ buffer }) => {
          const session = useSessionStore.getState();
          const trackId = session.selectedTrackId;
          if (trackId && buffer.duration > 0.1) {
            const clip = createClipFromRecording(trackId, buffer, 0);
            session.addClipToTrack(trackId, clip);
          }
        }).catch(() => { /* recording stop failed */ });
      }
    } else {
      const session = useSessionStore.getState();
      const trackId = session.selectedTrackId;
      // Request mic and start actual recording
      requestMicrophoneAccess().then(() => {
        if (trackId) {
          try {
            startRecording(trackId);
          } catch { /* already recording or no mic */ }
        }
        set({ state: 'recording' });
      }).catch(() => {
        // Mic denied — still enter record-armed state for MIDI
        set({ state: 'recording' });
      });
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

  setPosition: (seconds) => {
    transport.seekTo(seconds);
    set({ position: seconds });
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

  togglePunchIn: () => {
    set({ punchInEnabled: !get().punchInEnabled });
  },

  setPunchRegion: (inTime, outTime) => {
    set({ punchInTime: inTime, punchOutTime: outTime });
  },
}));
