import { memo, useMemo } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useAIStore } from '@/stores/ai-store';
import ChannelStrip from './ChannelStrip';
import Fader from './ui/Fader';
import PeakMeter from './ui/PeakMeter';

export default memo(function MixerPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  // Stable track ID list — only re-render when tracks are added/removed, not when clips/metadata change
  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks]);
  const masterVolume = useMixerStore((s) => s.masterVolume);
  const setMasterVolume = useMixerStore((s) => s.setMasterVolume);
  const lastAnalysis = useAIStore((s) => s.lastAnalysis);

  const lufs = lastAnalysis?.overallLoudness;

  return (
    <div className="flex h-full">
      {/* Track channel strips — scrollable */}
      <div className="flex overflow-x-auto flex-1 scrollbar-none">
        {trackIds.map((id) => (
          <ChannelStrip key={id} trackId={id} />
        ))}
        {trackIds.length === 0 && (
          <div className="flex items-center justify-center w-full
                          text-daw-text-muted text-xxs py-8 font-mono uppercase tracking-wider">
            Add tracks to see the mixer
          </div>
        )}
      </div>

      {/* Master channel — always visible */}
      {trackIds.length > 0 && (
        <div className="flex flex-col items-center gap-1 px-3 py-2
                        shrink-0 min-w-[80px] w-[84px]"
        style={{
          borderLeft: '3px solid #1a1a1c',
          background: 'linear-gradient(to bottom, rgba(230,57,70,0.04), rgba(230,57,70,0.01), transparent)',
        }}>
          <span className="text-[8px] text-[#E63946] font-bold tracking-[3px] font-mono uppercase">
            MASTER
          </span>

          <div className="flex gap-0.5 items-stretch flex-1 min-h-0 daw-inset p-0.5">
            {trackIds[0] && (
              <PeakMeter trackId={trackIds[0]} height={90} width={7} />
            )}
            <Fader
              value={masterVolume}
              onChange={setMasterVolume}
              height={90}
              width={28}
              showValue={false}
            />
            {trackIds[0] && (
              <PeakMeter trackId={trackIds[0]} height={90} width={7} />
            )}
          </div>

          <span className="text-[8px] font-mono text-daw-text-muted/60 tabular-nums font-medium">
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
});
