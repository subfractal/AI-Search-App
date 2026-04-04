import { useSessionStore } from '@/stores/session-store';
import ChannelStrip from './ChannelStrip';

export default function MixerPanel() {
  const tracks = useSessionStore((s) => s.tracks);

  return (
    <div className="daw-panel border-t border-daw-grid/30 h-56">
      <div className="flex items-center px-3 py-1 border-b border-daw-grid/30">
        <span className="text-xs text-daw-text-dim">MIXER</span>
      </div>
      <div className="flex overflow-x-auto h-[calc(100%-28px)]">
        {tracks.map((track) => (
          <ChannelStrip key={track.id} trackId={track.id} />
        ))}
        {tracks.length === 0 && (
          <div className="flex items-center justify-center w-full
                          text-daw-text-dim text-xs">
            Add tracks to see the mixer
          </div>
        )}
      </div>
    </div>
  );
}
