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
    <div className="flex flex-col items-center gap-2 px-3 py-3
                    min-w-[72px] border-r border-daw-grid/20">
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: track.color }}
      />

      <Knob
        value={strip.pan}
        min={-1}
        max={1}
        onChange={(v) => {
          setPan(trackId, v);
          updateTrack(trackId, { pan: v });
        }}
        label="PAN"
        size={28}
      />

      <div className="flex gap-1">
        <PeakMeter trackId={trackId} height={100} />
        <Fader
          value={strip.volume}
          onChange={(v) => {
            setVolume(trackId, v);
            updateTrack(trackId, { volume: v });
          }}
          height={100}
          ghost={ghostVolume}
        />
      </div>

      <div className="flex gap-1">
        <button
          className={`w-6 h-5 rounded text-[9px] font-bold transition-colors
                     ${strip.mute
              ? 'bg-yellow-600 text-white'
              : 'bg-daw-bg/50 text-daw-text-dim hover:text-daw-text'}`}
          onClick={() => {
            toggleMute(trackId);
            updateTrack(trackId, { mute: !strip.mute });
          }}
        >
          M
        </button>
        <button
          className={`w-6 h-5 rounded text-[9px] font-bold transition-colors
                     ${strip.solo
              ? 'bg-blue-600 text-white'
              : 'bg-daw-bg/50 text-daw-text-dim hover:text-daw-text'}`}
          onClick={() => {
            toggleSolo(trackId);
            updateTrack(trackId, { solo: !strip.solo });
          }}
        >
          S
        </button>
      </div>

      <span className="text-[10px] text-daw-text-dim truncate max-w-[60px]
                        text-center">
        {track.name}
      </span>
    </div>
  );
}
