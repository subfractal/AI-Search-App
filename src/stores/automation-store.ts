import { create } from 'zustand';
import type { AutomationLane, AutomationTarget, AutomationPoint } from '@/types/automation';
import { generateId } from '@/utils/id';

const LANE_COLORS = [
  '#f87171', '#60a5fa', '#4ade80', '#facc15',
  '#c084fc', '#fb923c', '#f472b6', '#2dd4bf',
];

const TARGET_DEFAULTS: Record<AutomationTarget, { min: number; max: number }> = {
  volume: { min: -60, max: 6 },
  pan: { min: -1, max: 1 },
  mute: { min: 0, max: 1 },
  filterFrequency: { min: 20, max: 20000 },
  filterResonance: { min: 0, max: 20 },
  effectParam: { min: 0, max: 1 },
};

interface AutomationStore {
  lanes: Record<string, AutomationLane[]>;  // trackId → lanes

  addLane: (
    trackId: string,
    target: AutomationTarget,
    effectId?: string,
    paramName?: string,
  ) => void;
  removeLane: (trackId: string, laneId: string) => void;
  addPoint: (
    trackId: string,
    laneId: string,
    point: AutomationPoint,
  ) => void;
  updatePoint: (
    trackId: string,
    laneId: string,
    index: number,
    point: Partial<AutomationPoint>,
  ) => void;
  removePoint: (trackId: string, laneId: string, index: number) => void;
  toggleLane: (trackId: string, laneId: string) => void;
  toggleLaneVisibility: (trackId: string, laneId: string) => void;
}

export const useAutomationStore = create<AutomationStore>((set, get) => ({
  lanes: {},

  addLane: (trackId, target, effectId, paramName) => {
    const existing = get().lanes[trackId] ?? [];
    const colorIndex = existing.length % LANE_COLORS.length;
    const defaults = TARGET_DEFAULTS[target];

    const lane: AutomationLane = {
      id: generateId('auto'),
      trackId,
      target,
      effectId,
      paramName,
      points: [],
      enabled: true,
      visible: true,
      color: LANE_COLORS[colorIndex]!,
      minValue: defaults.min,
      maxValue: defaults.max,
    };

    set((state) => ({
      lanes: {
        ...state.lanes,
        [trackId]: [...(state.lanes[trackId] ?? []), lane],
      },
    }));
  },

  removeLane: (trackId, laneId) => {
    set((state) => ({
      lanes: {
        ...state.lanes,
        [trackId]: (state.lanes[trackId] ?? []).filter(
          (l) => l.id !== laneId,
        ),
      },
    }));
  },

  addPoint: (trackId, laneId, point) => {
    set((state) => ({
      lanes: {
        ...state.lanes,
        [trackId]: (state.lanes[trackId] ?? []).map((lane) => {
          if (lane.id !== laneId) return lane;
          const points = [...lane.points, point].sort(
            (a, b) => a.time - b.time,
          );
          return { ...lane, points };
        }),
      },
    }));
  },

  updatePoint: (trackId, laneId, index, updates) => {
    set((state) => ({
      lanes: {
        ...state.lanes,
        [trackId]: (state.lanes[trackId] ?? []).map((lane) => {
          if (lane.id !== laneId) return lane;
          const points = lane.points.map((p, i) =>
            i === index ? { ...p, ...updates } : p,
          );
          points.sort((a, b) => a.time - b.time);
          return { ...lane, points };
        }),
      },
    }));
  },

  removePoint: (trackId, laneId, index) => {
    set((state) => ({
      lanes: {
        ...state.lanes,
        [trackId]: (state.lanes[trackId] ?? []).map((lane) => {
          if (lane.id !== laneId) return lane;
          const points = lane.points.filter((_, i) => i !== index);
          return { ...lane, points };
        }),
      },
    }));
  },

  toggleLane: (trackId, laneId) => {
    set((state) => ({
      lanes: {
        ...state.lanes,
        [trackId]: (state.lanes[trackId] ?? []).map((lane) =>
          lane.id === laneId ? { ...lane, enabled: !lane.enabled } : lane,
        ),
      },
    }));
  },

  toggleLaneVisibility: (trackId, laneId) => {
    set((state) => ({
      lanes: {
        ...state.lanes,
        [trackId]: (state.lanes[trackId] ?? []).map((lane) =>
          lane.id === laneId ? { ...lane, visible: !lane.visible } : lane,
        ),
      },
    }));
  },
}));
