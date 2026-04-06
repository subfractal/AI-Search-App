/**
 * Reference Match Panel — compare your mix to a reference track
 * and get explainable deltas with specific suggestions.
 */

import { useState, useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { matchReference } from '@/services/ai/reference-matcher';
import { isAudioClip } from '@/types/audio';
import type { ReferenceMatchResult, ReferenceDelta } from '@/types/session-scan';

const SEVERITY_COLORS: Record<string, string> = {
  low: '#4ade80',
  medium: '#facc15',
  high: '#E63946',
};

const CATEGORY_ICONS: Record<string, string> = {
  loudness: 'L',
  tonal: 'T',
  dynamics: 'D',
  stereo: 'S',
  spectral: '~',
};

export default function ReferenceMatchPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const [result, setResult] = useState<ReferenceMatchResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('audio/')) return;

    setAnalyzing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const referenceBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioContext.close();

      // Get first audio clip from session as the "mix"
      const mixClip = tracks
        .flatMap((t) => t.clips)
        .find(isAudioClip);

      if (!mixClip) return;

      const matchResult = matchReference(mixClip.buffer, referenceBuffer);
      setResult(matchResult);
    } catch {
      // Failed to decode reference
    } finally {
      setAnalyzing(false);
    }
  }, [tracks]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="space-y-2">
      {/* Drop zone for reference */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border border-dashed border-daw-border/40 p-3 text-center cursor-pointer
                   hover:border-[#E63946]/40 transition-colors"
      >
        <span className="text-[9px] text-daw-text-muted">
          {analyzing ? 'Analyzing...' : 'Drop reference audio here'}
        </span>
      </div>

      {result && (
        <div className="space-y-2">
          {/* Overall similarity */}
          <div className="bg-daw-bg/60 p-1.5 flex items-center gap-2">
            <span className="text-[8px] text-daw-text-muted uppercase">Match</span>
            <div className="flex-1 h-2 bg-daw-bg/80 overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${result.overallSimilarity}%`,
                  backgroundColor: result.overallSimilarity > 70 ? '#4ade80'
                    : result.overallSimilarity > 40 ? '#facc15' : '#E63946',
                }}
              />
            </div>
            <span className="text-xs font-mono text-daw-text-dim">
              {result.overallSimilarity}%
            </span>
          </div>

          {/* Deltas */}
          <div className="space-y-0.5">
            {result.deltas.map((d, i) => (
              <DeltaRow key={i} delta={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaRow({ delta }: { delta: ReferenceDelta }) {
  const color = SEVERITY_COLORS[delta.severity] ?? '#6b7280';
  const icon = CATEGORY_ICONS[delta.category] ?? '?';

  return (
    <div className="bg-daw-bg/40 p-1 flex items-start gap-1.5">
      <span
        className="text-[8px] font-mono font-bold w-4 h-4 flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-daw-text-dim truncate">{delta.parameter}</span>
          <span className="text-[8px] font-mono shrink-0" style={{ color }}>
            {delta.delta > 0 ? '+' : ''}{delta.delta}{delta.unit}
          </span>
        </div>
        <div className="text-[8px] text-daw-text-muted leading-tight">{delta.suggestion}</div>
      </div>
    </div>
  );
}
