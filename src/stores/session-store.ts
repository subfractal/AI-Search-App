import { create } from 'zustand';
import type { Track, SessionConfig, AudioClip, Clip } from '@/types/audio';
import { DEFAULT_SESSION_CONFIG, TRACK_COLORS } from '@/types/audio';
import { generateId } from '@/utils/id';
import {
  createTrackNodes,
  deleteTrackNodes,
  addClipPlayer,
  removeClipPlayer,
} from '@/services/track-manager';

interface SessionStore {
  config: SessionConfig;
  tracks: Track[];
  selectedTrackId: string | null;

  setConfig: (config: Partial<SessionConfig>) => void;
  addAudioTrack: (name?: string) => string;
  addMidiTrack: (name?: string) => string;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  selectTrack: (id: string | null) => void;
  addClipToTrack: (trackId: string, clip: Clip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  config: DEFAULT_SESSION_CONFIG,
  tracks: [],
  selectedTrackId: null,

  setConfig: (updates) =>
    set((state) => ({ config: { ...state.config, ...updates } })),

  addAudioTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `DKT-AUD-${String(index + 1).padStart(2, '0')}`,
      type: 'audio',
      color,
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      clips: [],
    };
    createTrackNodes(id);
    set((state) => ({ tracks: [...state.tracks, track] }));
    return id;
  },

  addMidiTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `DKT-SEQ-${String(index + 1).padStart(2, '0')}`,
      type: 'midi',
      color,
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      clips: [],
    };
    createTrackNodes(id);
    set((state) => ({ tracks: [...state.tracks, track] }));
    return id;
  },

  removeTrack: (id) => {
    deleteTrackNodes(id);
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== id),
      selectedTrackId:
        state.selectedTrackId === id ? null : state.selectedTrackId,
    }));
  },

  updateTrack: (id, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    })),

  selectTrack: (id) => set({ selectedTrackId: id }),

  addClipToTrack: (trackId, clip) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
      ),
    }));
    if ('buffer' in clip) {
      addClipPlayer(clip as AudioClip);
    }
  },

  removeClip: (trackId, clipId) => {
    removeClipPlayer(trackId, clipId);
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
          : t,
      ),
    }));
  },

  reorderTracks: (fromIndex, toIndex) =>
    set((state) => {
      const tracks = [...state.tracks];
      const [moved] = tracks.splice(fromIndex, 1);
      if (moved) tracks.splice(toIndex, 0, moved);
      return { tracks };
    }),
}));
