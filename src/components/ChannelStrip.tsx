import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
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

  const suggestions = useAIStore((s) =>
    s.suggestions.filter(
      (sg) => sg.targetTrackId === trackId && sg.status === 'pending'
        && sg.priority === 'inline',
    ),
  );

  if (!track || !strip) return null;

  const ghostVolume = suggestions.find(
    (s) => s.action?.type === 'setVolume',
  )?.action?.value ?? null;

  return (
    <div className="flex flex-col items-center gap-1.5 px-2 py-2
                    min-w-[60px] border-r border-daw-border/15
                    bg-daw-surface hover:bg-daw-surface-alt transition-colors">
      {/* Track color + name */}
      <div className="flex items-center gap-1 w-full">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: track.color }}
        />
        <span className="text-xxs text-daw-text-dim truncate max-w-[48px]">
          {track.name}
        </span>
      </div>

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
        size={26}
      />

      {/* Meter + Fader side by side */}
      <div className="flex gap-1 items-end">
        <PeakMeter trackId={trackId} height={80} width={6} />
        <Fader
          value={strip.volume}
          onChange={(v) => {
            setVolume(trackId, v);
            updateTrack(trackId, { volume: v });
          }}
          height={80}
          ghost={ghostVolume}
        />
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-0.5">
        <button
          className={`w-5 h-4 rounded text-xxs font-bold transition-all
                     flex items-center justify-center
                     ${strip.mute
              ? 'bg-amber-500/90 text-black'
              : 'bg-daw-bg text-daw-text-muted hover:text-daw-text-dim'}`}
          onClick={() => {
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
          onClick={() => {
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
