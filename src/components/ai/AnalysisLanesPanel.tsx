/**
 * Analysis Lanes Panel — toggles and configures timeline analysis overlays.
 */

import { useAIStore } from '@/stores/ai-store';

const LANE_TYPES = [
  { value: 'energy' as const, label: 'Energy', color: 'text-green-400' },
  { value: 'density' as const, label: 'Density', color: 'text-blue-400' },
  { value: 'low-end' as const, label: 'Low-End', color: 'text-orange-400' },
  { value: 'masking' as const, label: 'Masking', color: 'text-red-400' },
];

export default function AnalysisLanesPanel() {
  const enabled = useAIStore((s) => s.analysisLanesEnabled);
  const laneType = useAIStore((s) => s.analysisLaneType);
  const setEnabled = useAIStore((s) => s.setAnalysisLanesEnabled);
  const setType = useAIStore((s) => s.setAnalysisLaneType);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-daw-text-dim font-mono uppercase">Timeline Lanes</span>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`text-[8px] px-2 py-0.5 font-mono uppercase transition-all ${
            enabled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim'
          }`}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled && (
        <div className="flex gap-1">
          {LANE_TYPES.map((lt) => (
            <button
              key={lt.value}
              onClick={() => setType(lt.value)}
              className={`flex-1 text-[7px] py-0.5 font-mono uppercase transition-all ${
                laneType === lt.value
                  ? `bg-daw-panel ${lt.color}`
                  : 'bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim'
              }`}
            >
              {lt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
