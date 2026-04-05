import { create } from 'zustand';
import type { WarpConfig, WarpMarker, WarpMode, StretchState } from '@/types/warp';
import { DEFAULT_WARP_CONFIG } from '@/types/warp';
import { generateId } from '@/utils/id';

interface WarpStore {
  configs: Record<string, WarpConfig>;

  initWarpConfig: (clipId: string, config?: Partial<WarpConfig>) => void;
  setEnabled: (clipId: string, enabled: boolean) => void;
  setMode: (clipId: string, mode: WarpMode) => void;
  setStretchState: (clipId: string, state: StretchState) => void;
  setOriginalBpm: (clipId: string, bpm: number) => void;
  setAnchorTime: (clipId: string, time: number) => void;
  setBarCount: (clipId: string, bars: number) => void;
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

  initWarpConfig: (clipId: string, config?: Partial<WarpConfig>) => {
    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...DEFAULT_WARP_CONFIG, ...config },
      },
    }));
  },

  setEnabled: (clipId: string, enabled: boolean) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, enabled },
      },
    }));
  },

  setMode: (clipId: string, mode: WarpMode) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, mode },
      },
    }));
  },

  setStretchState: (clipId: string, stretchState: StretchState) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, stretchState },
      },
    }));
  },

  setOriginalBpm: (clipId: string, bpm: number) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, originalBpm: bpm },
      },
    }));
  },

  setAnchorTime: (clipId: string, anchorTime: number) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, anchorTime },
      },
    }));
  },

  setBarCount: (clipId: string, barCount: number) => {
    const existing = get().configs[clipId];
    if (!existing) return;
    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, barCount: Math.max(1, barCount) },
      },
    }));
  },

  addMarker: (clipId: string, sourceTime: number, targetTime: number) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    const marker: WarpMarker = {
      id: generateId('wm'),
      sourceTime,
      targetTime,
    };

    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          ...existing,
          markers: [...existing.markers, marker].sort(
            (a: WarpMarker, b: WarpMarker) => a.sourceTime - b.sourceTime,
          ),
        },
      },
    }));
  },

  updateMarker: (clipId: string, markerId: string, updates: Partial<WarpMarker>) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          ...existing,
          markers: existing.markers
            .map((m: WarpMarker) => (m.id === markerId ? { ...m, ...updates } : m))
            .sort((a: WarpMarker, b: WarpMarker) => a.sourceTime - b.sourceTime),
        },
      },
    }));
  },

  removeMarker: (clipId: string, markerId: string) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          ...existing,
          markers: existing.markers.filter((m: WarpMarker) => m.id !== markerId),
        },
      },
    }));
  },

  autoWarp: (clipId: string, detectedBpm: number, beats: number[], sessionBpm: number) => {
    const beatInterval = 60 / sessionBpm;

    const markers: WarpMarker[] = beats.map((beatTime: number, idx: number) => ({
      id: generateId('wm'),
      sourceTime: beatTime,
      targetTime: idx * beatInterval,
    }));

    const anchorTime = beats.length > 0 ? beats[0]! : 0;
    const barCount = Math.max(1, Math.round(beats.length / 4));

    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: {
          enabled: true,
          mode: state.configs[clipId]?.mode ?? 'beats',
          stretchState: beats.length > 8 ? 'fluid' : 'steady',
          originalBpm: detectedBpm,
          originalBpmConfidence: 0,
          anchorTime,
          barCount,
          markers,
          autoWarped: true,
        },
      },
    }));
  },

  clearMarkers: (clipId: string) => {
    const existing = get().configs[clipId];
    if (!existing) return;

    set((state: WarpStore) => ({
      configs: {
        ...state.configs,
        [clipId]: { ...existing, markers: [], autoWarped: false },
      },
    }));
  },

  removeConfig: (clipId: string) => {
    set((state: WarpStore) => {
      const rest = { ...state.configs };
      delete rest[clipId];
      return { configs: rest };
    });
  },
}));
