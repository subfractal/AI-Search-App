import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useInstrumentStore } from '@/stores/instrument-store';
import { INSTRUMENT_PRESETS, PRESET_CATEGORIES } from '@/types/instruments';
import type { InstrumentType, PresetCategory } from '@/types/instruments';
import SynthPanel from './SynthPanel';
import DrumMachine from './DrumMachine';

export default function InstrumentRack() {
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const selectedTrack = useSessionStore((s) =>
    s.tracks.find((t) => t.id === s.selectedTrackId),
  );
  const instruments = useInstrumentStore((s) => s.instruments);
  const assignInstrument = useInstrumentStore((s) => s.assignInstrument);
  const [activeCategory, setActiveCategory] = useState<PresetCategory>('keys');

  if (!selectedTrackId || !selectedTrack) {
    return (
      <div className="h-full flex items-center justify-center text-xxs
                      text-daw-text-muted p-4">
        Select a track to load an instrument
      </div>
    );
  }

  if (selectedTrack.type !== 'midi') {
    return (
      <div className="h-full flex items-center justify-center text-xxs
                      text-daw-text-muted p-4">
        Instruments are available on MIDI tracks only
      </div>
    );
  }

  const config = instruments[selectedTrackId];

  if (!config) {
    const categoryPresets = INSTRUMENT_PRESETS.filter(
      (p) => p.category === activeCategory,
    );

    return (
      <div className="p-3">
        <span className="daw-section-label">Load Instrument</span>

        {/* Category tabs */}
        <div className="flex gap-0.5 mt-2 overflow-x-auto scrollbar-none pb-1">
          {PRESET_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`text-[9px] px-2 py-1 shrink-0 transition-all
                         ${activeCategory === cat.id
                  ? 'bg-daw-accent/20 text-daw-accent border border-daw-accent/30'
                  : 'bg-daw-bg text-daw-text-muted/60 border border-daw-border/20 hover:text-daw-text-dim'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Presets in selected category */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {categoryPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() =>
                assignInstrument(
                  selectedTrackId,
                  preset.type as InstrumentType,
                  preset.params,
                )
              }
              className="text-xxs py-2 px-3
                         bg-daw-bg border border-daw-border/20
                         text-daw-text-dim hover:text-daw-text
                         hover:border-daw-accent/30 hover:bg-daw-accent/5
                         transition-all flex items-center gap-1.5"
            >
              <span className="w-4 h-4 bg-daw-accent/15
                               flex items-center justify-center text-[9px]
                               text-daw-accent">
                {preset.type === 'drum-machine' ? '\u266D' : '\u266A'}
              </span>
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Instrument header */}
      <div className="flex items-center justify-between px-3 h-7 border-b
                      border-daw-border/20 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-daw-accent" />
          <span className="daw-section-label text-daw-accent">
            {config.name}
          </span>
          <span className="text-[8px] text-daw-text-muted/40">
            {selectedTrack.name}
          </span>
        </div>
        <button
          onClick={() => assignInstrument(selectedTrackId, config.type)}
          className="text-xxs text-daw-text-muted hover:text-daw-text-dim
                     transition-colors"
          title="Reset instrument"
        >
          Reset
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {config.type === 'drum-machine' ? (
          <DrumMachine trackId={selectedTrackId} />
        ) : (
          <SynthPanel trackId={selectedTrackId} />
        )}
      </div>
    </div>
  );
}
