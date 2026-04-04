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
      <div className="flex items-center justify-between px-3 py-2
                      border-b border-daw-grid/30">
        <span className="text-xs font-semibold text-daw-ai-accent">
          AI CO-PRODUCER
        </span>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`text-[10px] px-2 py-0.5 rounded transition-colors
                     ${enabled
              ? 'bg-daw-ai-suggestion text-white'
              : 'bg-daw-bg text-daw-text-dim'}`}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2">
            <button
              onClick={() => runAnalysis()}
              disabled={analyzing || tracks.length === 0}
              className="daw-button w-full text-xs bg-daw-ai-suggestion/80
                         hover:bg-daw-ai-suggestion disabled:opacity-40"
            >
              {analyzing ? 'Analyzing...' : 'Analyze Mix'}
            </button>
          </div>

          {lastAnalysis && (
            <div className="px-3 py-2 border-b border-daw-grid/20">
              <span className="text-[10px] text-daw-text-dim">
                MIX OVERVIEW
              </span>
              <div className="mt-1 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-daw-text-dim">Peak</span>
                  <span>{lastAnalysis.overallLevel.peak.toFixed(1)} dB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-daw-text-dim">RMS</span>
                  <span>{lastAnalysis.overallLevel.rms.toFixed(1)} dB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-daw-text-dim">Dynamic Range</span>
                  <span>
                    {lastAnalysis.overallLevel.dynamicRange.toFixed(1)} dB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-daw-text-dim">Stereo Width</span>
                  <span>
                    {(lastAnalysis.stereoWidth * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {pendingSuggestions.length > 0 && (
            <div className="px-3 py-2 border-b border-daw-grid/20">
              <span className="text-[10px] text-daw-text-dim">
                SUGGESTIONS ({pendingSuggestions.length})
              </span>
              <div className="mt-2 space-y-2">
                {pendingSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="bg-daw-bg/50 rounded p-2 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-[9px] px-1 rounded font-bold shrink-0
                                   ${s.type === 'clipping'
                            ? 'bg-red-600/30 text-red-400'
                            : s.type === 'level'
                              ? 'bg-yellow-600/30 text-yellow-400'
                              : 'bg-daw-ai-accent/30 text-daw-ai-accent'}`}
                      >
                        {s.type.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{s.title}</div>
                        <div className="text-daw-text-dim mt-0.5">
                          {s.description}
                        </div>
                      </div>
                    </div>
                    {s.action && (
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => acceptSuggestion(s.id)}
                          className="flex-1 text-[10px] py-1 rounded
                                     bg-green-700/40 text-green-300
                                     hover:bg-green-700/60 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => rejectSuggestion(s.id)}
                          className="flex-1 text-[10px] py-1 rounded
                                     bg-red-700/30 text-red-300
                                     hover:bg-red-700/50 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {appliedSuggestions.length > 0 && (
            <div className="px-3 py-2 border-b border-daw-grid/20">
              <span className="text-[10px] text-daw-text-dim">
                AUTO-APPLIED ({appliedSuggestions.length})
              </span>
              <div className="mt-1 space-y-1">
                {appliedSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="text-[11px] text-daw-text-dim flex items-center
                               gap-1"
                  >
                    <span className="text-green-400">&#10003;</span>
                    {s.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activityLog.length > 0 && (
            <div className="px-3 py-2">
              <span className="text-[10px] text-daw-text-dim">
                ACTIVITY LOG
              </span>
              <div className="mt-1 space-y-1">
                {activityLog.slice(0, 20).map((entry) => (
                  <div
                    key={entry.id}
                    className="text-[10px] text-daw-text-dim py-0.5"
                  >
                    {entry.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestions.length === 0 && !lastAnalysis && (
            <div className="px-3 py-8 text-center text-xs text-daw-text-dim">
              Add tracks and click &quot;Analyze Mix&quot; for AI feedback
              on your session.
            </div>
          )}
        </div>
      )}

      {!enabled && (
        <div className="flex-1 flex items-center justify-center
                        text-xs text-daw-text-dim px-4 text-center">
          AI Co-Producer is disabled. Enable it to get real-time mix
          analysis and suggestions.
        </div>
      )}
    </div>
  );
}
