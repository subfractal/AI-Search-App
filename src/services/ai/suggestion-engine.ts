/**
 * AI Suggestion Engine — Execution Boundary
 *
 * Future LLM integration point:
 * - LLM generates SuggestionAction payloads (typed, bounded)
 * - canApplySuggestionNow() validates before execution
 * - applyAction() executes with undo support
 * - All actions are clamped by maxAutoVolumeDeltaDb / maxAutoPanDelta
 * - Track locks prevent modification of protected tracks
 */

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
  // Never auto-apply addEffect actions — prevents stacking duplicate FX
  if (suggestion.action?.type === 'addEffect') return 'manual';
  if (suggestion.action?.type === 'batch') {
    const hasEffect = suggestion.action.actions?.some((a) => a.type === 'addEffect');
    if (hasEffect) return 'manual';
  }
  if (suggestion.type === 'clipping') return 'safe-auto';
  if (suggestion.type === 'loudness' || suggestion.type === 'noise') return 'offline-commit';
  return 'manual';
}

function getSuggestionSignature(suggestion: AISuggestion): string {
  const actionKey = suggestion.action
    ? `${suggestion.action.type}:${suggestion.action.trackId}:${suggestion.action.effectType ?? ''}:${JSON.stringify(suggestion.action.effectParams ?? {})}`
    : 'no-action';
  return `${suggestion.type}:${suggestion.targetTrackId ?? 'global'}:${actionKey}`;
}

function isTrackLocked(trackId: string): boolean {
  return useAIStore.getState().lockedTrackIds.includes(trackId);
}

function getTrackName(trackId: string): string {
  return useSessionStore.getState().tracks.find((t) => t.id === trackId)?.name ?? 'track';
}

/**
 * Centralized policy check: can we auto-apply this suggestion right now?
 * Returns { allowed, reason } — reason explains why it was blocked.
 */
