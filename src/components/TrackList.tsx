import { useRef } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { loadAudioFile } from '@/services/audio-engine';
import { generateId } from '@/utils/id';
import type { AudioClip } from '@/types/audio';
import TrackHeader from './TrackHeader';

export default function TrackList() {
  const tracks = useSessionStore((s) => s.tracks);
  const addAudioTrack = useSessionStore((s) => s.addAudioTrack);
  const addMidiTrack = useSessionStore((s) => s.addMidiTrack);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const initStrip = useMixerStore((s) => s.initStrip);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddAudioClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const buffer = await loadAudioFile(file);
        const name = file.name.replace(/\.[^.]+$/, '');
        const trackId = addAudioTrack(name);
        initStrip(trackId);

        const clip: AudioClip = {
          id: generateId('clip'),
          trackId,
          name,
          buffer,
          startTime: 0,
          duration: buffer.duration,
          offset: 0,
        };

        addClipToTrack(trackId, clip);
      } catch (err) {
        console.error(`Failed to load ${file.name}:`, err);
      }
    }

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleAddMidi = () => {
    const id = addMidiTrack();
    initStrip(id);
  };

  return (
    <div className="w-48 shrink-0 bg-daw-surface border-r border-daw-border/30
                    flex flex-col">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.flac,.ogg,.webm,audio/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 h-7 border-b
                      border-daw-border/20 shrink-0">
        <span className="daw-section-label flex-1">Tracks</span>
        <button
          onClick={handleAddAudioClick}
          className="text-xxs text-daw-text-muted hover:text-daw-accent
                     transition-colors px-1"
          title="Import audio file"
        >
          +Aud
        </button>
        <span className="text-daw-border">|</span>
        <button
          onClick={handleAddMidi}
          className="text-xxs text-daw-text-muted hover:text-daw-midi
                     transition-colors px-1"
          title="Add MIDI track"
        >
          +Mid
        </button>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {tracks.map((track) => (
          <TrackHeader key={track.id} trackId={track.id} />
        ))}
        {tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full
                          text-daw-text-muted text-xxs px-6 text-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"
              stroke="currentColor" strokeWidth="1" className="opacity-30">
              <rect x="4" y="6" width="24" height="4" rx="1" />
              <rect x="4" y="14" width="24" height="4" rx="1" />
              <rect x="4" y="22" width="24" height="4" rx="1" />
            </svg>
            <span>No tracks yet</span>
            <button
              onClick={handleAddAudioClick}
              className="text-daw-accent hover:text-daw-accent-dim
                         transition-colors underline underline-offset-2"
            >
              Import audio file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
