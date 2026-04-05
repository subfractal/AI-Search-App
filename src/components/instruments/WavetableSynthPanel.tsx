import { useInstrumentStore } from '@/stores/instrument-store';
import Knob from '@/components/ui/Knob';
import type { FilterType } from '@/types/instruments';

interface WavetableSynthPanelProps {
  trackId: string;
}

const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass'];

export default function WavetableSynthPanel({ trackId }: WavetableSynthPanelProps) {
  const config = useInstrumentStore((s) => s.instruments[trackId]);
  const updateSynth = useInstrumentStore((s) => s.updateSynth);

  if (!config?.synthParams) {
    return (
      <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
        No wavetable parameters loaded
      </div>
    );
  }

  const p = config.synthParams;

  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="text-[9px] font-mono font-bold uppercase tracking-[3px] text-[#E63946]/90">WAVETABLE SYNTH</span>
      <div className="flex gap-4 overflow-x-auto">
      {/* Wavetable Morph Section */}
      <div className="flex flex-col gap-2 min-w-[160px]">
        <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          Wavetable
        </span>
        {/* Morph position visualizer */}
        <div className="h-12 bg-daw-bg/50 border border-daw-border/20 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-daw-accent/10"
            style={{ width: '50%' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[9px] text-daw-accent/60 font-mono">
            Position: 50%
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          defaultValue="50"
          className="w-full h-1 bg-daw-bg/50 appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:bg-daw-accent"
        />
        <span className="text-[7px] text-daw-text-muted/40">Morph Position</span>
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

      {/* Macro Knobs */}
      <div className="flex flex-col gap-2 min-w-[120px]">
        <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          Macros
        </span>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Knob
              key={n}
              value={0.5}
              min={0}
              max={1}
              onChange={() => {}}
              label={`M${n}`}
              size={24}
            />
          ))}
        </div>
      </div>

      {/* Envelope */}
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
      </div>
    </div>
  );
}
