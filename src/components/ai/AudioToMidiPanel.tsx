/**
 * Audio-to-MIDI Panel — transcribes selected audio track to MIDI.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { transcribeAudio } from '@/services/ai/audio-to-midi';
import { generateId } from '@/utils/id';
import { isAudioClip } from '@/types/audio';
import type { TranscriptionMode, TranscriptionResult } from '@/types/session-scan';
import type { MidiClip } from '@/types/audio';

const MODES: Array<{ value: TranscriptionMode; label: string; description: string }> = [
  { value: 'melody', label: 'Melody', description: 'Monophonic melody line' },
  { value: 'bass', label: 'Bass', description: 'Bass line (low frequency)' },
  { value: 'chords', label: 'Chords', description: 'Polyphonic chord detection' },
];

export default function AudioToMidiPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const addMidiTrack = useSessionStore((s) => s.addMidiTrack);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const [mode, setMode] = useState<TranscriptionMode>('melody');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const audioClip = selectedTrack?.clips.find(isAudioClip);

  const handleTranscribe = () => {
    if (!selectedTrackId || !audioClip) return;
    setProcessing(true);
    try {
      const transcription = transcribeAudio(audioClip.buffer, selectedTrackId, mode);
      setResult(transcription);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateMidiTrack = () => {
    if (!result || result.notes.length === 0) return;
    const trackId = addMidiTrack(`${selectedTrack?.name ?? 'Audio'} → MIDI (${mode})`);
    const totalDuration = result.notes.reduce(
      (max, n) => Math.max(max, n.startTime + n.duration),
      0,
    );
    const clip: MidiClip = {
      id: generateId('clip'),
      trackId,
      name: `Transcribed ${mode}`,
      notes: result.notes,
      startTime: audioClip?.startTime ?? 0,
      duration: totalDuration,
    };
    addClipToTrack(trackId, clip);
  };

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex gap-0.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            title={m.description}
            className={`flex-1 text-[8px] py-1 font-bold font-mono uppercase transition-all
                       ${mode === m.value
              ? 'bg-[#E63946]/25 text-[#E63946] border border-[#E63946]/40'
              : 'daw-hw-btn text-daw-text-muted'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Transcribe button */}
      <button
        onClick={handleTranscribe}
        disabled={processing || !audioClip}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-[#E63946]/20 text-[#E63946] hover:bg-[#E63946]/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {processing ? 'Transcribing...' : audioClip ? 'Transcribe to MIDI' : 'Select Audio Track'}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-1.5">
          <div className="bg-daw-bg/60 p-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-daw-text-dim">
                {result.notes.length} notes detected
              </span>
              <span className="text-[8px] text-daw-text-muted">
                Confidence: {Math.round(result.confidence * 100)}%
              </span>
            </div>

            {/* Note range */}
            {result.notes.length > 0 && (
              <div className="text-[8px] text-daw-text-muted mt-0.5">
                Range: MIDI {Math.min(...result.notes.map((n) => n.pitch))}–
                {Math.max(...result.notes.map((n) => n.pitch))}
              </div>
            )}
          </div>

          <button
            onClick={handleCreateMidiTrack}
            disabled={result.notes.length === 0}
            className="w-full text-xxs py-1 font-medium
                       bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30
                       disabled:opacity-30 transition-all"
          >
            Create MIDI Track
          </button>
        </div>
      )}
    </div>
  );
}
