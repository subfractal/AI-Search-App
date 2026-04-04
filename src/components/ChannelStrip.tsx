import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useEffectsStore } from '@/stores/effects-store';
import Fader from './ui/Fader';
import Knob from './ui/Knob';
import PeakMeter from './ui/PeakMeter';
import { useAIStore } from '@/stores/ai-store';

interface ChannelStripProps {
  trackId: string;
}

export default function ChannelStrip({ trackId }: ChannelStripProps) {
  const track = useSessionStore(
    (s) => s.tracks.find((t) => t.id === trackId),
  );
  const strip = useMixerStore((s) => s.strips[trackId]);
  const setVolume = useMixerStore((s) => s.setVolume);
  const setPan = useMixerStore((s) => s.setPan);
  const toggleMute = useMixerStore((s) => s.toggleMute);
  const toggleSolo = useMixerStore((s) => s.toggleSolo);
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const selectTrack = useSessionStore((s) => s.selectTrack);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);

  const effectCount = useEffectsStore(
    (s) => (s.trackEffects[trackId] ?? []).length,
  );

  const ghostVolume = useAIStore((s) => {
    const sug = s.suggestions.find(
      (sg) => sg.targetTrackId === trackId && sg.status === 'pending'
        && sg.priority === 'inline' && sg.action?.type === 'setVolume',
    );
    return sug?.action?.value ?? null;
  });

  if (!track || !strip) return null;

  const isSelected = selectedTrackId === trackId;

  return (
    <div
      className={`flex flex-col items-center gap-1 px-2 py-2
                  min-w-[64px] border-r border-daw-border/15
                  transition-colors cursor-pointer
                  ${isSelected
                    ? 'bg-daw-accent/5 border-b-2 border-b-daw-accent/40'
                    : 'bg-daw-surface hover:bg-daw-surface-alt'}`}
      onClick={() => selectTrack(trackId)}
    >
      {/* Track type + color + name */}
      <div className="flex items-center gap-1 w-full">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: track.color }}
        />
        <span className="text-[7px] uppercase text-daw-text-muted/50 shrink-0">
          {track.type === 'audio' ? 'AUD' : 'MID'}
        </span>
        <span className="text-xxs text-daw-text-dim truncate flex-1">
          {track.name}
        </span>
      </div>

      {/* Effects count */}
      {effectCount > 0 && (
        <span className="text-[8px] bg-daw-accent/10 text-daw-accent/70
                         px-1.5 py-px rounded-full leading-none">
          FX {effectCount}
        </span>
      )}

      {/* Pan knob */}
      <Knob
        value={strip.pan}
        min={-1}
        max={1}
        onChange={(v) => {
          setPan(trackId, v);
          updateTrack(trackId, { pan: v });
        }}
        label="Pan"
        size={24}
      />

      {/* Meter + Fader */}
      <div className="flex gap-0.5 items-end">
        <PeakMeter trackId={trackId} height={72} width={5} />
        <Fader
          value={strip.volume}
          onChange={(v) => {
            setVolume(trackId, v);
            updateTrack(trackId, { volume: v });
          }}
          height={72}
          ghost={ghostVolume}
        />
      </div>

      {/* dB readout */}
      <span className="text-[8px] font-mono text-daw-text-muted/60 tabular-nums
                        leading-none">
        {strip.volume > 0 ? '+' : ''}{strip.volume.toFixed(1)}
      </span>

      {/* Mute / Solo */}
      <div className="flex gap-0.5">
        <button
          className={`w-5 h-4 rounded text-xxs font-bold transition-all
                     flex items-center justify-center
                     ${strip.mute
              ? 'bg-amber-500/90 text-black'
              : 'bg-daw-bg text-daw-text-muted hover:text-daw-text-dim'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(trackId);
            updateTrack(trackId, { mute: !strip.mute });
          }}
        >
          M
        </button>
        <button
          className={`w-5 h-4 rounded text-xxs font-bold transition-all
                     flex items-center justify-center
                     ${strip.solo
              ? 'bg-sky-500/90 text-black'
              : 'bg-daw-bg text-daw-text-muted hover:text-daw-text-dim'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSolo(trackId);
            updateTrack(trackId, { solo: !strip.solo });
          }}
        >
          S
        </button>
      </div>
    </div>
  );
}
