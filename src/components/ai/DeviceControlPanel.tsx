/**
 * AI Device Control Panel — AI-driven parameter optimization
 * with explanations.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import {
  runDeviceOptimization,
  revertDeviceChanges,
} from '@/services/ai/device-control';
import type {
  DeviceControlResult,
  DeviceParameterDelta,
} from '@/services/ai/device-control';

export default function DeviceControlPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const [result, setResult] = useState<DeviceControlResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleOptimize = () => {
    setRunning(true);
    try {
      const r = runDeviceOptimization();
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  const handleRevert = () => {
    if (revertDeviceChanges()) {
      setResult(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          onClick={handleOptimize}
          disabled={running || tracks.length === 0}
          className="flex-1 text-xxs py-1.5 font-bold font-mono uppercase
                     tracking-wider bg-purple-500/20 text-purple-400
                     hover:bg-purple-500/30 disabled:opacity-30
                     disabled:cursor-not-allowed transition-all"
        >
          {running ? 'Optimizing...' : 'Optimize Devices'}
        </button>
        {result && result.deltas.length > 0 && (
          <button
            onClick={handleRevert}
            className="text-xxs py-1.5 px-2 font-mono uppercase
                       bg-red-500/20 text-red-400 hover:bg-red-500/30"
          >
            Revert
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-1">
          <div className="text-[9px] text-daw-text-dim font-mono px-1">
            {result.explanation}
          </div>

          {result.deltas.length === 0 ? (
            <div
              className="text-[9px] text-green-400/70 text-center
                         py-2 font-mono"
            >
              All devices optimally configured
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {result.deltas.map((delta, i) => (
                <DeltaRow key={i} delta={delta} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeltaRow({ delta }: { delta: DeviceParameterDelta }) {
  return (
    <div className="bg-daw-bg/60 p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[8px] text-daw-text-dim font-mono truncate">
          {delta.trackName} / {delta.effectType}
        </span>
        <span className="text-[8px] font-mono text-purple-400">
          {delta.paramName}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[7px] text-red-400/70 font-mono">
          {typeof delta.before === 'number'
            ? delta.before.toFixed(2)
            : delta.before}
        </span>
        <span className="text-[7px] text-daw-text-muted">&rarr;</span>
        <span className="text-[7px] text-green-400/70 font-mono">
          {typeof delta.after === 'number'
            ? delta.after.toFixed(2)
            : delta.after}
        </span>
      </div>
      <div className="text-[7px] text-daw-text-muted mt-0.5">
        {delta.reason}
      </div>
    </div>
  );
}
