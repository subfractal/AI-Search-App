import { create } from 'zustand';
import type { Track, SessionConfig, AudioClip, Clip } from '@/types/audio';
import type { TrackSequencerState, SequencerMode } from '@/types/project';
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
  addGroupTrack: (name?: string) => string;
  addFolderTrack: (name?: string) => string;
  addReturnTrack: (name?: string) => string;
  moveTrackToFolder: (trackId: string, folderId: string | null) => void;
  toggleFolderCollapse: (folderId: string) => void;
  setTrackSequencer: (trackId: string, mode: SequencerMode) => void;
  setLauncherSlot: (trackId: string, sceneIndex: number, clip: Clip) => void;
  clearLauncherSlot: (trackId: string, sceneIndex: number) => void;
  copyClipToArrangement: (trackId: string, sceneIndex: number, startTime: number) => void;
  copyArrangementToLauncher: (trackId: string, clipId: string, sceneIndex: number) => void;
  returnTrackToArrangement: (trackId: string) => void;
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

  addGroupTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `DKT-GRP-${String(index + 1).padStart(2, '0')}`,
      type: 'group',
      color,
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      clips: [],
      groupConfig: { childTrackIds: [], busId: '' },
    };
    createTrackNodes(id);
    set((state) => ({ tracks: [...state.tracks, track] }));
    return id;
  },

  addFolderTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `DKT-FLD-${String(index + 1).padStart(2, '0')}`,
      type: 'folder',
      color,
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      clips: [],
      folderConfig: { collapsed: false, childTrackIds: [], summingEnabled: false },
    };
    set((state) => ({ tracks: [...state.tracks, track] }));
    return id;
  },

  addReturnTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `DKT-RTN-${String(index + 1).padStart(2, '0')}`,
      type: 'return',
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

  moveTrackToFolder: (trackId, folderId) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id === trackId) return { ...t, parentTrackId: folderId };
        if (t.folderConfig && t.id === folderId && folderId) {
          return {
            ...t,
            folderConfig: {
              ...t.folderConfig,
              childTrackIds: [
                ...t.folderConfig.childTrackIds.filter((id) => id !== trackId),
                trackId,
              ],
            },
          };
        }
        if (t.folderConfig && t.folderConfig.childTrackIds.includes(trackId) && t.id !== folderId) {
          return {
            ...t,
            folderConfig: {
              ...t.folderConfig,
              childTrackIds: t.folderConfig.childTrackIds.filter((id) => id !== trackId),
            },
          };
        }
        return t;
      }),
    })),

  toggleFolderCollapse: (folderId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === folderId && t.folderConfig
          ? { ...t, folderConfig: { ...t.folderConfig, collapsed: !t.folderConfig.collapsed } }
          : t,
      ),
    })),

  setTrackSequencer: (trackId, mode) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const seq: TrackSequencerState = t.sequencer ?? {
          activeSequencer: 'arrangement',
          arrangementSuppressedByLauncher: false,
          launcherSlots: [],
        };
        return {
          ...t,
          sequencer: {
            ...seq,
            activeSequencer: mode,
            arrangementSuppressedByLauncher: mode === 'launcher',
          },
        };
      }),
    })),

  setLauncherSlot: (trackId, sceneIndex, clip) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const seq: TrackSequencerState = t.sequencer ?? {
          activeSequencer: 'arrangement',
          arrangementSuppressedByLauncher: false,
          launcherSlots: [],
        };
        const slots = [...seq.launcherSlots];
        const idx = slots.findIndex((s) => s.sceneIndex === sceneIndex);
        const slot = { sceneIndex, clip, playing: false, queued: false };
        if (idx >= 0) {
          slots[idx] = slot;
        } else {
          slots.push(slot);
        }
        return { ...t, sequencer: { ...seq, launcherSlots: slots } };
      }),
    })),

  clearLauncherSlot: (trackId, sceneIndex) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId || !t.sequencer) return t;
        return {
          ...t,
          sequencer: {
            ...t.sequencer,
            launcherSlots: t.sequencer.launcherSlots.filter((s) => s.sceneIndex !== sceneIndex),
          },
        };
      }),
    })),

  copyClipToArrangement: (trackId, sceneIndex, startTime) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId || !t.sequencer) return t;
        const slot = t.sequencer.launcherSlots.find((s) => s.sceneIndex === sceneIndex);
        if (!slot?.clip) return t;
        const arrClip = { ...slot.clip, startTime };
        return { ...t, clips: [...t.clips, arrClip] };
      }),
    })),

  copyArrangementToLauncher: (trackId, clipId, sceneIndex) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const clip = t.clips.find((c) => c.id === clipId);
        if (!clip) return t;
        const seq: TrackSequencerState = t.sequencer ?? {
          activeSequencer: 'arrangement',
          arrangementSuppressedByLauncher: false,
          launcherSlots: [],
        };
        const slots = [...seq.launcherSlots];
        const idx = slots.findIndex((s) => s.sceneIndex === sceneIndex);
        const slot = { sceneIndex, clip, playing: false, queued: false };
        if (idx >= 0) {
          slots[idx] = slot;
        } else {
          slots.push(slot);
        }
        return { ...t, sequencer: { ...seq, launcherSlots: slots } };
      }),
    })),

  returnTrackToArrangement: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId || !t.sequencer) return t;
        return {
          ...t,
          sequencer: {
            ...t.sequencer,
            activeSequencer: 'arrangement' as const,
            arrangementSuppressedByLauncher: false,
          },
        };
      }),
    })),
}));
