import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useEffectsStore } from '@/stores/effects-store';
import { useRoutingStore } from '@/stores/routing-store';
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

  // Sends: find return buses and sends for this track
  const returnBuses = useRoutingStore((s) =>
    Object.values(s.buses).filter((b) => b.type === 'return').slice(0, 2),
  );
  const sends = useRoutingStore((s) => s.sends);
  const addSend = useRoutingStore((s) => s.addSend);
  const updateSend = useRoutingStore((s) => s.updateSend);
  const addBus = useRoutingStore((s) => s.addBus);

  const ghostVolume = useAIStore((s) => {
    const sug = s.suggestions.find(
      (sg) => sg.targetTrackId === trackId && sg.status === 'pending'
        && sg.priority === 'inline' && sg.action?.type === 'setVolume',
    );
    return sug?.action?.value ?? null;
  });

  if (!track || !strip) return null;

  // Get or create send for a bus
  const getSendForBus = (busId: string) => {
    return Object.values(sends).find(
      (s) => s.sourceTrackId === trackId && s.busId === busId,
    );
  };

  const handleSendChange = (busId: string, value: number) => {
    const existing = getSendForBus(busId);
    if (existing) {
      updateSend(existing.id, { amount: value });
    } else if (value > 0) {
      const sendId = addSend(trackId, busId);
      updateSend(sendId, { amount: value });
    }
  };

  const handleAddReturnBus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const busCount = returnBuses.length;
    addBus(`Return ${String.fromCharCode(65 + busCount)}`, 'return');
  };

  const isSelected = selectedTrackId === trackId;

  return (
    <div
      className={`flex flex-col items-center gap-1 px-1.5 py-1.5
                  min-w-[56px] w-[64px] shrink-0
                  border-r border-daw-border/10
                  transition-colors cursor-pointer
                  ${isSelected
                    ? 'bg-daw-track-selected'
                    : 'bg-daw-surface hover:bg-daw-surface-alt'}`}
      onClick={() => selectTrack(trackId)}
    >
      {/* Track name + type */}
      <div className="w-full text-center">
        <div className="flex items-center justify-center gap-0.5">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: track.type === 'audio' ? '#3dd68c' : '#4ba0ff' }}
          />
          <span className={`text-[7px] uppercase font-medium
                           ${track.type === 'audio' ? 'text-daw-type-audio/60' : 'text-daw-type-midi/60'}`}>
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

      {/* Sends */}
      {returnBuses.length > 0 ? (
        <div className="flex gap-1 items-center">
          {returnBuses.map((bus, i) => {
            const send = getSendForBus(bus.id);
            return (
              <Knob
                key={bus.id}
                value={send?.amount ?? 0}
                min={0}
                max={1}
                onChange={(v) => handleSendChange(bus.id, v)}
                label={String.fromCharCode(65 + i)}
                size={16}
              />
            );
          })}
        </div>
      ) : (
        <button
          onClick={handleAddReturnBus}
          className="text-[7px] text-daw-text-muted/40 hover:text-daw-accent/60
                     transition-colors leading-none"
          title="Add return bus"
        >
          +Snd
        </button>
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
