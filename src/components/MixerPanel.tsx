import { useSessionStore } from '@/stores/session-store';
import ChannelStrip from './ChannelStrip';

export default function MixerPanel() {
  const tracks = useSessionStore((s) => s.tracks);

  return (
    <div className="bg-daw-surface border-t border-daw-border/40 h-48 shrink-0">
      <div className="flex items-center px-2.5 h-6 border-b
                      border-daw-border/20">
        <span className="daw-section-label">Mixer</span>
      </div>
      <div className="flex overflow-x-auto h-[calc(100%-24px)]">
        {tracks.map((track) => (
          <ChannelStrip key={track.id} trackId={track.id} />
        ))}
        {tracks.length === 0 && (
          <div className="flex items-center justify-center w-full
                          text-daw-text-muted text-xxs">
            Add tracks to see the mixer
          </div>
        )}
      </div>
    </div>
  );
}
