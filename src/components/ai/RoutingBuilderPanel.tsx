/**
 * Routing Builder Panel — shows suggested routing graph
 * (groups, sends, sidechains) and allows one-click application.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { buildRoutingPlan, applyRoutingPlan } from '@/services/ai/routing-builder';
import { runSessionScan } from '@/services/ai/session-scanner';
import type { RoutingPlan, RoutingSuggestion } from '@/types/session-scan';

const TYPE_COLORS: Record<string, string> = {
  group: '#4ade80',
  send: '#818cf8',
  sidechain: '#E63946',
};

const TYPE_ICONS: Record<string, string> = {
  group: 'G',
  send: 'S',
  sidechain: 'SC',
};

export default function RoutingBuilderPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const [plan, setPlan] = useState<RoutingPlan | null>(null);
  const [building, setBuilding] = useState(false);

  const handleBuild = () => {
    if (tracks.length === 0) return;
    setBuilding(true);
    try {
      const scan = runSessionScan();
      const routingPlan = buildRoutingPlan(scan);
      setPlan(routingPlan);
    } finally {
      setBuilding(false);
    }
  };

  const handleApply = () => {
    if (!plan) return;
    applyRoutingPlan(plan);
  };

  const totalSuggestions = plan
    ? plan.groups.length + plan.sends.length + plan.sidechains.length
    : 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleBuild}
        disabled={building || tracks.length === 0}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-[#E63946]/20 text-[#E63946] hover:bg-[#E63946]/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {building ? 'Analyzing...' : 'Build Routing Plan'}
      </button>

      {plan && totalSuggestions > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-daw-text-muted">
              {totalSuggestions} suggestion{totalSuggestions !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleApply}
              className="text-[8px] text-[#E63946] hover:underline font-mono"
            >
              Apply All
            </button>
          </div>

          {/* Groups */}
          {plan.groups.length > 0 && (
            <div>
              <div className="text-[7px] text-daw-text-muted uppercase mb-0.5">Groups</div>
              {plan.groups.map((s, i) => (
                <RoutingRow key={`g-${i}`} suggestion={s} />
              ))}
            </div>
          )}

          {/* Sends */}
          {plan.sends.length > 0 && (
            <div>
              <div className="text-[7px] text-daw-text-muted uppercase mb-0.5">Sends</div>
              {plan.sends.map((s, i) => (
                <RoutingRow key={`s-${i}`} suggestion={s} />
              ))}
            </div>
          )}

          {/* Sidechains */}
          {plan.sidechains.length > 0 && (
            <div>
              <div className="text-[7px] text-daw-text-muted uppercase mb-0.5">Sidechains</div>
              {plan.sidechains.map((s, i) => (
                <RoutingRow key={`sc-${i}`} suggestion={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {plan && totalSuggestions === 0 && (
        <div className="text-[9px] text-daw-text-muted text-center py-2">
          No routing suggestions — add more tracks with different roles.
        </div>
      )}
    </div>
  );
}

function RoutingRow({ suggestion }: { suggestion: RoutingSuggestion }) {
  const tracks = useSessionStore((s) => s.tracks);
  const color = TYPE_COLORS[suggestion.type] ?? '#6b7280';
  const icon = TYPE_ICONS[suggestion.type] ?? '?';
  const sourceNames = suggestion.sourceTrackIds
    .map((id) => tracks.find((t) => t.id === id)?.name ?? id)
    .slice(0, 3)
    .join(', ');

  return (
    <div className="bg-daw-bg/40 p-1 flex items-start gap-1.5 mb-0.5">
      <span
        className="text-[7px] font-mono font-bold px-1 py-0.5 shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-daw-text-dim font-mono">{suggestion.name}</div>
        <div className="text-[8px] text-daw-text-muted">{sourceNames}</div>
        <div className="text-[8px] text-daw-text-muted/70 leading-tight">{suggestion.reason}</div>
      </div>
    </div>
  );
}
