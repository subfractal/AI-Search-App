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
import { useHistoryStore } from '@/stores/history-store';

export type BottomPanel = 'mixer' | 'instrument' | 'effects' | 'piano-roll' | 'routing' | 'warp' | 'browser' | 'clip-view' | 'automation' | null;

export interface ZoneVisibility {
  leftZone: boolean;
  lowerZone: boolean;
  rightZone: boolean;
  lowerZonePanel: BottomPanel;
}

export interface SelectedClip {
  trackId: string;
  clipId: string;
}

interface ClipboardClip {
  clip: Clip;
  sourceTrackId: string;
}

interface SessionStore {
  config: SessionConfig;
  tracks: Track[];
  selectedTrackId: string | null;
  selectedClips: SelectedClip[];
  clipboard: ClipboardClip | null;
  viewMode: 'arrangement' | 'session';
  zones: ZoneVisibility;

  setConfig: (config: Partial<SessionConfig>) => void;
  addAudioTrack: (name?: string) => string;
  addMidiTrack: (name?: string) => string;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  selectTrack: (id: string | null) => void;
  selectClip: (trackId: string, clipId: string, multi?: boolean) => void;
  clearClipSelection: () => void;
  copySelectedClips: () => void;
  pasteClips: (targetTrackId?: string, atTime?: number) => void;
  deleteSelectedClips: () => void;
  moveClipTime: (trackId: string, clipId: string, newStartTime: number) => void;
  resizeClipDuration: (trackId: string, clipId: string, newDuration: number) => void;
  splitClipAtTime: (trackId: string, clipId: string, splitTime: number) => void;
  setViewMode: (mode: 'arrangement' | 'session') => void;
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
  freezeTrack: (trackId: string, frozenBuffer: AudioBuffer) => void;
  unfreezeTrack: (trackId: string) => void;
  setZoneVisibility: (zone: 'leftZone' | 'lowerZone' | 'rightZone', visible: boolean) => void;
  setLowerZonePanel: (panel: BottomPanel) => void;
  toggleZone: (zone: 'leftZone' | 'lowerZone' | 'rightZone') => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  config: DEFAULT_SESSION_CONFIG,
  tracks: [],
  selectedTrackId: null,
  selectedClips: [],
  clipboard: null,
  viewMode: 'arrangement',
  zones: {
    leftZone: true,
    lowerZone: true,
    rightZone: true,
    lowerZonePanel: 'mixer' as BottomPanel,
  },

  setConfig: (updates) =>
    set((state) => ({ config: { ...state.config, ...updates } })),

  addAudioTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `Audio ${String(index + 1).padStart(2, '0')}`,
      type: 'audio',
      color,
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      clips: [],
    };
    // Update state FIRST so the track appears in the UI immediately,
    // then create audio nodes (may be slow if AudioContext is resuming on iOS)
    set((state) => ({ tracks: [...state.tracks, track] }));
    try { createTrackNodes(id); } catch { /* audio nodes created lazily */ }
    return id;
  },

  addMidiTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `MIDI ${String(index + 1).padStart(2, '0')}`,
      type: 'midi',
      color,
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      clips: [],
    };
    set((state) => ({ tracks: [...state.tracks, track] }));
    try { createTrackNodes(id); } catch { /* audio nodes created lazily */ }
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

  selectClip: (trackId, clipId, multi) => {
    set((state) => {
      if (multi) {
        const exists = state.selectedClips.some((s) => s.clipId === clipId);
        return {
          selectedClips: exists
            ? state.selectedClips.filter((s) => s.clipId !== clipId)
            : [...state.selectedClips, { trackId, clipId }],
          selectedTrackId: trackId,
        };
      }
      return { selectedClips: [{ trackId, clipId }], selectedTrackId: trackId };
    });
  },

  clearClipSelection: () => set({ selectedClips: [] }),

  copySelectedClips: () => {
    const { selectedClips, tracks } = get();
    if (selectedClips.length === 0) return;
    const sel = selectedClips[0]!;
    const track = tracks.find((t) => t.id === sel.trackId);
    const clip = track?.clips.find((c) => c.id === sel.clipId);
    if (clip) {
      set({ clipboard: { clip, sourceTrackId: sel.trackId } });
    }
  },

  pasteClips: (targetTrackId, atTime) => {
    const { clipboard, selectedTrackId, tracks } = get();
    if (!clipboard) return;
    const tid = targetTrackId ?? selectedTrackId;
    if (!tid) return;
    const track = tracks.find((t) => t.id === tid);
    if (!track) return;
    const newClip = {
      ...clipboard.clip,
      id: generateId('clip'),
      trackId: tid,
      startTime: atTime ?? (track.clips.length > 0
        ? Math.max(...track.clips.map((c) => c.startTime + c.duration))
        : 0),
    };
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === tid ? { ...t, clips: [...t.clips, newClip] } : t,
      ),
      // BUG-03 FIX: Update selectedClips to the newly pasted clip
      selectedClips: [{ trackId: tid, clipId: newClip.id }],
    }));

    useHistoryStore.getState().pushAction(
      'Paste clip',
      () => {
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === tid ? { ...t, clips: t.clips.filter((c) => c.id !== newClip.id) } : t,
          ),
          selectedClips: [],
        }));
      },
      () => {
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === tid ? { ...t, clips: [...t.clips, newClip] } : t,
          ),
          selectedClips: [{ trackId: tid, clipId: newClip.id }],
        }));
      }
    );
  },

  deleteSelectedClips: () => {
    const { selectedClips, tracks } = get();
    if (selectedClips.length === 0) return;

    // Capture state before deletion for undo
    const removedClipsByTrack: Record<string, Clip[]> = {};
    for (const sel of selectedClips) {
      const track = tracks.find((t) => t.id === sel.trackId);
      const clip = track?.clips.find((c) => c.id === sel.clipId);
      if (clip) {
        if (!removedClipsByTrack[sel.trackId]) removedClipsByTrack[sel.trackId] = [];
        removedClipsByTrack[sel.trackId]!.push(clip);
      }
    }

    set((state) => ({
      tracks: state.tracks.map((t) => {
        const clipIdsToRemove = selectedClips
          .filter((s) => s.trackId === t.id)
          .map((s) => s.clipId);
        if (clipIdsToRemove.length === 0) return t;
        return { ...t, clips: t.clips.filter((c) => !clipIdsToRemove.includes(c.id)) };
      }),
      selectedClips: [],
    }));

    useHistoryStore.getState().pushAction(
      'Delete clips',
      () => {
        set((state) => ({
          tracks: state.tracks.map((t) => {
            const clipsToRestore = removedClipsByTrack[t.id];
            if (!clipsToRestore) return t;
            return { ...t, clips: [...t.clips, ...clipsToRestore] };
          }),
          selectedClips,
        }));
      },
      () => {
        set((state) => ({
          tracks: state.tracks.map((t) => {
            const clipIdsToRemove = selectedClips
              .filter((s) => s.trackId === t.id)
              .map((s) => s.clipId);
            if (clipIdsToRemove.length === 0) return t;
            return { ...t, clips: t.clips.filter((c) => !clipIdsToRemove.includes(c.id)) };
          }),
          selectedClips: [],
        }));
      }
    );
  },

  moveClipTime: (trackId, clipId, newStartTime) => {
    const { tracks } = get();
    const track = tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    const oldStartTime = clip?.startTime ?? 0;

    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, startTime: Math.max(0, newStartTime) } : c,
          ) }
          : t,
      ),
    }));

    // Only push to history if actually moved
    if (oldStartTime !== newStartTime) {
      useHistoryStore.getState().pushAction(
        'Move clip',
        () => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId
                ? { ...t, clips: t.clips.map((c) =>
                  c.id === clipId ? { ...c, startTime: oldStartTime } : c,
                ) }
                : t,
            ),
          }));
        },
        () => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId
                ? { ...t, clips: t.clips.map((c) =>
                  c.id === clipId ? { ...c, startTime: Math.max(0, newStartTime) } : c,
                ) }
                : t,
            ),
          }));
        }
      );
    }
  },

  resizeClipDuration: (trackId, clipId, newDuration) => {
    const { tracks } = get();
    const track = tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    const oldDuration = clip?.duration ?? 0;

    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, duration: Math.max(0.1, newDuration) } : c,
          ) }
          : t,
      ),
    }));

    // Only push to history if actually resized
    if (oldDuration !== newDuration) {
      useHistoryStore.getState().pushAction(
        'Resize clip',
        () => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId
                ? { ...t, clips: t.clips.map((c) =>
                  c.id === clipId ? { ...c, duration: oldDuration } : c,
                ) }
                : t,
            ),
          }));
        },
        () => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId
                ? { ...t, clips: t.clips.map((c) =>
                  c.id === clipId ? { ...c, duration: Math.max(0.1, newDuration) } : c,
                ) }
                : t,
            ),
          }));
        }
      );
    }
  },

  splitClipAtTime: (trackId, clipId, splitTime) => {
    const track = get().tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    if (!clip || splitTime <= 0 || splitTime >= clip.duration) return;

    const originalClip = { ...clip };
    const leftClip = { ...clip, id: generateId('clip'), duration: splitTime };
    const rightClip = {
      ...clip,
      id: generateId('clip'),
      startTime: clip.startTime + splitTime,
      duration: clip.duration - splitTime,
    };

    // For MIDI clips, filter notes into left/right
    if ('notes' in clip) {
      (leftClip as any).notes = clip.notes.filter((n: any) => n.startTime < splitTime);
      (rightClip as any).notes = clip.notes
        .filter((n: any) => n.startTime >= splitTime)
        .map((n: any) => ({ ...n, startTime: n.startTime - splitTime }));
    }

    // For audio clips, adjust offset
    if ('buffer' in clip && 'offset' in clip) {
      (rightClip as any).offset = ((clip as any).offset ?? 0) + splitTime;
    }

    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: [...t.clips.filter((c) => c.id !== clipId), leftClip, rightClip] }
          : t,
      ),
    }));

    const leftId = leftClip.id;
    const rightId = rightClip.id;
    useHistoryStore.getState().pushAction(
      'Split clip',
      () => {
        // Undo: remove left+right, restore original
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips.filter((c) => c.id !== leftId && c.id !== rightId), originalClip] }
              : t,
          ),
        }));
      },
      () => {
        // Redo: remove original, add left+right
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: [...t.clips.filter((c) => c.id !== originalClip.id), leftClip, rightClip] }
              : t,
          ),
        }));
      },
    );
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  addClipToTrack: (trackId, clip) => {
    // Update state first so the clip renders in the Timeline immediately
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
      ),
    }));

    // Defer Tone.js player creation — Tone.ToneAudioBuffer copies the entire
    // AudioBuffer (~50-100MB for a 16MB MP3) synchronously. Deferring lets
    // the UI render the track/waveform first.
    if ('buffer' in clip) {
      setTimeout(() => addClipPlayer(clip as AudioClip), 0);
    }

    useHistoryStore.getState().pushAction(
      `Add clip "${clip.name}"`,
      () => {
        removeClipPlayer(trackId, clip.id);
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId
              ? { ...t, clips: t.clips.filter((c) => c.id !== clip.id) }
              : t,
          ),
        }));
      },
      () => {
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
          ),
        }));
        if ('buffer' in clip) {
          addClipPlayer(clip as AudioClip);
        }
      },
    );
  },

  removeClip: (trackId, clipId) => {
    const track = get().tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);

    removeClipPlayer(trackId, clipId);
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
          : t,
      ),
    }));

    if (clip) {
      useHistoryStore.getState().pushAction(
        `Remove clip "${clip.name}"`,
        () => {
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
            ),
          }));
          if ('buffer' in clip) {
            addClipPlayer(clip as AudioClip);
          }
        },
        () => {
          removeClipPlayer(trackId, clipId);
          set((state) => ({
            tracks: state.tracks.map((t) =>
              t.id === trackId
                ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
                : t,
            ),
          }));
        },
      );
    }
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
      name: name ?? `Group ${String(index + 1).padStart(2, '0')}`,
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
    set((state) => ({ tracks: [...state.tracks, track] }));
    try { createTrackNodes(id); } catch { /* audio nodes created lazily */ }
    return id;
  },

  addFolderTrack: (name) => {
    const id = generateId('track');
    const index = get().tracks.length;
    const color = TRACK_COLORS[index % TRACK_COLORS.length]!;
    const track: Track = {
      id,
      name: name ?? `Folder ${String(index + 1).padStart(2, '0')}`,
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
      name: name ?? `Return ${String(index + 1).padStart(2, '0')}`,
      type: 'return',
      color,
      volume: 0,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      clips: [],
    };
    set((state) => ({ tracks: [...state.tracks, track] }));
    try { createTrackNodes(id); } catch { /* audio nodes created lazily */ }
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

  freezeTrack: (trackId, frozenBuffer) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, frozen: true, frozenBuffer } : t,
      ),
    })),

  unfreezeTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, frozen: false, frozenBuffer: undefined } : t,
      ),
    })),

  setZoneVisibility: (zone, visible) =>
    set((state) => ({
      zones: { ...state.zones, [zone]: visible },
    })),

  setLowerZonePanel: (panel) =>
    set((state) => ({
      zones: {
        ...state.zones,
        lowerZonePanel: panel,
        lowerZone: panel !== null,
      },
    })),

  toggleZone: (zone) =>
    set((state) => ({
      zones: { ...state.zones, [zone]: !state.zones[zone] },
    })),
}));
