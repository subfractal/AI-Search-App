import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import TrackHeader from './TrackHeader';

export default function TrackList() {
  const tracks = useSessionStore((s) => s.tracks);
  const addAudioTrack = useSessionStore((s) => s.addAudioTrack);
  const addMidiTrack = useSessionStore((s) => s.addMidiTrack);
  const initStrip = useMixerStore((s) => s.initStrip);

  const handleAddAudio = () => {
    const id = addAudioTrack();
    initStrip(id);
  };

  const handleAddMidi = () => {
    const id = addMidiTrack();
    initStrip(id);
  };

  return (
    <div className="w-48 shrink-0 bg-daw-surface border-r border-daw-border/30
                    flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 h-7 border-b
                      border-daw-border/20 shrink-0">
        <span className="daw-section-label flex-1">Tracks</span>
        <button
          onClick={handleAddAudio}
          className="text-xxs text-daw-text-muted hover:text-daw-accent
                     transition-colors px-1"
          title="Add audio track"
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
                          text-daw-text-muted text-xxs px-6 text-center gap-2">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"
              stroke="currentColor" strokeWidth="1" className="opacity-30">
              <rect x="4" y="6" width="24" height="4" rx="1" />
              <rect x="4" y="14" width="24" height="4" rx="1" />
              <rect x="4" y="22" width="24" height="4" rx="1" />
            </svg>
            <span>No tracks yet</span>
            <span className="text-daw-text-muted/60">
              Add a track or drop audio
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
