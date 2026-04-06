/**
 * Spectral Matrix Panel — NxN grid showing cross-track masking severity.
 * Per-track "Clarity" slider and "Auto-Unmask" button.
 */

import { useAIStore } from '@/stores/ai-store';
import { useSessionStore } from '@/stores/session-store';
import {
  computeUnmaskingPlan,
  applyUnmaskingPlan,
  computeClarityMacro,
  applyClarityMacro,
} from '@/services/ai/unmasking-engine';
import { runAnalysis } from '@/services/ai/suggestion-engine';
import { toast } from '@/stores/toast-store';

function severityColor(severity: number): string {
  if (severity > 0.7) return 'bg-red-600';
  if (severity > 0.5) return 'bg-orange-500';
  if (severity > 0.3) return 'bg-yellow-500';
  return 'bg-green-700';
}

export default function SpectralMatrixPanel() {
  const lastAnalysis = useAIStore((s) => s.lastAnalysis);
  const tracks = useSessionStore((s) => s.tracks);

  const handleAnalyze = () => {
    runAnalysis();
    toast.info('Running spectral analysis...');
  };

  const handleAutoUnmask = () => {
    if (!lastAnalysis) {
      toast.warning('Run analysis first');
      return;
    }
    const plan = computeUnmaskingPlan(lastAnalysis);
    if (plan.actions.length === 0) {
      toast.info('No masking conflicts to resolve');
      return;
    }
    applyUnmaskingPlan(plan);
    toast.success(plan.summary);
  };

  const handleClarityChange = (trackId: string, value: number) => {
    const session = useSessionStore.getState();
    session.updateTrack(trackId, { clarity: value });

    if (lastAnalysis && value > 0) {
      const macro = computeClarityMacro(trackId, value, lastAnalysis);
      applyClarityMacro(macro);
    }
  };

  const maskingPairs = lastAnalysis?.maskingPairs ?? [];

  // Build a lookup: trackId pair -> severity
  const pairSeverity = new Map<string, number>();
  for (const pair of maskingPairs) {
    const key1 = `${pair.trackAId}:${pair.trackBId}`;
    const key2 = `${pair.trackBId}:${pair.trackAId}`;
    pairSeverity.set(key1, pair.severity);
    pairSeverity.set(key2, pair.severity);
  }

  const audioTracks = tracks.filter((t) =>
    t.type === 'audio' && t.clips.length > 0,
  );

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-daw-text">Spectral Matrix</h3>
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            className="px-2 py-1 text-xxs font-mono bg-daw-bg
                       border border-white/10 text-daw-text-muted
                       hover:text-daw-text hover:border-daw-accent/40"
          >
            Analyze
          </button>
          <button
            onClick={handleAutoUnmask}
            className="px-2 py-1 text-xxs font-mono bg-daw-accent/20
                       border border-daw-accent/30 text-daw-accent
                       hover:bg-daw-accent/30"
          >
            Auto-Unmask
          </button>
        </div>
      </div>

      {/* Masking matrix grid */}
      {audioTracks.length > 1 && lastAnalysis && (
        <div className="overflow-auto">
          <div className="inline-block">
            {/* Header row */}
            <div className="flex">
              <div className="w-20 h-6 shrink-0" />
              {audioTracks.map((t) => (
                <div
                  key={`h-${t.id}`}
                  className="w-8 h-6 text-xxs font-mono text-daw-text-muted
                             flex items-center justify-center overflow-hidden"
                  title={t.name}
                >
                  {t.name.slice(0, 3)}
                </div>
              ))}
            </div>
            {/* Data rows */}
            {audioTracks.map((rowTrack) => (
              <div key={`r-${rowTrack.id}`} className="flex">
                <div className="w-20 h-8 shrink-0 text-xxs font-mono
                                text-daw-text-muted flex items-center px-1
                                truncate">
                  {rowTrack.name}
                </div>
                {audioTracks.map((colTrack) => {
                  if (rowTrack.id === colTrack.id) {
                    return (
                      <div
                        key={`c-${colTrack.id}`}
                        className="w-8 h-8 bg-white/5 border border-white/5"
                      />
                    );
                  }
                  const severity = pairSeverity.get(`${rowTrack.id}:${colTrack.id}`) ?? 0;
                  return (
                    <div
                      key={`c-${colTrack.id}`}
                      className={`w-8 h-8 border border-white/5 flex items-center
                                  justify-center text-xxs font-mono text-white/80
                                  ${severity > 0 ? severityColor(severity) : 'bg-transparent'}`}
                      title={`${rowTrack.name} x ${colTrack.name}: ${Math.round(severity * 100)}%`}
                    >
                      {severity > 0 ? Math.round(severity * 100) : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Masking pairs list */}
      {maskingPairs.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xxs font-mono text-daw-text-muted">Conflicts</h4>
          {maskingPairs.slice(0, 5).map((pair, i) => {
            const trackA = tracks.find((t) => t.id === pair.trackAId)?.name ?? '?';
            const trackB = tracks.find((t) => t.id === pair.trackBId)?.name ?? '?';
            return (
              <div
                key={i}
                className="px-2 py-1 bg-white/5 text-xxs font-mono text-daw-text-muted"
              >
                <span className="text-daw-text">{trackA}</span>
                {' vs '}
                <span className="text-daw-text">{trackB}</span>
                {' — '}
                <span className={pair.severity > 0.5 ? 'text-red-400' : 'text-yellow-400'}>
                  {Math.round(pair.severity * 100)}%
                </span>
                {' in '}
                {pair.maskedBands.join(', ')}
              </div>
            );
          })}
        </div>
      )}

      {/* Per-track clarity sliders */}
      <div className="space-y-1">
        <h4 className="text-xxs font-mono text-daw-text-muted">Clarity</h4>
        {audioTracks.map((track) => (
          <div key={track.id} className="flex items-center gap-2">
            <span className="text-xxs font-mono text-daw-text-muted w-16 truncate">
              {track.name}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={track.clarity ?? 0}
              onChange={(e) => handleClarityChange(track.id, parseInt(e.target.value, 10))}
              className="flex-1 h-1 accent-daw-accent"
              aria-label={`Clarity for ${track.name}`}
            />
            <span className="text-xxs font-mono text-daw-text-dim w-8 text-right">
              {track.clarity ?? 0}
            </span>
          </div>
        ))}
      </div>

      {!lastAnalysis && (
        <p className="text-xxs font-mono text-daw-text-muted text-center py-4">
          Click "Analyze" to detect frequency conflicts
        </p>
      )}
    </div>
  );
}
