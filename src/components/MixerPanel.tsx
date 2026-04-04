import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import ChannelStrip from './ChannelStrip';
import Fader from './ui/Fader';

export default function MixerPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const masterVolume = useMixerStore((s) => s.masterVolume);
  const setMasterVolume = useMixerStore((s) => s.setMasterVolume);

  return (
    <div className="bg-daw-surface border-t border-daw-border/40 shrink-0
                    max-h-[35vh] min-h-[130px] h-48">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 h-6 border-b
                      border-daw-border/20">
        <div className="flex items-center gap-2">
          <span className="daw-section-label">Mixer</span>
          {tracks.length > 0 && (
            <span className="text-[8px] text-daw-text-muted/50">
              {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            </span>
          )}
        </div>
      </div>

      {/* Channel strips + master */}
      <div className="flex h-[calc(100%-24px)]">
        {/* Track strips — scrollable */}
        <div className="flex overflow-x-auto flex-1 scrollbar-none">
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

        {/* Master channel */}
        {tracks.length > 0 && (
          <div className="flex flex-col items-center gap-1 px-3 py-2
                          border-l-2 border-daw-accent/20 bg-daw-bg/40
                          min-w-[60px] shrink-0">
            <span className="text-xxs text-daw-accent font-medium">MST</span>
            <Fader
              value={masterVolume}
              onChange={setMasterVolume}
              height={72}
            />
            <span className="text-[8px] font-mono text-daw-text-muted/60 tabular-nums">
              {masterVolume > 0 ? '+' : ''}{masterVolume.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
