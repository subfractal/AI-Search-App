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
    <div className="w-52 flex-shrink-0 daw-panel border-r border-daw-grid/30
                    flex flex-col">
      <div className="flex items-center gap-1 px-3 py-2 border-b
                      border-daw-grid/30">
        <span className="text-xs text-daw-text-dim flex-1">TRACKS</span>
        <button
          onClick={handleAddAudio}
          className="daw-button text-[10px] px-2 py-1"
          title="Add audio track"
        >
          + Audio
        </button>
        <button
          onClick={handleAddMidi}
          className="daw-button text-[10px] px-2 py-1"
          title="Add MIDI track"
        >
          + MIDI
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tracks.map((track) => (
          <TrackHeader key={track.id} trackId={track.id} />
        ))}
        {tracks.length === 0 && (
          <div className="text-center text-daw-text-dim text-xs py-8 px-4">
            No tracks yet.
            <br />
            Add a track or drop an audio file.
          </div>
        )}
      </div>
    </div>
  );
}
