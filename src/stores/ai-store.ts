import { create } from 'zustand';
import type {
  AISuggestion,
  AIActivityEntry,
  MixAnalysis,
} from '@/types/ai';

interface AIStore {
  enabled: boolean;
  suggestions: AISuggestion[];
  activityLog: AIActivityEntry[];
  lastAnalysis: MixAnalysis | null;
  analyzing: boolean;

  setEnabled: (enabled: boolean) => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  applySuggestion: (id: string) => void;
  clearSuggestions: () => void;
  logActivity: (entry: AIActivityEntry) => void;
  setAnalysis: (analysis: MixAnalysis) => void;
  setAnalyzing: (analyzing: boolean) => void;
}

export const useAIStore = create<AIStore>((set) => ({
  enabled: true,
  suggestions: [],
  activityLog: [],
  lastAnalysis: null,
  analyzing: false,

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
}));
