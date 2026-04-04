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
      className={`flex flex-col items-center gap-1 px-1.5 py-1.5
                  min-w-[56px] w-[62px] shrink-0
                  border-r border-daw-border/10
                  transition-colors cursor-pointer
                  ${isSelected
                    ? 'bg-daw-accent/5'
                    : 'bg-daw-surface hover:bg-daw-surface-alt'}`}
      onClick={() => selectTrack(trackId)}
    >
      {/* Track name + type */}
      <div className="w-full text-center">
        <div className="flex items-center justify-center gap-0.5">
          <div
            className="w-1 h-1 rounded-full shrink-0"
            style={{ backgroundColor: track.color }}
          />
          <span className="text-[7px] text-daw-text-muted/40 uppercase">
            {track.type === 'audio' ? 'A' : 'M'}
          </span>
        </div>
        <span className="text-[8px] text-daw-text-dim truncate block w-full leading-tight mt-0.5">
          {track.name}
        </span>
      </div>

      {/* FX badge */}
      {effectCount > 0 && (
        <span className="text-[7px] bg-daw-accent/10 text-daw-accent/60
                         px-1 rounded-full leading-none">
          {effectCount}FX
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
        label="PAN"
        size={20}
      />

      {/* Meter + Fader — the main console area */}
      <div className="flex gap-px items-stretch flex-1 min-h-0">
        <PeakMeter trackId={trackId} height={90} width={6} />
        <Fader
          value={strip.volume}
          onChange={(v) => {
            setVolume(trackId, v);
            updateTrack(trackId, { volume: v });
          }}
          height={90}
          width={24}
          ghost={ghostVolume}
          showValue={false}
        />
        <PeakMeter trackId={trackId} height={90} width={6} />
      </div>

      {/* dB readout */}
      <span className="text-[7px] font-mono text-daw-text-muted/50 tabular-nums leading-none">
        {strip.volume > 0 ? '+' : ''}{strip.volume.toFixed(1)}
      </span>

      {/* Mute / Solo */}
      <div className="flex gap-px w-full">
        <button
          className={`flex-1 h-4 rounded-sm text-[8px] font-bold transition-all
                     flex items-center justify-center
                     ${strip.mute
              ? 'bg-amber-500/90 text-black'
              : 'bg-daw-bg/80 text-daw-text-muted/40 hover:text-daw-text-muted'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(trackId);
            updateTrack(trackId, { mute: !strip.mute });
          }}
        >
          M
        </button>
        <button
          className={`flex-1 h-4 rounded-sm text-[8px] font-bold transition-all
                     flex items-center justify-center
                     ${strip.solo
              ? 'bg-sky-500/90 text-black'
              : 'bg-daw-bg/80 text-daw-text-muted/40 hover:text-daw-text-muted'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleSolo(trackId);
            updateTrack(trackId, { solo: !strip.solo });
          }}
        >
          S
        </button>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="w-full h-0.5 rounded bg-daw-accent/60" />
      )}
    </div>
  );
}
