import { create } from 'zustand';
import { generateId } from '@/utils/id';
import * as effectsService from '@/services/effects-service';
import type { EffectConfig, EffectType, EffectParams } from '@/types/effects';
import { DEFAULT_PARAMS } from '@/types/effects';

interface EffectsStore {
  trackEffects: Record<string, EffectConfig[]>;

  addEffect: (trackId: string, type: EffectType, params?: EffectParams) => string;
  removeEffect: (trackId: string, effectId: string) => void;
  updateEffect: (
    trackId: string,
    effectId: string,
    params: Record<string, number | string>,
  ) => void;
  toggleEffect: (trackId: string, effectId: string) => void;
  reorderEffects: (
    trackId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  clearTrackEffects: (trackId: string) => void;
}

export const useEffectsStore = create<EffectsStore>((set, get) => ({
  trackEffects: {},

  addEffect: (trackId, type, params) => {
    const config: EffectConfig = {
      id: generateId('fx'),
      type,
      enabled: true,
      params: params ?? { ...DEFAULT_PARAMS[type] },
    };

    effectsService.addEffect(trackId, config);

    set((state) => {
      const existing = state.trackEffects[trackId] ?? [];
      return {
        trackEffects: {
          ...state.trackEffects,
          [trackId]: [...existing, config],
        },
      };
    });

    return config.id;
  },

  removeEffect: (trackId, effectId) => {
    effectsService.removeEffect(trackId, effectId);

    set((state) => {
      const existing = state.trackEffects[trackId];
      if (!existing) return state;
      return {
        trackEffects: {
          ...state.trackEffects,
          [trackId]: existing.filter((e) => e.id !== effectId),
        },
      };
    });
  },

  updateEffect: (trackId, effectId, params) => {
    effectsService.updateEffectParams(trackId, effectId, params);

    set((state) => {
      const existing = state.trackEffects[trackId];
      if (!existing) return state;
      return {
        trackEffects: {
          ...state.trackEffects,
          [trackId]: existing.map((e) =>
            e.id === effectId
              ? { ...e, params: { ...e.params, ...params } as EffectParams }
              : e,
          ),
        },
      };
    });
  },

  toggleEffect: (trackId, effectId) => {
    const existing = get().trackEffects[trackId];
    if (!existing) return;

    const effect = existing.find((e) => e.id === effectId);
    if (!effect) return;

    const enabled = !effect.enabled;
    effectsService.toggleEffect(trackId, effectId, enabled);

    set((state) => ({
      trackEffects: {
        ...state.trackEffects,
        [trackId]: (state.trackEffects[trackId] ?? []).map((e) =>
          e.id === effectId ? { ...e, enabled } : e,
        ),
      },
    }));
  },

  reorderEffects: (trackId, fromIndex, toIndex) => {
    const existing = get().trackEffects[trackId];
    if (!existing) return;

    const reordered = [...existing];
    const [moved] = reordered.splice(fromIndex, 1);
    if (!moved) return;
    reordered.splice(toIndex, 0, moved);

    const effectIds = reordered.map((e) => e.id);
    effectsService.reorderEffects(trackId, effectIds);

    set((state) => ({
      trackEffects: {
        ...state.trackEffects,
        [trackId]: reordered,
      },
    }));
  },

  clearTrackEffects: (trackId) => {
    effectsService.disposeTrackEffects(trackId);

    set((state) => {
      const { [trackId]: _, ...rest } = state.trackEffects;
      return { trackEffects: rest };
    });
  },
}));
