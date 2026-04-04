import { useWarpStore } from '@/stores/warp-store';
import { useTransportStore } from '@/stores/transport-store';
import { analyzeAndAutoWarp } from '@/services/warp-service';
import type { WarpMode } from '@/types/warp';
import { WARP_MODES } from '@/types/warp';

interface WarpPanelProps {
  clipId: string;
  trackId: string;
  buffer: AudioBuffer;
}

export default function WarpPanel({
  clipId,
  trackId: _trackId,
  buffer,
}: WarpPanelProps) {
  const config = useWarpStore((s) => s.configs[clipId]);
  const initWarpConfig = useWarpStore((s) => s.initWarpConfig);
  const setEnabled = useWarpStore((s) => s.setEnabled);
  const setMode = useWarpStore((s) => s.setMode);
  const setOriginalBpm = useWarpStore((s) => s.setOriginalBpm);
  const autoWarpAction = useWarpStore((s) => s.autoWarp);
  const clearMarkers = useWarpStore((s) => s.clearMarkers);
  const removeMarker = useWarpStore((s) => s.removeMarker);
  const sessionBpm = useTransportStore((s) => s.bpm);

  if (!config) {
    return (
      <div className="p-3">
        <button
          onClick={() => initWarpConfig(clipId)}
          className="daw-button text-xxs w-full"
        >
          Enable Warp
        </button>
      </div>
    );
  }

  const handleAutoWarp = () => {
    const result = analyzeAndAutoWarp(clipId, buffer, sessionBpm);
    const beats = result.markers.map((m) => m.sourceTime);
    autoWarpAction(
      clipId,
      result.originalBpm,
      beats,
      sessionBpm,
    );
  };

  const ratio =
    config.originalBpm > 0 ? sessionBpm / config.originalBpm : 1;

  const enabledClass = config.enabled
    ? 'bg-daw-accent/20 text-daw-accent'
    : 'bg-daw-bg text-daw-text-muted';

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="daw-section-label">Warp</span>
        <button
          onClick={() => setEnabled(clipId, !config.enabled)}
          className={
            'text-xxs px-1.5 py-0.5 rounded transition-all '
            + enabledClass
          }
        >
          {config.enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {config.enabled && (
        <>
          {/* BPM */}
          <div className="flex items-center gap-2">
            <span className="text-xxs text-daw-text-muted w-14">
              Orig BPM
            </span>
            <input
              type="number"
              value={config.originalBpm.toFixed(1)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (v > 0) setOriginalBpm(clipId, v);
              }}
              className="daw-input w-16 text-center text-xxs"
            />
            <span className="text-xxs text-daw-text-muted">
              &rarr; {sessionBpm} ({ratio.toFixed(2)}x)
            </span>
          </div>

          {/* Mode */}
          <div className="flex gap-0.5">
            {WARP_MODES.map((m) => {
              const active = config.mode === m.value;
              const cls = active
                ? 'bg-daw-accent/20 text-daw-accent '
                  + 'border border-daw-accent/30'
                : 'bg-daw-bg text-daw-text-muted '
                  + 'border border-transparent '
                  + 'hover:text-daw-text-dim';
              return (
                <button
                  key={m.value}
                  onClick={() => setMode(clipId, m.value as WarpMode)}
                  className={
                    'flex-1 text-xxs py-1 rounded transition-all '
                    + cls
                  }
                  title={m.description}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Auto-warp button */}
          <button
            onClick={handleAutoWarp}
            className="daw-button text-xxs w-full"
          >
            Auto-Warp to {sessionBpm} BPM
          </button>

          {/* Markers */}
          {config.markers.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xxs text-daw-text-muted">
                  {config.markers.length} markers
                </span>
                <button
                  onClick={() => clearMarkers(clipId)}
                  className="text-xxs text-red-400/60
                             hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-px">
                {config.markers.slice(0, 20).map((mk) => (
                  <div
                    key={mk.id}
                    className="flex items-center justify-between
                               text-xxs bg-daw-bg/40 rounded
                               px-1.5 py-0.5"
                  >
                    <span className="text-daw-text-muted font-mono">
                      {mk.sourceTime.toFixed(3)}s
                      &rarr; {mk.targetTime.toFixed(3)}s
                    </span>
                    <button
                      onClick={() => removeMarker(clipId, mk.id)}
                      className="text-daw-text-muted
                                 hover:text-red-400 ml-1"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {config.autoWarped && (
            <span className="text-xxs text-green-500/60">
              Auto-warped from {config.originalBpm.toFixed(1)}
              {' '}to {sessionBpm} BPM
            </span>
          )}
        </>
      )}
    </div>
  );
}
