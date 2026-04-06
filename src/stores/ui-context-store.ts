import { create } from 'zustand';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

interface UIContextStore {
  skillLevel: SkillLevel;
  manuallySet: boolean;
  actionHistory: Array<{ action: string; timestamp: number }>;
  featureUsage: Record<string, number>;
  sessionCount: number;
  explanationsEnabled: boolean;
  voiceEnabled: boolean;

  setSkillLevel: (level: SkillLevel) => void;
  recordAction: (action: string) => void;
  incrementFeatureUsage: (feature: string) => void;
  inferSkillLevel: () => SkillLevel;
  setExplanationsEnabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
}

export const useUIContextStore = create<UIContextStore>((set, get) => ({
  skillLevel: 'intermediate',
  manuallySet: false,
  actionHistory: [],
  featureUsage: {},
  sessionCount: 0,
  explanationsEnabled: true,
  voiceEnabled: false,

  setSkillLevel: (level) => set({ skillLevel: level, manuallySet: true }),

  recordAction: (action) =>
    set((s) => ({
      actionHistory: [
        { action, timestamp: Date.now() },
        ...s.actionHistory,
      ].slice(0, 200),
    })),

  incrementFeatureUsage: (feature) =>
    set((s) => ({
      featureUsage: {
        ...s.featureUsage,
        [feature]: (s.featureUsage[feature] ?? 0) + 1,
      },
    })),

  inferSkillLevel: (): SkillLevel => {
    const state = get();
    if (state.manuallySet) return state.skillLevel;

    const totalActions = state.actionHistory.length;
    const features = Object.keys(state.featureUsage);
    const advancedFeatures = ['routing', 'sidechain', 'mastering', 'multibandComp',
      'automation', 'reharmonize', 'spectralMatrix'];
    const usesAdvanced = advancedFeatures.some((f) => (state.featureUsage[f] ?? 0) > 0);

    if (totalActions > 200 || usesAdvanced) return 'advanced';
    if (totalActions > 30 || features.length > 5) return 'intermediate';
    return 'beginner';
  },

  setExplanationsEnabled: (enabled) => set({ explanationsEnabled: enabled }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
}));
