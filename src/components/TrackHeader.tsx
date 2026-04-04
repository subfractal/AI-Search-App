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
      className={`group flex items-center gap-2 px-2.5 py-0 border-b
                  border-daw-border/20 cursor-pointer transition-colors h-[60px]
                  ${isSelected
          ? 'bg-daw-track-selected'
          : 'bg-daw-track hover:bg-daw-surface-alt'}`}
      onClick={() => selectTrack(trackId)}
    >
      {/* Color bar */}
      <div
        className="w-[3px] h-8 rounded-full shrink-0"
        style={{ backgroundColor: track.color }}
      />

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <input
          className="bg-transparent text-xs font-medium w-full truncate
                     text-daw-text focus:outline-none focus:bg-daw-bg/60
                     rounded px-1 -ml-1 leading-tight"
          value={track.name}
          onChange={(e) => updateTrack(trackId, { name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="text-xxs uppercase tracking-wide px-1 py-px rounded
                       bg-daw-bg/60 leading-none"
            style={{ color: track.color + 'bb' }}
          >
            {track.type}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-0.5">
        <button
          className={`w-5 h-5 rounded text-xxs font-bold transition-all
                     flex items-center justify-center
                     ${track.mute
              ? 'bg-amber-500/90 text-black'
              : 'bg-daw-bg/40 text-daw-text-muted hover:text-daw-text-dim'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(trackId);
            updateTrack(trackId, { mute: !track.mute });
          }}
        >
          M
        </button>
        <button
          className={`w-5 h-5 rounded text-xxs font-bold transition-all
                     flex items-center justify-center
                     ${track.solo
              ? 'bg-sky-500/90 text-black'
              : 'bg-daw-bg/40 text-daw-text-muted hover:text-daw-text-dim'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSolo(trackId);
            updateTrack(trackId, { solo: !track.solo });
          }}
        >
          S
        </button>
        <button
          className="w-5 h-5 rounded text-xxs bg-daw-bg/40
                     text-daw-text-muted hover:text-red-400
                     transition-all flex items-center justify-center
                     opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            removeTrack(trackId);
          }}
          title="Delete track"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="7" y2="7" />
            <line x1="7" y1="1" x2="1" y2="7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
