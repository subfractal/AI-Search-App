import { memo } from 'react';
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

export default memo(function ChannelStrip({ trackId }: ChannelStripProps) {
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
      className={`flex flex-col items-center gap-1 px-1.5 py-2
                  min-w-[60px] w-[68px] shrink-0
                  transition-colors cursor-pointer
                  ${isSelected
      ? 'bg-daw-track-selected'
      : 'bg-daw-surface hover:bg-daw-surface-alt'}`}
      style={{
        borderRight: '2px solid #111113',
        boxShadow: isSelected ? 'inset 0 0 0 1px rgba(230,57,70,0.15)' : 'none',
      }}
      onClick={() => selectTrack(trackId)}
    >
      {/* Track name + type */}
      <div className="w-full text-center">
        <div className="flex items-center justify-center gap-1">
          <div
            className="w-2 h-2 shrink-0"
            style={{ backgroundColor: track.type === 'audio' ? '#D1D1D1' : '#E63946' }}
          />
          <span className="text-[8px] uppercase font-bold font-mono text-daw-text-muted/70 tracking-wider">
            {track.type === 'audio' ? 'A' : 'M'}
          </span>
        </div>
        <span className="text-[8px] text-daw-text-dim truncate block w-full leading-tight mt-0.5 font-mono">
          {track.name}
        </span>
      </div>

      {/* FX badge */}
      {effectCount > 0 && (
        <span className="text-[7px] bg-daw-accent/15 text-daw-accent/80
                         px-1.5 py-px font-mono font-bold leading-none"
        style={{ border: '1px solid rgba(247,127,0,0.2)' }}>
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
      <div className="flex gap-0.5 items-stretch flex-1 min-h-0 daw-inset p-0.5">
        <PeakMeter trackId={trackId} height={100} width={7} />
        <Fader
          value={strip.volume}
          onChange={(v) => {
            setVolume(trackId, v);
            updateTrack(trackId, { volume: v });
          }}
          height={100}
          width={26}
          ghost={ghostVolume}
          showValue={false}
        />
        <PeakMeter trackId={trackId} height={100} width={7} />
      </div>

      {/* dB readout */}
      <span className="text-[7px] font-mono text-daw-text-muted/60 tabular-nums leading-none font-medium">
        {strip.volume > 0 ? '+' : ''}{strip.volume.toFixed(1)}
      </span>

      {/* Mute / Solo */}
      <div className="flex gap-0.5 w-full">
        <button
          aria-label={`Mute ${track.name}`}
          aria-pressed={strip.mute}
          className={`flex-1 h-6 text-[8px] font-bold transition-all
                     flex items-center justify-center
                     ${strip.mute
      ? 'bg-[#F77F00]/90 text-black'
      : 'daw-hw-btn text-daw-text-muted/40 hover:text-daw-text-muted'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMute(trackId);
            updateTrack(trackId, { mute: !strip.mute });
          }}
        >
          M
        </button>
        <button
          aria-label={`Solo ${track.name}`}
          aria-pressed={strip.solo}
          className={`flex-1 h-6 text-[8px] font-bold transition-all
                     flex items-center justify-center
                     ${strip.solo
      ? 'bg-[#E63946]/90 text-white'
      : 'daw-hw-btn text-daw-text-muted/40 hover:text-daw-text-muted'}`}
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
        <div className="w-full h-1 bg-[#E63946]/70 mt-0.5" />
      )}
    </div>
  );
});
