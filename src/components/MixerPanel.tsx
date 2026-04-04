import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import ChannelStrip from './ChannelStrip';
import Fader from './ui/Fader';
import PeakMeter from './ui/PeakMeter';

export default function MixerPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const masterVolume = useMixerStore((s) => s.masterVolume);
  const setMasterVolume = useMixerStore((s) => s.setMasterVolume);

  return (
    <div className="flex h-full">
      {/* Track channel strips — scrollable */}
      <div className="flex overflow-x-auto flex-1 scrollbar-none">
        {tracks.map((track) => (
          <ChannelStrip key={track.id} trackId={track.id} />
        ))}
        {tracks.length === 0 && (
          <div className="flex items-center justify-center w-full
                          text-daw-text-muted text-xxs py-8">
            Add tracks to see the mixer
          </div>
        )}
      </div>

      {/* Master channel — always visible */}
      {tracks.length > 0 && (
        <div className="flex flex-col items-center gap-1 px-2 py-1.5
                        border-l-2 border-daw-accent/15 bg-daw-bg/30
                        min-w-[64px] w-[68px] shrink-0">
          <span className="text-[8px] text-daw-accent font-bold tracking-wider">
            MASTER
          </span>

          <div className="flex gap-px items-stretch flex-1 min-h-0">
            {tracks[0] && (
              <PeakMeter trackId={tracks[0].id} height={90} width={5} />
            )}
            <Fader
              value={masterVolume}
              onChange={setMasterVolume}
              height={90}
              width={24}
              showValue={false}
            />
            {tracks[0] && (
              <PeakMeter trackId={tracks[0].id} height={90} width={5} />
            )}
          </div>

          <span className="text-[7px] font-mono text-daw-text-muted/50 tabular-nums">
            {masterVolume > 0 ? '+' : ''}{masterVolume.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}
