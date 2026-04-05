import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useEffectsStore } from '@/stores/effects-store';
import { useHistoryStore } from '@/stores/history-store';
import { analyzeMix, generateSuggestions } from './mix-analyzer';
import { generateId } from '@/utils/id';
import type { AISuggestion, SuggestionAction, SuggestionApplyMode } from '@/types/ai';
import type { EffectType, EffectParams } from '@/types/effects';

function defaultApplyMode(suggestion: AISuggestion): SuggestionApplyMode {
  if (suggestion.type === 'clipping') return 'safe-auto';
  if (suggestion.type === 'loudness' || suggestion.type === 'noise') return 'offline-commit';
  return 'manual';
}

function isTrackLocked(trackId: string): boolean {
  return useAIStore.getState().lockedTrackIds.includes(trackId);
}

function clampAction(action: SuggestionAction): SuggestionAction {
  const ai = useAIStore.getState();
  const tracks = useSessionStore.getState().tracks;
  const track = tracks.find((t) => t.id === action.trackId);

  if (action.type === 'setVolume' && typeof action.value === 'number') {
    const current = track?.volume ?? 0;
    const delta = Math.max(-ai.maxAutoVolumeDeltaDb, Math.min(ai.maxAutoVolumeDeltaDb, action.value - current));
    return { ...action, value: current + delta };
  }

  if (action.type === 'setPan' && typeof action.value === 'number') {
    const current = track?.pan ?? 0;
    const delta = Math.max(-ai.maxAutoPanDelta, Math.min(ai.maxAutoPanDelta, action.value - current));
    return { ...action, value: Math.max(-1, Math.min(1, current + delta)) };
  }

  if (action.type === 'batch' && action.actions) {
    return { ...action, actions: action.actions.map(clampAction) };
  }

  return action;
}

function applyAction(action: SuggestionAction | null): void {
  if (!action) return;
  if (action.trackId && isTrackLocked(action.trackId)) return;

  const mixer = useMixerStore.getState();
  const effects = useEffectsStore.getState();
  const session = useSessionStore.getState();
  const history = useHistoryStore.getState();

  const safeAction = clampAction(action);

  switch (safeAction.type) {
    case 'setVolume':
      if (safeAction.value !== undefined) {
        const before = session.tracks.find((t) => t.id === safeAction.trackId)?.volume ?? 0;
        const after = safeAction.value;
        mixer.setVolume(safeAction.trackId, after);
        session.updateTrack(safeAction.trackId, { volume: after });
        history.pushAction(
          `Volume ${safeAction.trackId}`,
          () => {
            mixer.setVolume(safeAction.trackId, before);
            session.updateTrack(safeAction.trackId, { volume: before });
          },
          () => {
            mixer.setVolume(safeAction.trackId, after);
            session.updateTrack(safeAction.trackId, { volume: after });
          },
        );
      }
      break;
    case 'setPan':
      if (safeAction.value !== undefined) {
        const before = session.tracks.find((t) => t.id === safeAction.trackId)?.pan ?? 0;
        const after = safeAction.value;
        mixer.setPan(safeAction.trackId, after);
        session.updateTrack(safeAction.trackId, { pan: after });
        history.pushAction(
          `Pan ${safeAction.trackId}`,
          () => {
            mixer.setPan(safeAction.trackId, before);
            session.updateTrack(safeAction.trackId, { pan: before });
          },
          () => {
            mixer.setPan(safeAction.trackId, after);
            session.updateTrack(safeAction.trackId, { pan: after });
          },
        );
      }
      break;
    case 'mute':
      mixer.toggleMute(safeAction.trackId);
      break;
    case 'unmute':
      mixer.toggleMute(safeAction.trackId);
      break;
    case 'addEffect':
      if (safeAction.effectType && safeAction.trackId && !isTrackLocked(safeAction.trackId)) {
        effects.addEffect(
          safeAction.trackId,
          safeAction.effectType as EffectType,
          safeAction.effectParams as EffectParams | undefined,
        );
      }
      break;
    case 'batch':
      if (safeAction.actions) {
        for (const subAction of safeAction.actions) applyAction(subAction);
      }
      break;
  }
}

export function runAnalysis(): void {
  const aiState = useAIStore.getState();
  if (!aiState.enabled) return;

  const { tracks, config } = useSessionStore.getState();
  if (tracks.length === 0) return;

  aiState.setAnalyzing(true);

  try {
    const analysis = analyzeMix(tracks, config.sampleRate);
    aiState.setAnalysis(analysis);

    const suggestions = generateSuggestions(analysis, tracks, config.genre).map((s) => ({
      ...s,
      applyMode: s.applyMode ?? defaultApplyMode(s),
      realtimeSafe: s.realtimeSafe ?? (s.type === 'clipping' || s.type === 'level' || s.type === 'pan' || s.type === 'gain-staging'),
      reversible: s.reversible ?? (!!s.action && ['setVolume', 'setPan', 'batch'].includes(s.action.type)),
      evidence: s.evidence ?? [],
      constraints: s.constraints ?? [],
    }));

    aiState.clearSuggestions();

    for (const suggestion of suggestions) {
      const eligibleForAuto =
        aiState.applyMode === 'safe-auto' &&
        suggestion.applyMode === 'safe-auto' &&
        suggestion.realtimeSafe &&
        suggestion.confidence >= 0.9 &&
        !!suggestion.action &&
        (!suggestion.targetTrackId || !isTrackLocked(suggestion.targetTrackId));

      if (eligibleForAuto) {
        applyAction(suggestion.action);
        aiState.logActivity({
          id: generateId('log'),
          description: `Auto-applied: ${suggestion.title}`,
          trackId: suggestion.targetTrackId,
          timestamp: Date.now(),
          undoable: Boolean(suggestion.reversible),
        });
        suggestion.status = 'applied';
      }

      aiState.addSuggestion(suggestion);
    }
  } finally {
    aiState.setAnalyzing(false);
  }
}

export function acceptSuggestion(suggestionId: string): void {
  const aiState = useAIStore.getState();
  const suggestion = aiState.suggestions.find((s) => s.id === suggestionId);
  if (!suggestion || suggestion.status !== 'pending') return;
  if (suggestion.targetTrackId && isTrackLocked(suggestion.targetTrackId)) return;

  aiState.acceptSuggestion(suggestionId);

  if (suggestion.action) {
    applyAction(suggestion.action);
    aiState.applySuggestion(suggestionId);
    aiState.logActivity({
      id: generateId('log'),
      description: `Applied: ${suggestion.title}`,
      trackId: suggestion.targetTrackId,
      timestamp: Date.now(),
      undoable: Boolean(suggestion.reversible),
    });
  }
}

export function rejectSuggestion(suggestionId: string): void {
  useAIStore.getState().rejectSuggestion(suggestionId);
}