export function canApplySuggestionNow(
  suggestion: AISuggestion,
  globalMode: SuggestionApplyMode,
): { allowed: boolean; reason?: string } {
  if (!suggestion.action)
    return { allowed: false, reason: 'No action defined' };

  if (suggestion.action.trackId && isTrackLocked(suggestion.action.trackId))
    return { allowed: false, reason: `Track "${getTrackName(suggestion.action.trackId)}" is locked` };

  switch (globalMode) {
    case 'manual':
      return { allowed: false, reason: 'Manual mode — user apply only' };
    case 'realtime-preview':
      if (!suggestion.realtimeSafe)
        return { allowed: false, reason: 'Not realtime-safe' };
      if (!suggestion.reversible)
        return { allowed: false, reason: 'Not reversible — preview requires reversibility' };
      return { allowed: true };
    case 'offline-commit':
      return { allowed: true };
    case 'safe-auto':
      if (!suggestion.realtimeSafe)
        return { allowed: false, reason: 'Not realtime-safe' };
      if (suggestion.confidence < 0.9)
        return { allowed: false, reason: `Confidence ${Math.round(suggestion.confidence * 100)}% below 90% threshold` };
      if (suggestion.applyMode !== 'safe-auto')
        return { allowed: false, reason: `Suggestion mode is "${suggestion.applyMode}", not safe-auto` };
      return { allowed: true };
  }
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
  const trackName = getTrackName(safeAction.trackId);

  switch (safeAction.type) {
    case 'setVolume':
      if (safeAction.value !== undefined) {
        const before = session.tracks.find((t) => t.id === safeAction.trackId)?.volume ?? 0;
        const after = safeAction.value;
        const delta = after - before;
        mixer.setVolume(safeAction.trackId, after);
        session.updateTrack(safeAction.trackId, { volume: after });
        history.pushAction(
          `Applied ${delta > 0 ? '+' : ''}${delta.toFixed(1)} dB to ${trackName}`,
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
          `Panned ${trackName} to ${after.toFixed(2)}`,
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
    case 'unmute': {
      const wasMuted = mixer.strips[safeAction.trackId]?.mute ?? false;
      mixer.toggleMute(safeAction.trackId);
      history.pushAction(
        `${safeAction.type === 'mute' ? 'Muted' : 'Unmuted'} ${trackName}`,
        () => {
          const currentMute = useMixerStore.getState().strips[safeAction.trackId]?.mute ?? false;
          if (currentMute !== wasMuted) useMixerStore.getState().toggleMute(safeAction.trackId);
        },
        () => useMixerStore.getState().toggleMute(safeAction.trackId),
      );
      break;
    }
    case 'addEffect':
      if (safeAction.effectType && safeAction.trackId && !isTrackLocked(safeAction.trackId)) {
        const effectId = effects.addEffect(
          safeAction.trackId,
          safeAction.effectType as EffectType,
          safeAction.effectParams as EffectParams | undefined,
        );
        history.pushAction(
          `Added ${safeAction.effectType} to ${trackName}`,
          () => useEffectsStore.getState().removeEffect(safeAction.trackId, effectId),
          () => useEffectsStore.getState().addEffect(
            safeAction.trackId,
            safeAction.effectType as EffectType,
            safeAction.effectParams as EffectParams | undefined,
          ),
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

    // If mastering was already applied, skip suggestions that would conflict
    // with mastering decisions (gain, EQ, compression, limiting)
    const masteringResult = aiState.masteringResult;
    const masteredTypes = new Set<string>();
    if (masteringResult) {
      for (const stage of masteringResult.stages) {
        if (!stage.applied) continue;
        if (stage.name === 'Gain Staging') masteredTypes.add('level').add('gain-staging');
        if (stage.name === 'EQ Balance') masteredTypes.add('eq').add('frequency');
        if (stage.name === 'Compression') masteredTypes.add('dynamics');
        if (stage.name === 'Limiting') masteredTypes.add('clipping').add('loudness');
      }
    }

    const appliedSigs = aiState.appliedSignatures;
    const allSuggestions = generateSuggestions(analysis, tracks, config.genre).map((s) => ({
      ...s,
      applyMode: s.applyMode ?? defaultApplyMode(s),
      realtimeSafe: s.realtimeSafe ?? (s.type === 'clipping' || s.type === 'level' || s.type === 'pan' || s.type === 'gain-staging'),
      reversible: s.reversible ?? (!!s.action && ['setVolume', 'setPan', 'batch'].includes(s.action.type)),
      evidence: s.evidence ?? [],
      constraints: s.constraints ?? [],
    }));

    // Filter out suggestions that have already been applied or conflict with mastering
    const suggestions = allSuggestions.filter((s) => {
      const sig = getSuggestionSignature(s);
      if (appliedSigs.includes(sig)) return false;
      // Skip suggestions that overlap with mastering pipeline stages
      if (masteredTypes.has(s.type)) return false;
      return true;
    });

    aiState.clearSuggestions();

    for (const suggestion of suggestions) {
      const policy = canApplySuggestionNow(suggestion, aiState.applyMode);

      if (policy.allowed) {
        applyAction(suggestion.action);
        aiState.addAppliedSignature(getSuggestionSignature(suggestion));
        aiState.logActivity({
          id: generateId('log'),
          description: `Auto-applied: ${suggestion.title}`,
          trackId: suggestion.targetTrackId,
          timestamp: Date.now(),
          undoable: Boolean(suggestion.reversible),
        });
        suggestion.status = 'applied';
      } else if (aiState.applyMode !== 'manual' && suggestion.action) {
        // Log why auto-apply was skipped (only in non-manual modes)
        aiState.logActivity({
          id: generateId('log'),
          description: `Skipped auto-apply: ${policy.reason}`,
          trackId: suggestion.targetTrackId,
          timestamp: Date.now(),
          undoable: false,
        });
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
    aiState.addAppliedSignature(getSuggestionSignature(suggestion));
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
