import { create } from 'zustand';
import type { WarpConfig, WarpMarker, WarpMode } from '@/types/warp';
import { DEFAULT_WARP_CONFIG } from '@/types/warp';
import { generateId } from '@/utils/id';

interface WarpStore {
  configs: Record<string, WarpConfig>;

  initWarpConfig: (clipId: string, config?: Partial<WarpConfig>) => void;
  setEnabled: (clipId: string, enabled: boolean) => void;
  setMode: (clipId: string, mode: WarpMode) => void;
  setOriginalBpm: (clipId: string, bpm: number) => void;
  addMarker: (clipId: string, sourceTime: number, targetTime: number) => void;
  updateMarker: (
    clipId: string,
    markerId: string,
    updates: Partial<WarpMarker>,
  ) => void;
  removeMarker: (clipId: string, markerId: string) => void;
  autoWarp: (
    clipId: string,
    detectedBpm: number,
    beats: number[],
    sessionBpm: number,
  ) => void;
  clearMarkers: (clipId: string) => void;
  removeConfig: (clipId: string) => void;
}

export const useWarpStore = create<WarpStore>((set, get) => ({
  configs: {},

  initWarpConfig: (clipId, config) => {
    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...DEFAULT_WARP_CONFIG, ...config },
      },
    }));
  },

  setEnabled: (clipId, enabled) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, enabled },
      },
    }));
  },

  setMode: (clipId, mode) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, mode },
      },
    }));
  },

  setOriginalBpm: (clipId, bpm) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, originalBpm: bpm },
      },
    }));
  },

  addMarker: (clipId, sourceTime, targetTime) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    const marker: WarpMarker = {
      id: generateId('wm'),
      sourceTime,
      targetTime,
    };

    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          ...existing,
          markers: [...existing.markers, marker].sort(
            (a, b) => a.sourceTime - b.sourceTime,
          ),
        },
      },
    }));
  },

  updateMarker: (clipId, markerId, updates) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          ...existing,
          markers: existing.markers
            .map((m) => (m.id === markerId ? { ...m, ...updates } : m))
            .sort((a, b) => a.sourceTime - b.sourceTime),
        },
      },
    }));
  },

  removeMarker: (clipId, markerId) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          ...existing,
          markers: existing.markers.filter((m) => m.id !== markerId),
        },
      },
    }));
  },

  autoWarp: (clipId, detectedBpm, beats, sessionBpm) => {
    const beatInterval = 60 / sessionBpm;

    const markers: WarpMarker[] = beats.map((beatTime, idx) => ({
      id: generateId('wm'),
      sourceTime: beatTime,
      targetTime: idx * beatInterval,
    }));

    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          enabled: true,
          mode: state.configs[clipId]?.mode ?? 'beats',
          originalBpm: detectedBpm,
          originalBpmConfidence: 0,
          markers,
          autoWarped: true,
        },
      },
    }));
  },

  clearMarkers: (clipId) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    set((state) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, markers: [], autoWarped: false },
      },
    }));
  },

  removeConfig: (clipId) => {
    set((state) => {
      const rest = { ...state.configs };
      delete rest[clipId];
      return { configs: rest };
    });
  },
}));
