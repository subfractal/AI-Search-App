/**
 * Unmasking Engine — builds on existing masking-detector.ts to automatically
 * resolve frequency conflicts between tracks via EQ adjustments.
 *
 * Also provides the "Clarity" macro that maps a 0-100 value to
 * spectral ducking depth per track.
 */

import type { MixAnalysis } from '@/types/ai';
import { useEffectsStore } from '@/stores/effects-store';
import type { EQ3Params } from '@/types/effects';
import { useHistoryStore } from '@/stores/history-store';
import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';

export interface UnmaskingAction {
  trackId: string;
  trackName: string;
  band: string;
  bandKey: 'low' | 'mid' | 'high';
  cutDb: number;
  reason: string;
}

export interface UnmaskingPlan {
  actions: UnmaskingAction[];
  summary: string;
}

export interface ClarityMacro {
  trackId: string;
  amount: number;
  actions: UnmaskingAction[];
}

// Map masking detector band labels to EQ band keys
const BAND_TO_EQ_KEY: Record<string, 'low' | 'mid' | 'high'> = {
  'Low (20-250 Hz)': 'low',
  'Low-Mid (250-1k Hz)': 'low',
  'Mid (1k-4k Hz)': 'mid',
  'High-Mid (4k-8k Hz)': 'high',
  'High (8k-20k Hz)': 'high',
};

function getTrackName(trackId: string): string {
  return useSessionStore.getState().tracks.find((t) => t.id === trackId)?.name ?? 'track';
}

/**
 * Generate an unmasking plan: for each masking pair, compute EQ cuts
 * on the non-dominant track to reduce overlap.
 */
export function computeUnmaskingPlan(
  analysis: MixAnalysis,
): UnmaskingPlan {
  const actions: UnmaskingAction[] = [];

  for (const pair of analysis.maskingPairs) {
    if (pair.severity < 0.4) continue;

    // Cut the non-dominant track
    const cutTrackId = pair.dominantTrackId === pair.trackAId
      ? pair.trackBId
      : pair.trackAId;

    for (const bandLabel of pair.maskedBands) {
      const bandKey = BAND_TO_EQ_KEY[bandLabel] ?? 'mid';
      const cutDb = Math.round(pair.severity * -6 * 10) / 10;

      actions.push({
        trackId: cutTrackId,
        trackName: getTrackName(cutTrackId),
        band: bandLabel,
        bandKey,
        cutDb,
        reason: `Masking with "${getTrackName(pair.dominantTrackId)}" in ${bandLabel} (severity: ${Math.round(pair.severity * 100)}%)`,
      });
    }
  }

  const summary = actions.length > 0
    ? `${actions.length} EQ cuts across ${new Set(actions.map((a) => a.trackId)).size} tracks`
    : 'No significant masking conflicts found';

  return { actions, summary };
}

/**
 * Apply an unmasking plan by adding/modifying EQ effects on affected tracks.
 */
export function applyUnmaskingPlan(plan: UnmaskingPlan): void {
  const effects = useEffectsStore.getState();
  const history = useHistoryStore.getState();

  for (const action of plan.actions) {
    // Check if track already has an EQ; if so, update it. Otherwise, add one.
    const existingEffects = effects.trackEffects[action.trackId] ?? [];
    const existingEq = existingEffects.find((e) => e.type === 'eq');

    if (existingEq) {
      // Update existing EQ band
      const update: Record<string, number | string> = {};
      update[action.bandKey] = action.cutDb;
      effects.updateEffect(action.trackId, existingEq.id, update);
    } else {
      // Add new EQ with the cut
      const params: EQ3Params = {
        low: 0, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500,
      };
      params[action.bandKey] = action.cutDb;
      const effectId = effects.addEffect(action.trackId, 'eq', params);
      history.pushAction(
        `Unmasking: added EQ to "${action.trackName}"`,
        () => useEffectsStore.getState().removeEffect(action.trackId, effectId),
        () => useEffectsStore.getState().addEffect(action.trackId, 'eq', params),
      );
    }
  }

  useAIStore.getState().logActivity({
    id: `unmask-${Date.now()}`,
    description: `Applied unmasking: ${plan.summary}`,
    trackId: null,
    timestamp: Date.now(),
    undoable: true,
  });
}

/**
 * Compute clarity macro actions for a single track.
 * Clarity 0 = no processing, 100 = maximum spectral ducking.
 */
export function computeClarityMacro(
  trackId: string,
  amount: number,
  analysis: MixAnalysis,
): ClarityMacro {
  const normalizedAmount = Math.max(0, Math.min(100, amount)) / 100;
  const actions: UnmaskingAction[] = [];

  if (normalizedAmount === 0) {
    return { trackId, amount, actions };
  }

  // Find all masking pairs involving this track
  for (const pair of analysis.maskingPairs) {
    if (pair.trackAId !== trackId && pair.trackBId !== trackId) continue;
    if (pair.severity < 0.3) continue;

    // If this track is the non-dominant one, apply cuts
    const isDominant = pair.dominantTrackId === trackId;
    if (isDominant) continue; // Don't cut the dominant track

    for (const bandLabel of pair.maskedBands) {
      const bandKey = BAND_TO_EQ_KEY[bandLabel] ?? 'mid';
      const cutDb = Math.round(pair.severity * normalizedAmount * -6 * 10) / 10;

      actions.push({
        trackId,
        trackName: getTrackName(trackId),
        band: bandLabel,
        bandKey,
        cutDb,
        reason: `Clarity ducking against "${getTrackName(pair.dominantTrackId)}"`,
      });
    }
  }

  return { trackId, amount, actions };
}

/**
 * Apply clarity macro by setting EQ on the track.
 */
export function applyClarityMacro(macro: ClarityMacro): void {
  if (macro.actions.length === 0) return;

  const effects = useEffectsStore.getState();
  const existingEffects = effects.trackEffects[macro.trackId] ?? [];
  const existingEq = existingEffects.find((e) => e.type === 'eq');

  // Aggregate cuts per band key
  const params: EQ3Params = {
    low: 0, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500,
  };
  for (const action of macro.actions) {
    params[action.bandKey] = Math.min(params[action.bandKey], action.cutDb);
  }

  if (existingEq) {
    effects.updateEffect(macro.trackId, existingEq.id, params as unknown as Record<string, number | string>);
  } else {
    effects.addEffect(macro.trackId, 'eq', params);
  }
}
