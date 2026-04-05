/**
 * Predictive Tools — surfaces relevant actions based on user behavior.
 * Uses frequency-weighted transitions and contextual rules.
 */

// Predefined action transition probabilities
const TRANSITION_TABLE: Record<string, string[]> = {
  import: ['analyze', 'addEffect', 'gainStage', 'classify'],
  analyze: ['applySuggestion', 'addEq', 'master', 'unmask'],
  compose: ['quantize', 'variation', 'addInstrument', 'reharmonize'],
  master: ['export', 'abCompare', 'adjustMastering', 'revertMastering'],
  addEffect: ['tweakParams', 'addEffect', 'analyze', 'bypass'],
  record: ['trim', 'normalize', 'addEffect', 'duplicate'],
  variation: ['compose', 'humanize', 'interpolate', 'reharmonize'],
  export: ['save', 'newTrack', 'master'],
  unmask: ['clarity', 'addEq', 'analyze'],
  reharmonize: ['humanize', 'variation', 'compose'],
};

// Contextual rules based on session state
interface SessionContext {
  hasSelectedTrack: boolean;
  hasMidiClips: boolean;
  hasAudioClips: boolean;
  trackCount: number;
  hasMastering: boolean;
  hasEffects: boolean;
}

function contextualSuggestions(context: SessionContext): string[] {
  const suggestions: string[] = [];

  if (context.trackCount === 0) {
    suggestions.push('import', 'compose', 'record');
  } else if (context.trackCount > 0 && !context.hasEffects) {
    suggestions.push('addEffect', 'analyze');
  }

  if (context.hasMidiClips) {
    suggestions.push('variation', 'reharmonize', 'humanize');
  }

  if (context.hasAudioClips && context.trackCount >= 2) {
    suggestions.push('unmask', 'analyze', 'master');
  }

  if (context.hasMastering) {
    suggestions.push('export', 'abCompare');
  }

  return suggestions;
}

export interface PredictedAction {
  action: string;
  label: string;
  confidence: number;
}

// Human-readable labels
const ACTION_LABELS: Record<string, string> = {
  import: 'Import Audio',
  analyze: 'Analyze Mix',
  addEffect: 'Add Effect',
  compose: 'Generate MIDI',
  master: 'Master',
  export: 'Export',
  record: 'Record',
  variation: 'Generate Variation',
  unmask: 'Auto-Unmask',
  reharmonize: 'Reharmonize',
  humanize: 'Humanize',
  gainStage: 'Gain Stage',
  classify: 'Classify Tracks',
  addEq: 'Add EQ',
  applySuggestion: 'Apply Suggestion',
  abCompare: 'A/B Compare',
  adjustMastering: 'Adjust Mastering',
  revertMastering: 'Revert Mastering',
  clarity: 'Adjust Clarity',
  quantize: 'Quantize',
  interpolate: 'Interpolate',
  addInstrument: 'Add Instrument',
  trim: 'Trim',
  normalize: 'Normalize',
  duplicate: 'Duplicate',
  bypass: 'Bypass Effect',
  tweakParams: 'Tweak Params',
  save: 'Save',
  newTrack: 'New Track',
};

/**
 * Predict next likely actions based on recent action history and session context.
 */
export function predictNextActions(
  recentActions: string[],
  context: SessionContext,
  maxResults: number = 5,
): PredictedAction[] {
  const scores = new Map<string, number>();

  // Score from transition table
  const lastAction = recentActions[0];
  if (lastAction && TRANSITION_TABLE[lastAction]) {
    const transitions = TRANSITION_TABLE[lastAction]!;
    transitions.forEach((action, idx) => {
      const score = (transitions.length - idx) / transitions.length;
      scores.set(action, (scores.get(action) ?? 0) + score);
    });
  }

  // Score from contextual rules
  const contextActions = contextualSuggestions(context);
  for (const action of contextActions) {
    scores.set(action, (scores.get(action) ?? 0) + 0.5);
  }

  // Frequency boost from recent history
  const actionCounts = new Map<string, number>();
  for (const action of recentActions.slice(0, 20)) {
    actionCounts.set(action, (actionCounts.get(action) ?? 0) + 1);
  }
  for (const [action, count] of actionCounts) {
    // Boost actions the user frequently does
    const transitions = TRANSITION_TABLE[action] ?? [];
    for (const next of transitions) {
      scores.set(next, (scores.get(next) ?? 0) + count * 0.1);
    }
  }

  // Don't suggest the action the user just did
  if (lastAction) scores.delete(lastAction);

  // Sort and return top results
  const sorted = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults);

  const maxScore = sorted[0]?.[1] ?? 1;

  return sorted.map(([action, score]) => ({
    action,
    label: ACTION_LABELS[action] ?? action,
    confidence: Math.round((score / maxScore) * 100) / 100,
  }));
}
