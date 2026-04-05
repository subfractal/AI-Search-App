/**
 * Stem Split Panel — splits selected audio track into
 * vocals/drums/bass/other stems via frequency-band isolation.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { separateStems } from '@/services/ai/stem-separator';
import { generateId } from '@/utils/id';
import { isAudioClip } from '@/types/audio';
import type { StemResult } from '@/types/session-scan';

const STEM_COLORS: Record<string, string> = {
  vocals: '#4ade80',
  drums: '#E63946',
  bass: '#F77F00',
  other: '#818cf8',
};

export default function StemSplitPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const addAudioTrack = useSessionStore((s) => s.addAudioTrack);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const [result, setResult] = useState<StemResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const audioClip = selectedTrack?.clips.find(isAudioClip);

  const handleSplit = () => {
    if (!selectedTrackId || !audioClip) return;
    setProcessing(true);
    try {
      const stemResult = separateStems(audioClip.buffer, selectedTrackId);
      setResult(stemResult);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateTracks = () => {
    if (!result) return;
    for (const stem of result.stems) {
      const trackId = addAudioTrack(`${selectedTrack?.name ?? 'Stem'} — ${stem.name}`);
      updateTrack(trackId, { color: STEM_COLORS[stem.type] ?? '#53c0f0' });
      addClipToTrack(trackId, {
        id: generateId('clip'),
        trackId,
        name: stem.name,
        buffer: stem.buffer,
        startTime: audioClip?.startTime ?? 0,
        duration: stem.buffer.duration,
        offset: 0,
      });
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleSplit}
        disabled={processing || !audioClip}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-[#E63946]/20 text-[#E63946] hover:bg-[#E63946]/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {processing ? 'Splitting...' : audioClip ? 'Split to Stems' : 'Select Audio Track'}
      </button>

      {result && (
        <div className="space-y-1.5">
          <div className="text-[8px] text-daw-text-muted">
            {result.stems.length} stems extracted
          </div>

          {result.stems.map((stem) => (
            <div key={stem.type} className="flex items-center gap-2 bg-daw-bg/40 p-1">
              <div
                className="w-2 h-2 shrink-0"
                style={{ backgroundColor: STEM_COLORS[stem.type] ?? '#53c0f0' }}
              />
              <span className="text-[9px] text-daw-text-dim font-mono flex-1">{stem.name}</span>
              <span className="text-[8px] text-daw-text-muted">
                {stem.buffer.duration.toFixed(1)}s
              </span>
            </div>
          ))}

          <button
            onClick={handleCreateTracks}
            className="w-full text-xxs py-1 font-medium
                       bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30 transition-all"
          >
            Create Stem Tracks
          </button>
        </div>
      )}
    </div>
  );
}
