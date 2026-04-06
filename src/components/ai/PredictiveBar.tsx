import { useState, useEffect } from 'react';
import { useUIContextStore } from '@/stores/ui-context-store';
import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { useEffectsStore } from '@/stores/effects-store';
import { predictNextActions } from '@/services/ai/predictive-tools';
import type { PredictedAction } from '@/services/ai/predictive-tools';
import { toast } from '@/stores/toast-store';

function buildContext() {
  const session = useSessionStore.getState();
  const effects = useEffectsStore.getState();
  const ai = useAIStore.getState();

  return {
    hasSelectedTrack: !!session.selectedTrackId,
    hasMidiClips: session.tracks.some((t) => t.clips.some((c) => 'notes' in c)),
    hasAudioClips: session.tracks.some((t) => t.clips.some((c) => 'buffer' in c)),
    trackCount: session.tracks.length,
    hasMastering: !!ai.masteringResult,
    hasEffects: Object.keys(effects.trackEffects).length > 0,
  };
}

export default function PredictiveBar() {
  const actionHistory = useUIContextStore((s) => s.actionHistory);
  const skillLevel = useUIContextStore((s) => s.skillLevel);
  const [predictions, setPredictions] = useState<PredictedAction[]>([]);

  useEffect(() => {
    const recentActions = actionHistory.slice(0, 20).map((a) => a.action);
    const context = buildContext();
    const predicted = predictNextActions(recentActions, context, 4);
    setPredictions(predicted);
  }, [actionHistory, skillLevel]);

  if (predictions.length === 0) return null;

  const handleClick = (action: string) => {
    useUIContextStore.getState().recordAction(action);
    toast.info(`Action: ${action}`);
    // Future: wire to actual execution
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <span className="text-xxs font-mono text-daw-text-dim mr-1">Next:</span>
      {predictions.map((p) => (
        <button
          key={p.action}
          onClick={() => handleClick(p.action)}
          className="px-2 py-0.5 text-xxs font-mono bg-daw-bg
                     border border-white/10 text-daw-text-muted
                     hover:text-daw-text hover:border-daw-accent/30
                     transition-colors"
          title={`${p.label} (${Math.round(p.confidence * 100)}% likely)`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
