import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { useMixerStore } from '@/stores/mixer-store';
import { analyzeMix, generateSuggestions } from './mix-analyzer';
import { generateId } from '@/utils/id';

export function runAnalysis(): void {
  const aiState = useAIStore.getState();
  if (!aiState.enabled) return;

  const { tracks, config } = useSessionStore.getState();
  if (tracks.length === 0) return;

  aiState.setAnalyzing(true);

  try {
    const analysis = analyzeMix(tracks, config.sampleRate);
    aiState.setAnalysis(analysis);

    const suggestions = generateSuggestions(analysis, tracks);

    aiState.clearSuggestions();

    for (const suggestion of suggestions) {
      if (suggestion.priority === 'auto' && suggestion.confidence > 0.9) {
        applyAction(suggestion.action);
        aiState.logActivity({
          id: generateId('log'),
          description: suggestion.description,
          trackId: suggestion.targetTrackId,
          timestamp: Date.now(),
          undoable: true,
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

  aiState.acceptSuggestion(suggestionId);

  if (suggestion.action) {
    applyAction(suggestion.action);
    aiState.applySuggestion(suggestionId);
    aiState.logActivity({
      id: generateId('log'),
      description: `Applied: ${suggestion.title}`,
      trackId: suggestion.targetTrackId,
      timestamp: Date.now(),
      undoable: true,
    });
  }
}

export function rejectSuggestion(suggestionId: string): void {
  useAIStore.getState().rejectSuggestion(suggestionId);
}

function applyAction(
  action: { type: string; trackId: string; value?: number } | null,
): void {
  if (!action) return;

  const mixer = useMixerStore.getState();

  switch (action.type) {
    case 'setVolume':
      if (action.value !== undefined) {
        mixer.setVolume(action.trackId, action.value);
        useSessionStore.getState().updateTrack(action.trackId, {
          volume: action.value,
        });
      }
      break;
    case 'setPan':
      if (action.value !== undefined) {
        mixer.setPan(action.trackId, action.value);
        useSessionStore.getState().updateTrack(action.trackId, {
          pan: action.value,
        });
      }
      break;
    case 'mute':
      mixer.toggleMute(action.trackId);
      break;
  }
}
