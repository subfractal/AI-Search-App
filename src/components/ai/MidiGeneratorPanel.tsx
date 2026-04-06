/**
 * MIDI Generator Panel — generates drum/bass/arp/chord/melody
 * patterns and adds them to the selected track.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { generateMidiPattern, getAvailablePatterns } from '@/services/ai/midi-generator';
import { generateId } from '@/utils/id';
import type { MidiGeneratorConfig } from '@/types/session-scan';
import type { MidiClip } from '@/types/audio';

export default function MidiGeneratorPanel() {
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const genre = useSessionStore((s) => s.config.genre);

  const [config, setConfig] = useState<MidiGeneratorConfig>({
    pattern: 'drum',
    bars: 4,
    genre,
    complexity: 0.7,
    swing: 0,
    key: 'C',
    scale: 'minor',
    octave: 4,
    velocity: 85,
  });

  const handleGenerate = () => {
    if (!selectedTrackId) return;
    const notes = generateMidiPattern({ ...config, genre });
    const totalDuration = notes.reduce(
      (max, n) => Math.max(max, n.startTime + n.duration),
      0,
    );

    const clip: MidiClip = {
      id: generateId('clip'),
      trackId: selectedTrackId,
      name: `${config.pattern} pattern`,
      notes,
      startTime: 0,
      duration: totalDuration,
    };
    addClipToTrack(selectedTrackId, clip);
  };

  const patterns = getAvailablePatterns();

  return (
    <div className="space-y-2">
      {/* Pattern type */}
      <div className="flex gap-0.5">
        {patterns.map((p) => (
          <button
            key={p}
            onClick={() => setConfig((c) => ({ ...c, pattern: p }))}
            className={`flex-1 text-[8px] py-1 font-bold font-mono uppercase transition-all
                       ${config.pattern === p
              ? 'bg-[#E63946]/25 text-[#E63946] border border-[#E63946]/40'
              : 'daw-hw-btn text-daw-text-muted'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Key & Scale (for non-drum patterns) */}
      {config.pattern !== 'drum' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[8px] text-daw-text-muted">Key</label>
            <select
              value={config.key}
              onChange={(e) => setConfig((c) => ({ ...c, key: e.target.value }))}
              className="w-full text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
            >
              {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[8px] text-daw-text-muted">Scale</label>
            <select
              value={config.scale}
              onChange={(e) => setConfig((c) => ({ ...c, scale: e.target.value as 'major' | 'minor' }))}
              className="w-full text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>
      )}

      {/* Bars & Complexity */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[8px] text-daw-text-muted">Bars: {config.bars}</label>
          <input type="range" min="1" max="16" value={config.bars}
            onChange={(e) => setConfig((c) => ({ ...c, bars: Number(e.target.value) }))}
            className="w-full h-1 accent-[#E63946]" />
        </div>
        <div className="flex-1">
          <label className="text-[8px] text-daw-text-muted">
            Complexity: {Math.round(config.complexity * 100)}%
          </label>
          <input type="range" min="0" max="100" value={Math.round(config.complexity * 100)}
            onChange={(e) => setConfig((c) => ({ ...c, complexity: Number(e.target.value) / 100 }))}
            className="w-full h-1 accent-[#E63946]" />
        </div>
      </div>

      {/* Swing & Velocity */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[8px] text-daw-text-muted">Swing: {Math.round(config.swing * 100)}%</label>
          <input type="range" min="0" max="100" value={Math.round(config.swing * 100)}
            onChange={(e) => setConfig((c) => ({ ...c, swing: Number(e.target.value) / 100 }))}
            className="w-full h-1 accent-[#E63946]" />
        </div>
        <div className="flex-1">
          <label className="text-[8px] text-daw-text-muted">Velocity: {config.velocity}</label>
          <input type="range" min="20" max="127" value={config.velocity}
            onChange={(e) => setConfig((c) => ({ ...c, velocity: Number(e.target.value) }))}
            className="w-full h-1 accent-[#E63946]" />
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!selectedTrackId}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-[#E63946]/20 text-[#E63946] hover:bg-[#E63946]/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {selectedTrackId ? 'Generate Pattern' : 'Select a Track First'}
      </button>
    </div>
  );
}
