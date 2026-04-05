import { create } from 'zustand';
import type {
  AISuggestion,
  AIActivityEntry,
  MixAnalysis,
  RealtimeLevel,
  SuggestionApplyMode,
  ComposerSettings,
  MasteringResult,
} from '@/types/ai';

interface AIStore {
  enabled: boolean;
  suggestions: AISuggestion[];
  activityLog: AIActivityEntry[];
  lastAnalysis: MixAnalysis | null;
  analyzing: boolean;
  realtimeLevels: Record<string, RealtimeLevel>;
  clippingAlerts: string[];
  monitorEnabled: boolean;
  applyMode: SuggestionApplyMode;
  maxAutoVolumeDeltaDb: number;
  maxAutoPanDelta: number;
  lockedTrackIds: string[];
  composer: ComposerSettings;
  appliedSignatures: string[];
  masteringInProgress: boolean;
  masteringResult: MasteringResult | null;

  setEnabled: (enabled: boolean) => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  applySuggestion: (id: string) => void;
  clearSuggestions: () => void;
  logActivity: (entry: AIActivityEntry) => void;
  setAnalysis: (analysis: MixAnalysis) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setRealtimeLevels: (levels: Record<string, RealtimeLevel>) => void;
  setClippingAlerts: (trackIds: string[]) => void;
  setMonitorEnabled: (enabled: boolean) => void;
  setApplyMode: (mode: SuggestionApplyMode) => void;
  setMaxAutoVolumeDeltaDb: (value: number) => void;
  setMaxAutoPanDelta: (value: number) => void;
  toggleTrackLock: (trackId: string) => void;
  setComposer: (updates: Partial<ComposerSettings>) => void;
  addAppliedSignature: (sig: string) => void;
  resetAppliedSignatures: () => void;
  setMasteringInProgress: (v: boolean) => void;
  setMasteringResult: (r: MasteringResult | null) => void;
}

export const useAIStore = create<AIStore>((set) => ({
  enabled: true,
  suggestions: [],
  activityLog: [],
  lastAnalysis: null,
  analyzing: false,
  realtimeLevels: {},
  clippingAlerts: [],
  monitorEnabled: false,
  applyMode: 'manual',
  maxAutoVolumeDeltaDb: 3,
  maxAutoPanDelta: 0.35,
  lockedTrackIds: [],
  composer: {
    model: 'markov',
    bars: 4,
    density: 0.6,
    temperature: 0.45,
    seed: 1,
  },
  appliedSignatures: [],
  masteringInProgress: false,
  masteringResult: null,

  setEnabled: (enabled) => set({ enabled }),

  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [...state.suggestions, suggestion],
    })),

  acceptSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === id ? { ...s, status: 'accepted' as const } : s,
      ),
    })),

  rejectSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === id ? { ...s, status: 'rejected' as const } : s,
      ),
    })),

  applySuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) =>
        s.id === id ? { ...s, status: 'applied' as const } : s,
      ),
    })),

  clearSuggestions: () => set({ suggestions: [] }),

  logActivity: (entry) =>
    set((state) => ({
      activityLog: [entry, ...state.activityLog].slice(0, 100),
    })),

  setAnalysis: (analysis) => set({ lastAnalysis: analysis }),
  setAnalyzing: (analyzing) => set({ analyzing }),
  setRealtimeLevels: (levels) => set({ realtimeLevels: levels }),
  setClippingAlerts: (trackIds) => set({ clippingAlerts: trackIds }),
  setMonitorEnabled: (enabled) => set({ monitorEnabled: enabled }),
  setApplyMode: (mode) => set({ applyMode: mode }),
  setMaxAutoVolumeDeltaDb: (value) => set({ maxAutoVolumeDeltaDb: Math.max(0.5, Math.min(12, value)) }),
  setMaxAutoPanDelta: (value) => set({ maxAutoPanDelta: Math.max(0.05, Math.min(1, value)) }),
  toggleTrackLock: (trackId) =>
    set((state) => ({
      lockedTrackIds: state.lockedTrackIds.includes(trackId)
        ? state.lockedTrackIds.filter((id) => id !== trackId)
        : [...state.lockedTrackIds, trackId],
    })),
  setComposer: (updates) =>
    set((state) => ({
      composer: { ...state.composer, ...updates },
    })),
  addAppliedSignature: (sig) =>
    set((state) => ({
      appliedSignatures: state.appliedSignatures.includes(sig)
        ? state.appliedSignatures
        : [...state.appliedSignatures, sig],
    })),
  resetAppliedSignatures: () => set({ appliedSignatures: [], suggestions: [] }),
  setMasteringInProgress: (v) => set({ masteringInProgress: v }),
  setMasteringResult: (r) => set({ masteringResult: r }),
}));
