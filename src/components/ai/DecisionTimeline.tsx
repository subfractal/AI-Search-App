/**
 * Decision Timeline — chronological view of all AI decisions
 * with per-decision toggle, revert, and parameter tweaking.
 */

import { useAIStore } from '@/stores/ai-store';
import { useSessionStore } from '@/stores/session-store';
import { explainDecision } from '@/services/ai/explanation-engine';
import WhyTooltip from './WhyTooltip';
import type { MasteringDecision } from '@/types/ai';

function DecisionCard({ decision }: { decision: MasteringDecision }) {
  const toggleDecision = useAIStore((s) => s.toggleMasteringDecision);
  const removeDecision = useAIStore((s) => s.removeMasteringDecision);
  const trackName = useSessionStore((s) =>
    s.tracks.find((t) => t.id === decision.trackId)?.name ?? 'Unknown',
  );

  const explanation = explainDecision(decision);

  return (
    <WhyTooltip
      explanation={explanation}
      onRevert={() => removeDecision(decision.id)}
    >
      <div
        className={`px-2 py-1.5 border-l-2 ${
          decision.enabled
            ? 'border-l-daw-accent bg-white/5'
            : 'border-l-white/10 bg-transparent opacity-50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xxs font-mono text-daw-text truncate">
              {decision.description}
            </div>
            <div className="text-xxs font-mono text-daw-text-muted">
              {trackName} — {decision.stage}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => toggleDecision(decision.id)}
              className={`w-6 h-5 text-xxs font-mono border ${
                decision.enabled
                  ? 'bg-daw-accent/20 border-daw-accent/40 text-daw-accent'
                  : 'bg-daw-bg border-white/10 text-daw-text-muted'
              }`}
              aria-label={decision.enabled ? 'Disable decision' : 'Enable decision'}
              title={decision.enabled ? 'Active' : 'Bypassed'}
            >
              {decision.enabled ? 'ON' : '--'}
            </button>
            <button
              onClick={() => removeDecision(decision.id)}
              className="w-5 h-5 text-xxs font-mono bg-daw-bg
                         border border-white/10 text-red-400
                         hover:bg-red-600/20"
              aria-label="Remove decision"
              title="Remove"
            >
              x
            </button>
          </div>
        </div>

        {/* Parameter values */}
        {Object.keys(decision.params).length > 0 && decision.enabled && (
          <div className="flex gap-2 mt-1">
            {Object.entries(decision.params).slice(0, 4).map(([key, val]) => (
              <span
                key={key}
                className="text-xxs font-mono text-daw-text-dim"
                title={key}
              >
                {key}: {typeof val === 'number' ? val.toFixed(1) : val}
              </span>
            ))}
          </div>
        )}
      </div>
    </WhyTooltip>
  );
}

export default function DecisionTimeline() {
  const decisions = useAIStore((s) => s.masteringDecisions);
  const revertMastering = useAIStore((s) => s.revertMastering);

  if (decisions.length === 0) {
    return (
      <div className="p-3 text-xxs font-mono text-daw-text-muted text-center">
        No AI decisions yet. Run mastering or analysis to see decisions here.
      </div>
    );
  }

  // Group by stage
  const stages = new Map<string, MasteringDecision[]>();
  for (const d of decisions) {
    const group = stages.get(d.stage) ?? [];
    group.push(d);
    stages.set(d.stage, group);
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-daw-text">AI Decisions</h3>
        <div className="flex gap-2">
          <span className="text-xxs font-mono text-daw-text-muted">
            {decisions.length} decisions
          </span>
          <button
            onClick={revertMastering}
            className="px-2 py-0.5 text-xxs font-mono bg-red-600/10
                       border border-red-500/20 text-red-400
                       hover:bg-red-600/20"
          >
            Revert All
          </button>
        </div>
      </div>

      {[...stages.entries()].map(([stage, stageDecisions]) => (
        <div key={stage}>
          <h4 className="text-xxs font-mono text-daw-text-dim mb-1 uppercase">
            {stage}
          </h4>
          <div className="space-y-1">
            {stageDecisions.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
