/**
 * AI Sample Synthesis Panel — text-to-audio sample generation.
 * Scaffold UI with procedural synthesis backend.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { synthesizeSample } from '@/services/ai/sample-synthesis';
import { generateId } from '@/utils/id';
import type { SynthesisRequest } from '@/services/ai/sample-synthesis';
import type { MixGenre } from '@/types/ai';
import type { AudioClip } from '@/types/audio';

const MOODS = ['bright', 'dark', 'neutral', 'aggressive', 'warm'] as const;
const GENRES: MixGenre[] = ['pop', 'edm', 'rock', 'hip-hop', 'jazz', 'classical', 'general'];

export default function SampleSynthesisPanel() {
  const addAudioTrack = useSessionStore((s) => s.addAudioTrack);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const initStrip = useMixerStore((s) => s.initStrip);

  const [description, setDescription] = useState('');
  const [mood, setMood] = useState<SynthesisRequest['mood']>('neutral');
  const [genre, setGenre] = useState<MixGenre>('general');
  const [brightness, setBrightness] = useState(0.5);
  const [length, setLength] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');

  const handleGenerate = () => {
    if (!description.trim()) return;
    setGenerating(true);
    setStatus('Synthesizing...');

    // Defer to next tick so UI updates
    setTimeout(() => {
      try {
        const result = synthesizeSample({
          description: description.trim(),
          genre,
          mood,
          lengthSeconds: length,
          brightness,
          sampleRate: 44100,
        });

        // Create a new track with the synthesized audio
        const trackName = `Synth: ${description.trim().slice(0, 20)}`;
        const trackId = addAudioTrack(trackName);
        initStrip(trackId);

        const clip: AudioClip = {
          id: generateId('clip'),
          trackId,
          name: trackName,
          buffer: result.buffer,
          startTime: 0,
          duration: result.durationSeconds,
          offset: 0,
        };

        addClipToTrack(trackId, clip);
        setStatus(`Generated: ${result.description}`);
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setGenerating(false);
      }
    }, 50);
  };

  return (
    <div className="space-y-2">
      {/* Description input */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
        placeholder="Describe a sound... (e.g. 'warm kick drum')"
        className="w-full bg-daw-bg/60 text-daw-text text-[9px] font-mono
                   px-2 py-1.5 outline-none placeholder:text-daw-text-muted
                   border border-transparent focus:border-indigo-500/30"
      />

      {/* Mood selector */}
      <div className="flex gap-0.5">
        {MOODS.map((m) => (
          <button
            key={m}
            onClick={() => setMood(m)}
            className={`flex-1 text-[7px] py-0.5 font-mono uppercase transition-all ${
              mood === m
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <div className="text-[7px] text-daw-text-muted font-mono mb-0.5">
            Brightness: {brightness.toFixed(1)}
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={brightness}
            onChange={(e) => setBrightness(parseFloat(e.target.value))}
            className="w-full h-1 accent-indigo-500"
          />
        </div>
        <div className="flex-1">
          <div className="text-[7px] text-daw-text-muted font-mono mb-0.5">
            Length: {length}s
          </div>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={length}
            onChange={(e) => setLength(parseFloat(e.target.value))}
            className="w-full h-1 accent-indigo-500"
          />
        </div>
      </div>

      {/* Genre */}
      <select
        value={genre}
        onChange={(e) => setGenre(e.target.value as MixGenre)}
        className="w-full bg-daw-bg/60 text-daw-text-dim text-[8px] font-mono
                   py-1 px-1.5 outline-none border-none"
      >
        {GENRES.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !description.trim()}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {generating ? 'Generating...' : 'Generate Sample'}
      </button>

      {/* Status */}
      {status && (
        <div className="text-[8px] text-daw-text-muted font-mono px-1 truncate">
          {status}
        </div>
      )}
    </div>
  );
}
