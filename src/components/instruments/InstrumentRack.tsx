import { useSessionStore } from '@/stores/session-store';
import { useInstrumentStore } from '@/stores/instrument-store';
import { INSTRUMENT_PRESETS } from '@/types/instruments';
import type { InstrumentType } from '@/types/instruments';
import SynthPanel from './SynthPanel';
import DrumMachine from './DrumMachine';

export default function InstrumentRack() {
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const selectedTrack = useSessionStore((s) =>
    s.tracks.find((t) => t.id === s.selectedTrackId),
  );
  const instruments = useInstrumentStore((s) => s.instruments);
  const assignInstrument = useInstrumentStore((s) => s.assignInstrument);

  if (!selectedTrackId || !selectedTrack) {
    return (
      <div className="h-full flex items-center justify-center text-xxs
                      text-daw-text-muted">
        Select a track to load an instrument
      </div>
    );
  }

  if (selectedTrack.type !== 'midi') {
    return (
      <div className="h-full flex items-center justify-center text-xxs
                      text-daw-text-muted">
        Instruments are available on MIDI tracks
      </div>
    );
  }

  const config = instruments[selectedTrackId];

  if (!config) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <span className="daw-section-label">Load Instrument</span>
        <div className="grid grid-cols-1 gap-1 mt-1">
          {INSTRUMENT_PRESETS.map((preset) => (
            <button
              key={preset.type}
              onClick={() =>
                assignInstrument(
                  selectedTrackId,
                  preset.type as InstrumentType,
                )
              }
              className="text-left text-xxs py-2 px-2.5 rounded
                         bg-daw-bg border border-daw-border/20
                         text-daw-text-dim hover:text-daw-text
                         hover:border-daw-accent/30 hover:bg-daw-accent/5
                         transition-all flex items-center gap-2"
            >
              <span className="w-4 h-4 rounded bg-daw-accent/15
                               flex items-center justify-center text-[8px]
                               text-daw-accent">
                {preset.type === 'drum-machine' ? '&#9833;' : '&#9834;'}
              </span>
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Instrument header */}
      <div className="flex items-center justify-between px-3 h-7 border-b
                      border-daw-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-daw-accent" />
          <span className="daw-section-label text-daw-accent">
            {config.name}
          </span>
        </div>
        <button
          onClick={() => {
            assignInstrument(selectedTrackId, config.type);
          }}
          className="text-xxs text-daw-text-muted hover:text-daw-text-dim
                     transition-colors"
          title="Reset instrument"
        >
          Reset
        </button>
      </div>

      {config.type === 'drum-machine' ? (
        <DrumMachine trackId={selectedTrackId} />
      ) : (
        <SynthPanel trackId={selectedTrackId} />
      )}
    </div>
  );
}
