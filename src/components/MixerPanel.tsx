import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useAIStore } from '@/stores/ai-store';
import ChannelStrip from './ChannelStrip';
import Fader from './ui/Fader';
import PeakMeter from './ui/PeakMeter';

export default function MixerPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const masterVolume = useMixerStore((s) => s.masterVolume);
  const setMasterVolume = useMixerStore((s) => s.setMasterVolume);
  const lastAnalysis = useAIStore((s) => s.lastAnalysis);

  const lufs = lastAnalysis?.overallLoudness;

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
        <div className="flex flex-col items-center gap-0.5 px-2 py-1.5
                        border-l border-daw-accent/20 shrink-0
                        min-w-[72px] w-[76px]"
             style={{ background: 'linear-gradient(to bottom, rgba(255,107,53,0.03), transparent)' }}>
          <span className="text-[8px] text-daw-accent font-bold tracking-widest">
            MASTER
          </span>

          <div className="flex gap-px items-stretch flex-1 min-h-0">
            {tracks[0] && (
              <PeakMeter trackId={tracks[0].id} height={80} width={5} />
            )}
            <Fader
              value={masterVolume}
              onChange={setMasterVolume}
              height={80}
              width={24}
              showValue={false}
            />
            {tracks[0] && (
              <PeakMeter trackId={tracks[0].id} height={80} width={5} />
            )}
          </div>

          <span className="text-[7px] font-mono text-daw-text-muted/50 tabular-nums">
            {masterVolume > 0 ? '+' : ''}{masterVolume.toFixed(1)}
          </span>

          {/* LUFS readout — LCD style */}
          {lufs && (
            <div className="w-full daw-lcd px-1.5 py-1 mt-0.5">
              <div className="text-center">
                <span className="text-[6px] text-daw-lcd-dim uppercase tracking-widest block">
                  LUFS
                </span>
                <span className={`text-[10px] font-mono font-bold tabular-nums block leading-tight
                  ${lufs.integrated >= -16 && lufs.integrated <= -14
                    ? 'text-[#3dd68c]'
                    : lufs.integrated > -11 || lufs.integrated < -20
                      ? 'text-[#ef4444]'
                      : 'text-[#f5c542]'}`}
                >
                  {lufs.integrated > -Infinity
                    ? lufs.integrated.toFixed(1)
                    : '- -'}
                </span>
              </div>
              <div className="text-center mt-0.5">
                <span className="text-[6px] text-daw-lcd-dim uppercase tracking-widest block">
                  TP
                </span>
                <span className={`text-[9px] font-mono tabular-nums block leading-tight
                  ${lufs.truePeak > -1 ? 'text-[#ef4444]' : 'text-daw-lcd-text/50'}`}
                >
                  {lufs.truePeak > -Infinity
                    ? `${lufs.truePeak.toFixed(1)}`
                    : '- -'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
