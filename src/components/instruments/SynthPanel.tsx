import { useInstrumentStore } from '@/stores/instrument-store';
import { triggerNote } from '@/services/instrument-service';
import type { OscillatorType, FilterType } from '@/types/instruments';
import Knob from '@/components/ui/Knob';

interface SynthPanelProps {
  trackId: string;
}

const OSC_TYPES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass'];

export default function SynthPanel({ trackId }: SynthPanelProps) {
  const config = useInstrumentStore((s) => s.instruments[trackId]);
  const updateSynth = useInstrumentStore((s) => s.updateSynth);

  if (!config?.synthParams) return null;
  const params = config.synthParams;

  const playTestNote = () => {
    triggerNote(trackId, 'C4', '8n');
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-daw-text">{config.name}</span>
        <button
          onClick={playTestNote}
          className="daw-button text-xxs px-2"
        >
          Test
        </button>
      </div>

      {/* Oscillator */}
      <div>
        <span className="daw-section-label">Oscillator</span>
        <div className="flex gap-1 mt-1">
          {OSC_TYPES.map((osc) => (
            <button
              key={osc}
              onClick={() => updateSynth(trackId, { oscillator: osc })}
              className={`flex-1 text-xxs py-1 rounded transition-all
                         ${params.oscillator === osc
                  ? 'bg-daw-accent/20 text-daw-accent border border-daw-accent/30'
                  : 'bg-daw-bg text-daw-text-muted border border-daw-border/30 hover:text-daw-text-dim'}`}
            >
              {osc.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div>
        <span className="daw-section-label">Filter</span>
        <div className="flex gap-1 mt-1 mb-2">
          {FILTER_TYPES.map((f) => (
            <button
              key={f}
              onClick={() => updateSynth(trackId, { filterType: f })}
              className={`flex-1 text-xxs py-1 rounded transition-all
                         ${params.filterType === f
                  ? 'bg-daw-accent/20 text-daw-accent border border-daw-accent/30'
                  : 'bg-daw-bg text-daw-text-muted border border-daw-border/30 hover:text-daw-text-dim'}`}
            >
              {f === 'lowpass' ? 'LP' : f === 'highpass' ? 'HP' : 'BP'}
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-4">
          <Knob
            value={Math.log2(params.filterFrequency / 20) / Math.log2(20000 / 20)}
            min={0}
            max={1}
            onChange={(v) => {
              const freq = 20 * Math.pow(20000 / 20, v);
              updateSynth(trackId, { filterFrequency: Math.round(freq) });
            }}
            label="Freq"
            size={30}
          />
          <Knob
            value={params.filterResonance}
            min={0}
            max={20}
            onChange={(v) => updateSynth(trackId, { filterResonance: v })}
            label="Res"
            size={30}
          />
        </div>
      </div>

      {/* Envelope */}
      <div>
        <span className="daw-section-label">Envelope</span>
        <div className="flex justify-center gap-3 mt-2">
          <Knob
            value={params.attack}
            min={0.001}
            max={2}
            onChange={(v) => updateSynth(trackId, { attack: v })}
            label="A"
            size={26}
          />
          <Knob
            value={params.decay}
            min={0.01}
            max={2}
            onChange={(v) => updateSynth(trackId, { decay: v })}
            label="D"
            size={26}
          />
          <Knob
            value={params.sustain}
            min={0}
            max={1}
            onChange={(v) => updateSynth(trackId, { sustain: v })}
            label="S"
            size={26}
          />
          <Knob
            value={params.release}
            min={0.01}
            max={4}
            onChange={(v) => updateSynth(trackId, { release: v })}
            label="R"
            size={26}
          />
        </div>
      </div>

      {/* Mini keyboard */}
      <div>
        <span className="daw-section-label">Keyboard</span>
        <MiniKeyboard trackId={trackId} />
      </div>
    </div>
  );
}

function MiniKeyboard({ trackId }: { trackId: string }) {
  const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const blackKeys = [
    { note: 'C#', offset: 1 },
    { note: 'D#', offset: 2 },
    { note: 'F#', offset: 4 },
    { note: 'G#', offset: 5 },
    { note: 'A#', offset: 6 },
  ];

  const play = (note: string) => {
    triggerNote(trackId, `${note}4`, '8n');
  };

  return (
    <div className="relative mt-1 h-10">
      {/* White keys */}
      <div className="flex gap-px h-full">
        {whiteKeys.map((note) => (
          <button
            key={note}
            onMouseDown={() => play(note)}
            className="flex-1 bg-daw-text/90 rounded-b-sm text-[7px]
                       text-daw-bg font-medium flex items-end justify-center
                       pb-0.5 hover:bg-white active:bg-daw-text-dim
                       transition-colors"
          >
            {note}
          </button>
        ))}
      </div>
      {/* Black keys */}
      <div className="absolute top-0 left-0 right-0 h-[60%] flex">
        {blackKeys.map(({ note, offset }) => (
          <button
            key={note}
            onMouseDown={() => play(note)}
            className="absolute w-[12%] h-full bg-daw-bg rounded-b-sm
                       border border-daw-border/40
                       hover:bg-daw-surface active:bg-daw-panel
                       transition-colors z-10"
            style={{
              left: `${(offset / 7) * 100 + 100 / 14 - 6}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
