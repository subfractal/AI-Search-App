import { create } from 'zustand';
import { useEffectsStore } from '@/stores/effects-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useSessionStore } from '@/stores/session-store';
import type {
  AISuggestion,
  AIActivityEntry,
  MixAnalysis,
  RealtimeLevel,
  SuggestionApplyMode,
  ComposerSettings,
  MasteringResult,
  MasteringDecision,
  MasteringScope,
  OfflineTask,
  ComposerPreset,
} from '@/types/ai';
import { generateId } from '@/utils/id';

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
  masteringABActive: boolean;
  masteringDecisions: MasteringDecision[];
  masteringScope: MasteringScope;
  masteringTargetTrackIds: string[];
  preferredInstrumentFamily: string;
  preferredDrumMode: string;
  preferredVariationIntensity: number;
  savedComposerPresets: ComposerPreset[];
  offlineTasks: OfflineTask[];

  // Phase 1: Autonomous Agentic Studio Manager
  commandBarOpen: boolean;
  autoOrganizeEnabled: boolean;
  cpuManagementEnabled: boolean;
  autoGainStagingOnImport: boolean;

  toggleCommandBar: () => void;
  setAutoOrganize: (enabled: boolean) => void;
  setCpuManagement: (enabled: boolean) => void;
  setAutoGainStagingOnImport: (enabled: boolean) => void;

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
  setMasteringABActive: (active: boolean) => void;
  setMasteringDecisions: (decisions: MasteringDecision[]) => void;
  toggleMasteringDecision: (decisionId: string) => void;
  updateMasteringDecisionParams: (decisionId: string, params: Record<string, number>) => void;
  removeMasteringDecision: (decisionId: string) => void;
  revertMastering: () => void;
  setMasteringScope: (scope: MasteringScope) => void;
  setMasteringTargetTrackIds: (ids: string[]) => void;
  setPreferredInstrumentFamily: (family: string) => void;
  setPreferredDrumMode: (mode: string) => void;
  setPreferredVariationIntensity: (intensity: number) => void;
  saveComposerPreset: (name: string) => string;
  loadComposerPreset: (id: string) => void;
  deleteComposerPreset: (id: string) => void;
  addOfflineTask: (task: OfflineTask) => void;
  updateOfflineTask: (id: string, updates: Partial<OfflineTask>) => void;
  removeOfflineTask: (id: string) => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
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
    role: 'general',
    coproducerMode: 'create',
  },
  appliedSignatures: [],
  masteringInProgress: false,
  masteringResult: null,
  masteringABActive: true,
  masteringDecisions: [],
  masteringScope: 'all' as MasteringScope,
  masteringTargetTrackIds: [] as string[],
  preferredInstrumentFamily: '',
  preferredDrumMode: '',
  preferredVariationIntensity: 0.5,
  savedComposerPresets: [],
  offlineTasks: [],

  // Phase 1: Autonomous Agentic Studio Manager
  commandBarOpen: false,
  autoOrganizeEnabled: true,
  cpuManagementEnabled: false,
  autoGainStagingOnImport: true,

  toggleCommandBar: () => set((s) => ({ commandBarOpen: !s.commandBarOpen })),
  setAutoOrganize: (enabled) => set({ autoOrganizeEnabled: enabled }),
  setCpuManagement: (enabled) => set({ cpuManagementEnabled: enabled }),
  setAutoGainStagingOnImport: (enabled) => set({ autoGainStagingOnImport: enabled }),

  setEnabled: (enabled) => set({ enabled }),

  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [...state.suggestions, suggestion].slice(-200),
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
  setMasteringABActive: (active) => {
    const decisions = get().masteringDecisions;
    const result = get().masteringResult;
    const effects = useEffectsStore.getState();
    const mixer = useMixerStore.getState();
    const session = useSessionStore.getState();

    for (const d of decisions) {
      if (d.effectId) {
        // Toggle each mastering effect on/off
        const trackEffects = effects.trackEffects[d.trackId] ?? [];
        const fx = trackEffects.find((e) => e.id === d.effectId);
        if (fx && fx.enabled !== active) {
          effects.toggleEffect(d.trackId, d.effectId);
        }
      }
    }

    // Swap volumes back to snapshot (A) or mastered (B)
    if (result?.snapshot) {
      for (const track of session.tracks) {
        if (active) {
          // Restore mastered volumes (current state after mastering)
          // Gain staging decisions have the target volume in params
          const gainDecision = decisions.find(
            (d) => d.stage === 'Gain Staging' && d.trackId === track.id,
          );
          if (gainDecision && gainDecision.params.volume !== undefined) {
            const vol = gainDecision.params.volume;
            mixer.setVolume(track.id, vol);
            session.updateTrack(track.id, { volume: vol });
          }
        } else {
          // Restore original volumes from snapshot
          const origVol = result.snapshot.trackVolumes[track.id];
          if (origVol !== undefined) {
            mixer.setVolume(track.id, origVol);
            session.updateTrack(track.id, { volume: origVol });
          }
        }
      }
    }

    set({ masteringABActive: active });
  },
  setMasteringDecisions: (decisions) => set({ masteringDecisions: decisions }),
  toggleMasteringDecision: (decisionId) => {
    const decisions = get().masteringDecisions;
    const decision = decisions.find((d) => d.id === decisionId);
    if (!decision) return;

    if (decision.effectId) {
      useEffectsStore.getState().toggleEffect(decision.trackId, decision.effectId);
    } else if (decision.stage === 'Gain Staging') {
      // Toggle gain staging: swap between original and mastered volume
      const result = get().masteringResult;
      const origVol = result?.snapshot?.trackVolumes[decision.trackId];
      const masteredVol = decision.params.volume ?? undefined;
      const session = useSessionStore.getState();
      const currentVol = session.tracks.find((t) => t.id === decision.trackId)?.volume ?? 0;
      const targetVol = decision.enabled
        ? (origVol ?? currentVol)
        : (masteredVol !== undefined ? masteredVol : currentVol);
      useMixerStore.getState().setVolume(decision.trackId, targetVol);
      session.updateTrack(decision.trackId, { volume: targetVol });
    }

    set({
      masteringDecisions: decisions.map((d) =>
        d.id === decisionId ? { ...d, enabled: !d.enabled } : d,
      ),
    });
  },
  updateMasteringDecisionParams: (decisionId, params) => {
    const decisions = get().masteringDecisions;
    const decision = decisions.find((d) => d.id === decisionId);
    if (!decision || !decision.effectId) return;

    useEffectsStore.getState().updateEffect(
      decision.trackId,
      decision.effectId,
      params as Record<string, number | string>,
    );

    set({
      masteringDecisions: decisions.map((d) =>
        d.id === decisionId ? { ...d, params: { ...d.params, ...params } } : d,
      ),
    });
  },
  removeMasteringDecision: (decisionId) => {
    const decisions = get().masteringDecisions;
    const decision = decisions.find((d) => d.id === decisionId);
    if (!decision) return;

    if (decision.effectId) {
      useEffectsStore.getState().removeEffect(decision.trackId, decision.effectId);
    } else if (decision.stage === 'Gain Staging') {
      // Revert gain to original
      const result = get().masteringResult;
      const origVol = result?.snapshot?.trackVolumes[decision.trackId];
      if (origVol !== undefined) {
        useMixerStore.getState().setVolume(decision.trackId, origVol);
        useSessionStore.getState().updateTrack(decision.trackId, { volume: origVol });
      }
    }

    set({ masteringDecisions: decisions.filter((d) => d.id !== decisionId) });
  },
  revertMastering: () => {
    const decisions = get().masteringDecisions;
    const result = get().masteringResult;

    // Remove all mastering effects
    for (const d of decisions) {
      if (d.effectId) {
        try { useEffectsStore.getState().removeEffect(d.trackId, d.effectId); } catch { /* already removed */ }
      }
    }

    // Restore original volumes and pans from snapshot
    if (result?.snapshot) {
      const mixer = useMixerStore.getState();
      const session = useSessionStore.getState();
      for (const [trackId, vol] of Object.entries(result.snapshot.trackVolumes)) {
        mixer.setVolume(trackId, vol);
        session.updateTrack(trackId, { volume: vol });
      }
      for (const [trackId, pan] of Object.entries(result.snapshot.trackPans)) {
        mixer.setPan(trackId, pan);
        session.updateTrack(trackId, { pan });
      }
    }

    set({ masteringResult: null, masteringDecisions: [], masteringABActive: true });
  },

  setMasteringScope: (scope) => set({ masteringScope: scope }),
  setMasteringTargetTrackIds: (ids) => set({ masteringTargetTrackIds: ids }),

  setPreferredInstrumentFamily: (family) => set({ preferredInstrumentFamily: family }),
  setPreferredDrumMode: (mode) => set({ preferredDrumMode: mode }),
  setPreferredVariationIntensity: (intensity) =>
    set({ preferredVariationIntensity: Math.max(0, Math.min(1, intensity)) }),

  saveComposerPreset: (name) => {
    const id = generateId('cpreset');
    const settings = { ...get().composer };
    set((state) => ({
      savedComposerPresets: [...state.savedComposerPresets, { id, name, settings }],
    }));
    return id;
  },

  loadComposerPreset: (id) => {
    const preset = get().savedComposerPresets.find((p) => p.id === id);
    if (preset) set({ composer: { ...preset.settings } });
  },

  deleteComposerPreset: (id) =>
    set((state) => ({
      savedComposerPresets: state.savedComposerPresets.filter((p) => p.id !== id),
    })),

  addOfflineTask: (task) =>
    set((state) => ({ offlineTasks: [...state.offlineTasks, task] })),

  updateOfflineTask: (id, updates) =>
    set((state) => ({
      offlineTasks: state.offlineTasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    })),

  removeOfflineTask: (id) =>
    set((state) => ({
      offlineTasks: state.offlineTasks.filter((t) => t.id !== id),
    })),
}));
