import { useAIStore } from '@/stores/ai-store';
import { useSessionStore } from '@/stores/session-store';
import {
  runAnalysis,
  acceptSuggestion,
  rejectSuggestion,
} from '@/services/ai/suggestion-engine';

export default function AISidebar() {
  const enabled = useAIStore((s) => s.enabled);
  const setEnabled = useAIStore((s) => s.setEnabled);
  const suggestions = useAIStore((s) => s.suggestions);
  const activityLog = useAIStore((s) => s.activityLog);
  const analyzing = useAIStore((s) => s.analyzing);
  const lastAnalysis = useAIStore((s) => s.lastAnalysis);
  const tracks = useSessionStore((s) => s.tracks);

  const pendingSuggestions = suggestions.filter(
    (s) => s.status === 'pending',
  );
  const appliedSuggestions = suggestions.filter(
    (s) => s.status === 'applied',
  );

  return (
    <div className="h-full flex flex-col bg-daw-ai-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 h-7 shrink-0
                      border-b border-daw-border/20">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-daw-ai-accent
                          shadow-[0_0_4px_rgba(167,139,250,0.4)]" />
          <span className="daw-section-label text-daw-ai-accent">
            Co-Producer
          </span>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`text-xxs px-1.5 py-px rounded transition-all
                     ${enabled
              ? 'bg-daw-ai-accent/20 text-daw-ai-accent'
              : 'bg-daw-bg text-daw-text-muted'}`}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled && (
        <div className="flex-1 overflow-y-auto">
          {/* Analyze button */}
          <div className="px-2.5 py-2">
            <button
              onClick={() => runAnalysis()}
              disabled={analyzing || tracks.length === 0}
              className="w-full text-xxs py-1.5 rounded font-medium
                         transition-all
                         bg-daw-ai-suggestion/70 text-white
                         hover:bg-daw-ai-suggestion
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {analyzing ? 'Analyzing...' : 'Analyze Mix'}
            </button>
          </div>

          {/* Mix overview */}
          {lastAnalysis && (
            <div className="px-2.5 py-2 border-b border-daw-border/10">
              <span className="daw-section-label">Mix Overview</span>
              <div className="mt-1.5 space-y-1">
                <StatRow
                  label="Peak"
                  value={`${lastAnalysis.overallLevel.peak.toFixed(1)} dB`}
                  warn={lastAnalysis.overallLevel.clipping}
                />
                <StatRow
                  label="RMS"
                  value={`${lastAnalysis.overallLevel.rms.toFixed(1)} dB`}
                />
                <StatRow
                  label="DR"
                  value={`${lastAnalysis.overallLevel.dynamicRange.toFixed(1)} dB`}
                />
                <StatRow
                  label="Width"
                  value={`${(lastAnalysis.stereoWidth * 100).toFixed(0)}%`}
                />
              </div>
            </div>
          )}

          {/* Suggestions */}
          {pendingSuggestions.length > 0 && (
            <div className="px-2.5 py-2 border-b border-daw-border/10">
              <span className="daw-section-label">
                Suggestions ({pendingSuggestions.length})
              </span>
              <div className="mt-2 space-y-1.5">
                {pendingSuggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onAccept={() => acceptSuggestion(s.id)}
                    onReject={() => rejectSuggestion(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Auto-applied */}
          {appliedSuggestions.length > 0 && (
            <div className="px-2.5 py-2 border-b border-daw-border/10">
              <span className="daw-section-label">
                Auto-Applied ({appliedSuggestions.length})
              </span>
              <div className="mt-1 space-y-0.5">
                {appliedSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="text-xxs text-daw-text-muted flex items-center
                               gap-1 py-0.5"
                  >
                    <span className="text-green-500 text-[8px]">&#10003;</span>
                    <span className="truncate">{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity log */}
          {activityLog.length > 0 && (
            <div className="px-2.5 py-2">
              <span className="daw-section-label">Activity</span>
              <div className="mt-1 space-y-0.5">
                {activityLog.slice(0, 15).map((entry) => (
                  <div
                    key={entry.id}
                    className="text-xxs text-daw-text-muted/70 py-0.5
                               leading-tight"
                  >
                    {entry.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {suggestions.length === 0 && !lastAnalysis && (
            <div className="px-4 py-12 text-center">
              <div className="text-daw-ai-accent/30 text-2xl mb-2">
                &#9834;
              </div>
              <span className="text-xxs text-daw-text-muted">
                Add tracks and analyze your mix for AI feedback
              </span>
            </div>
          )}
        </div>
      )}

      {!enabled && (
        <div className="flex-1 flex items-center justify-center px-4">
          <span className="text-xxs text-daw-text-muted text-center
                           leading-relaxed">
            AI Co-Producer is paused.
            <br />
            Enable to get mix analysis and suggestions.
          </span>
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between text-xxs">
      <span className="text-daw-text-muted">{label}</span>
      <span className={warn ? 'text-red-400' : 'text-daw-text-dim'}>
        {value}
      </span>
    </div>
  );
}

function describeAction(action: Record<string, unknown> | null): string | null {
  if (!action) return null;
  const a = action as { type: string; value?: number; effectType?: string; actions?: unknown[] };
  switch (a.type) {
    case 'setVolume': return `Set volume to ${a.value?.toFixed(1)} dB`;
    case 'setPan': return `Pan to ${(a.value ?? 0) < 0 ? 'L' : 'R'} ${Math.abs(a.value ?? 0).toFixed(1)}`;
    case 'mute': return 'Mute track';
    case 'unmute': return 'Unmute track';
    case 'addEffect': return `Add ${a.effectType ?? 'effect'}`;
    case 'batch': return `Apply ${a.actions?.length ?? 0} changes`;
    default: return null;
  }
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: { type: string; title: string; description: string; confidence: number; action: object | null };
  onAccept: () => void;
  onReject: () => void;
}) {
  const typeColors: Record<string, string> = {
    clipping: 'bg-red-500/15 text-red-400',
    level: 'bg-amber-500/15 text-amber-400',
    eq: 'bg-sky-500/15 text-sky-400',
    pan: 'bg-emerald-500/15 text-emerald-400',
    compression: 'bg-violet-500/15 text-violet-400',
    noise: 'bg-orange-500/15 text-orange-400',
  };
  const colorClass = typeColors[suggestion.type]
    ?? 'bg-daw-ai-accent/15 text-daw-ai-accent';

  const actionLabel = describeAction(suggestion.action as Record<string, unknown> | null);

  return (
    <div className="bg-daw-bg/40 rounded p-2 border border-daw-border/10">
      <div className="flex items-start gap-1.5">
        <span className={`text-[8px] px-1 py-px rounded font-semibold
                         shrink-0 uppercase ${colorClass}`}>
          {suggestion.type}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xxs font-medium text-daw-text leading-tight">
            {suggestion.title}
          </div>
          <div className="text-xxs text-daw-text-muted mt-0.5 leading-tight">
            {suggestion.description}
          </div>
          {/* Action preview */}
          {actionLabel && (
            <div className="text-xxs text-daw-ai-accent/70 mt-1 flex items-center gap-1">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <path d="M1 4h6M5 2l2 2-2 2" />
              </svg>
              <span className="italic">{actionLabel}</span>
            </div>
          )}
          {/* Confidence */}
          <div className="flex items-center gap-1 mt-1">
            <div className="flex-1 h-0.5 bg-daw-border/20 rounded overflow-hidden">
              <div
                className="h-full bg-daw-ai-accent/40 rounded"
                style={{ width: `${suggestion.confidence * 100}%` }}
              />
            </div>
            <span className="text-[8px] text-daw-text-muted/50">
              {Math.round(suggestion.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 mt-1.5">
        {suggestion.action ? (
          <button
            onClick={onAccept}
            className="flex-1 text-xxs py-0.5 rounded font-medium
                       bg-green-600/20 text-green-400
                       hover:bg-green-600/30 transition-colors"
          >
            Apply Fix
          </button>
        ) : (
          <button
            onClick={onReject}
            className="flex-1 text-xxs py-0.5 rounded font-medium
                       bg-daw-ai-accent/10 text-daw-ai-accent/70
                       hover:bg-daw-ai-accent/20 transition-colors"
          >
            Noted
          </button>
        )}
        <button
          onClick={onReject}
          className="flex-1 text-xxs py-0.5 rounded font-medium
                     bg-daw-bg/60 text-daw-text-muted
                     hover:text-daw-text-dim transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
