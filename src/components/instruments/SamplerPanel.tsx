import { useInstrumentStore } from '@/stores/instrument-store';
import Knob from '@/components/ui/Knob';

interface SamplerPanelProps {
  trackId: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(note: number): string {
  const name = NOTE_NAMES[note % 12]!;
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave}`;
}

export default function SamplerPanel({ trackId }: SamplerPanelProps) {
  const config = useInstrumentStore((s) => s.instruments[trackId]);
  const updateSynth = useInstrumentStore((s) => s.updateSynth);

  if (!config?.synthParams) {
    return (
      <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
        No sampler parameters loaded
      </div>
    );
  }

  const p = config.synthParams;

  return (
    <div className="flex flex-col gap-2 p-3">
      <span className="text-[9px] font-mono font-bold uppercase tracking-[3px] text-[#E63946]/90">SAMPLER</span>
      <div className="flex gap-4 overflow-x-auto">
        {/* Sample Section */}
        <div className="flex flex-col gap-2 min-w-[180px]">
          <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          Sample
          </span>

          {/* File loader area */}
          <div className="h-16 bg-daw-bg/50 border border-daw-border/20 border-dashed
                        flex items-center justify-center cursor-pointer
                        hover:border-daw-accent/30 transition-colors">
            <span className="text-xxs text-daw-text-muted/40">
            Drop sample or click to load
            </span>
          </div>

          {/* Root note selector */}
          <div className="flex items-center gap-2">
            <span className="text-xxs text-daw-text-muted">Root</span>
            <select
              value="60"
              onChange={() => {}}
              className="text-[9px] bg-daw-bg border border-daw-border/30 px-1.5 py-0.5
                       text-daw-text-dim flex-1"
            >
              {Array.from({ length: 49 }, (_, i) => i + 36).map((note) => (
                <option key={note} value={note}>
                  {midiToNoteName(note)} ({note})
                </option>
              ))}
            </select>
          </div>

          {/* Loop toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xxs text-daw-text-muted">Loop</span>
            <button
              className="text-[9px] px-2 py-0.5 bg-daw-bg/40 text-daw-text-muted
                       border border-daw-border/20 hover:text-daw-accent"
            >
            OFF
            </button>
          </div>

          {/* Preview button */}
          <button
            className="text-xxs py-1 px-2 bg-daw-accent/15 text-daw-accent
                     hover:bg-daw-accent/25 transition-all"
          >
          Preview
          </button>
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
              size={28}
            />
            <Knob
              value={p.decay}
              min={0}
              max={2}
              onChange={(v) => updateSynth(trackId, { decay: v })}
              label="D"
              size={28}
            />
            <Knob
              value={p.sustain}
              min={0}
              max={1}
              onChange={(v) => updateSynth(trackId, { sustain: v })}
              label="S"
              size={28}
            />
            <Knob
              value={p.release}
              min={0}
              max={5}
              onChange={(v) => updateSynth(trackId, { release: v })}
              label="R"
              size={28}
            />
          </div>
        </div>

        {/* Filter (shared from SynthParams) */}
        <div className="flex flex-col gap-2 min-w-[80px]">
          <span className="text-[8px] uppercase tracking-wider text-daw-text-muted/50 font-medium">
          Filter
          </span>
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
      </div>
    </div>
  );
}
