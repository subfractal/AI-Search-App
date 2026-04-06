/**
 * Phase Align Panel — visualizes and applies inter-track phase alignment.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import {
  analyzePhaseAlignment,
  applyPhaseAlignment,
} from '@/services/ai/phase-align';
import type {
  AlignMode,
  PhaseAlignReport,
  PhaseAlignResult,
} from '@/services/ai/phase-align';

const MODES: { value: AlignMode; label: string; description: string }[] = [
  {
    value: 'preserve-transients',
    label: 'Transients',
    description: 'Preserves attack timing',
  },
  {
    value: 'maximize-low-end',
    label: 'Low-End',
    description: 'Optimizes bass correlation',
  },
  {
    value: 'natural-feel',
    label: 'Natural',
    description: 'Balanced alignment',
  },
];

export default function PhaseAlignPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const [report, setReport] = useState<PhaseAlignReport | null>(null);
  const [mode, setMode] = useState<AlignMode>('natural-feel');
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (tracks.length < 2) return;
    setAnalyzing(true);
    try {
      const result = analyzePhaseAlignment(mode);
      setReport(result);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = (pair: PhaseAlignResult) => {
    applyPhaseAlignment(pair);
    // Re-analyze to show updated correlation
    const updated = analyzePhaseAlignment(mode);
    setReport(updated);
  };

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={`flex-1 text-[8px] py-1 font-mono uppercase transition-all ${
              mode === m.value
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim'
            }`}
            title={m.description}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={analyzing || tracks.length < 2}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {analyzing ? 'Analyzing...' : 'Analyze Phase'}
      </button>

      {report && report.pairs.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {report.pairs.map((pair, i) => (
            <div key={i} className="bg-daw-bg/60 p-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-daw-text-dim font-mono truncate">
                  {pair.trackAName} vs {pair.trackBName}
                </span>
                <span
                  className={`text-[8px] font-mono ${
                    pair.correlation > 0.8
                      ? 'text-green-400'
                      : pair.correlation > 0.3
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}
                >
                  r={pair.correlation.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="text-[7px] text-daw-text-muted">
                  {pair.delaySamples !== 0 && (
                    <span>
                      Delay: {pair.delayMs.toFixed(1)}ms ({pair.delaySamples}{' '}
                      smp)
                    </span>
                  )}
                  {pair.polarityFlip && (
                    <span className="text-red-400 ml-1">
                      Polarity flip needed
                    </span>
                  )}
                  {pair.delaySamples === 0 && !pair.polarityFlip && (
                    <span className="text-green-400">Aligned</span>
                  )}
                </div>
                {(pair.delaySamples !== 0 || pair.polarityFlip) && (
                  <button
                    onClick={() => handleApply(pair)}
                    className="text-[7px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400
                               hover:bg-cyan-500/30 font-mono uppercase"
                  >
                    Align
                  </button>
                )}
              </div>
              {/* Before/After correlation bar */}
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[6px] text-daw-text-muted w-8">
                  Before
                </span>
                <div className="flex-1 h-1 bg-daw-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400/50"
                    style={{
                      width: `${Math.max(0, pair.beforeCorrelation * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[6px] text-daw-text-muted w-8">
                  After
                </span>
                <div className="flex-1 h-1 bg-daw-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400/50"
                    style={{
                      width: `${Math.max(0, pair.afterCorrelation * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {report && report.pairs.length === 0 && (
        <div className="text-[9px] text-daw-text-muted text-center py-2 font-mono">
          No track pairs to analyze
        </div>
      )}
    </div>
  );
}
