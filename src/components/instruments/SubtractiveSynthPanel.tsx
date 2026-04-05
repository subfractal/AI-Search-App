import { useInstrumentStore } from '@/stores/instrument-store';
import Knob from '@/components/ui/Knob';
import type { OscillatorType, FilterType } from '@/types/instruments';

interface SubtractiveSynthPanelProps {
  trackId: string;
}

const OSC_TYPES: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass'];

export default function SubtractiveSynthPanel({ trackId }: SubtractiveSynthPanelProps) {
  const config = useInstrumentStore((s) => s.instruments[trackId]);
  const updateSynth = useInstrumentStore((s) => s.updateSynth);

  if (!config?.synthParams) {
    return (
      <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
        No synth parameters loaded
      </div>
    );
  }

  const p = config.synthParams;

  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="text-[9px] font-mono font-bold uppercase tracking-[3px] text-[#E63946]/90">SUBTRACTIVE SYNTH</span>
      <div className="flex gap-4 overflow-x-auto">
      {/* OSC Section */}
      <div className="flex flex-col gap-2 min-w-[100px]">
        <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          Oscillator
        </span>
        <div className="flex gap-0.5">
          {OSC_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => updateSynth(trackId, { oscillator: type })}
              className={`text-[8px] px-1.5 py-1 transition-all border
                         ${p.oscillator === type
                  ? 'bg-daw-accent/20 text-daw-accent border-daw-accent/30'
                  : 'bg-daw-bg/40 text-daw-text-muted/50 border-daw-border/20'}`}
            >
              {type.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>

        {/* OSC2 placeholder */}
        <div className="flex gap-0.5 opacity-50">
          {OSC_TYPES.map((type) => (
            <button
              key={`osc2-${type}`}
              className="text-[8px] px-1.5 py-1 bg-daw-bg/20 text-daw-text-muted/30 border border-daw-border/10"
              title="OSC 2 (coming soon)"
              disabled
            >
              {type.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
        <span className="text-[7px] text-daw-text-muted/30">OSC 2</span>
      </div>

      {/* Filter Section */}
      <div className="flex flex-col gap-2 min-w-[120px]">
        <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          Filter
        </span>
        <div className="flex gap-0.5">
          {FILTER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => updateSynth(trackId, { filterType: type })}
              className={`text-[8px] px-1.5 py-1 transition-all border
                         ${p.filterType === type
                  ? 'bg-daw-accent/20 text-daw-accent border-daw-accent/30'
                  : 'bg-daw-bg/40 text-daw-text-muted/50 border-daw-border/20'}`}
            >
              {type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <Knob
            value={p.filterFrequency}
            min={20}
            max={20000}
            onChange={(v) => updateSynth(trackId, { filterFrequency: v })}
            label="Freq"
            size={28}
          />
          <Knob
            value={p.filterResonance}
            min={0}
            max={20}
            onChange={(v) => updateSynth(trackId, { filterResonance: v })}
            label="Res"
            size={28}
          />
        </div>
      </div>

      {/* AMP Envelope */}
      <div className="flex flex-col gap-2 min-w-[140px]">
        <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          Envelope
        </span>
        <div className="flex gap-2">
          <Knob
            value={p.attack}
            min={0}
            max={2}
            onChange={(v) => updateSynth(trackId, { attack: v })}
            label="A"
            size={24}
          />
          <Knob
            value={p.decay}
            min={0}
            max={2}
            onChange={(v) => updateSynth(trackId, { decay: v })}
            label="D"
            size={24}
          />
          <Knob
            value={p.sustain}
            min={0}
            max={1}
            onChange={(v) => updateSynth(trackId, { sustain: v })}
            label="S"
            size={24}
          />
          <Knob
            value={p.release}
            min={0}
            max={5}
            onChange={(v) => updateSynth(trackId, { release: v })}
            label="R"
            size={24}
          />
        </div>
      </div>

      {/* Modulation (placeholder) */}
      <div className="flex flex-col gap-2 min-w-[80px] opacity-60">
        <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          LFO
        </span>
        <div className="flex gap-2">
          <Knob
            value={0.5}
            min={0}
            max={20}
            onChange={() => {}}
            label="Rate"
            size={24}
          />
          <Knob
            value={0}
            min={0}
            max={1}
            onChange={() => {}}
            label="Depth"
            size={24}
          />
        </div>
        <span className="text-[7px] text-daw-text-muted/30">Future</span>
      </div>
      </div>
    </div>
  );
}
