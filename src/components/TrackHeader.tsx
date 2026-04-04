import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';

interface TrackHeaderProps {
  trackId: string;
}

export default function TrackHeader({ trackId }: TrackHeaderProps) {
  const track = useSessionStore(
    (s) => s.tracks.find((t) => t.id === trackId),
  );
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const selectTrack = useSessionStore((s) => s.selectTrack);
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const removeTrack = useSessionStore((s) => s.removeTrack);
  const toggleMute = useMixerStore((s) => s.toggleMute);
  const toggleSolo = useMixerStore((s) => s.toggleSolo);

  if (!track) return null;

  const isSelected = selectedTrackId === trackId;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-daw-grid/30
                  cursor-pointer transition-colors h-20
                  ${isSelected ? 'bg-daw-panel/60' : 'hover:bg-daw-track'}`}
      onClick={() => selectTrack(trackId)}
    >
      <div
        className="w-1 h-12 rounded-full flex-shrink-0"
        style={{ backgroundColor: track.color }}
      />

      <div className="flex-1 min-w-0">
        <input
          className="bg-transparent text-sm font-medium w-full truncate
                     focus:outline-none focus:bg-daw-bg/50 rounded px-1"
          value={track.name}
          onChange={(e) => updateTrack(trackId, { name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-[10px] text-daw-text-dim uppercase">
          {track.type}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          className={`w-6 h-6 rounded text-[10px] font-bold transition-colors
                     ${track.mute
              ? 'bg-yellow-600 text-white'
              : 'bg-daw-bg/50 text-daw-text-dim hover:text-daw-text'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(trackId);
            updateTrack(trackId, { mute: !track.mute });
          }}
        >
          M
        </button>
        <button
          className={`w-6 h-6 rounded text-[10px] font-bold transition-colors
                     ${track.solo
              ? 'bg-blue-600 text-white'
              : 'bg-daw-bg/50 text-daw-text-dim hover:text-daw-text'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSolo(trackId);
            updateTrack(trackId, { solo: !track.solo });
          }}
        >
          S
        </button>
        <button
          className="w-6 h-6 rounded text-[10px] bg-daw-bg/50
                     text-daw-text-dim hover:text-red-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            removeTrack(trackId);
          }}
          title="Delete track"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
