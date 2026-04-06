import { useState, useEffect, useRef, useCallback } from 'react';
import { useTransportStore } from '@/stores/transport-store';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DEFAULT_OCTAVE = 4;
const PITCH_RANGE = 24; // 2 octaves
const DEFAULT_STEPS = 16;

interface StepNote {
  pitch: number;  // MIDI note number
  velocity: number;
  active: boolean;
}

interface StepSequencerProps {
  trackId: string;
  onStepChange?: (steps: StepNote[][]) => void;
}

function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12]!;
  return `${note}${octave}`;
}

export default function StepSequencer({ trackId, onStepChange }: StepSequencerProps) {
  const bpm = useTransportStore((s) => s.bpm);
  const transportState = useTransportStore((s) => s.state);

  const [stepCount, setStepCount] = useState(DEFAULT_STEPS);
  const [baseOctave, setBaseOctave] = useState(DEFAULT_OCTAVE);
  const [currentStep, setCurrentStep] = useState(-1);
  const [velocity, setVelocity] = useState(100);
  const [grid, setGrid] = useState<boolean[][]>(() =>
    Array.from({ length: PITCH_RANGE }, () =>
      Array.from({ length: DEFAULT_STEPS }, () => false),
    ),
  );

  const intervalRef = useRef<number>(0);

  // Sequencer playback
  useEffect(() => {
    if (transportState === 'playing') {
      const stepMs = (60000 / bpm) / 4; // 16th notes
      let step = 0;
      intervalRef.current = window.setInterval(() => {
        setCurrentStep(step % stepCount);
        step++;
      }, stepMs);
    } else {
      clearInterval(intervalRef.current);
      setCurrentStep(-1);
    }
    return () => clearInterval(intervalRef.current);
  }, [transportState, bpm, stepCount]);

  const baseMidi = (baseOctave + 1) * 12; // C of base octave

  const toggleNote = useCallback(
    (pitchIdx: number, stepIdx: number) => {
      setGrid((prev) => {
        const next = prev.map((row) => [...row]);
        next[pitchIdx]![stepIdx] = !next[pitchIdx]![stepIdx];
        return next;
      });
    },
    [],
  );

  const clearAll = useCallback(() => {
    setGrid(
      Array.from({ length: PITCH_RANGE }, () =>
        Array.from({ length: stepCount }, () => false),
      ),
    );
  }, [stepCount]);

  const updateStepCount = useCallback(
    (count: number) => {
      const clamped = Math.max(4, Math.min(64, count));
      setStepCount(clamped);
      setGrid((prev) =>
        prev.map((row) => {
          if (row.length >= clamped) return row.slice(0, clamped);
          return [...row, ...Array.from({ length: clamped - row.length }, () => false)];
        }),
      );
    },
    [],
  );

  // Notify parent of step changes
  useEffect(() => {
    if (!onStepChange) return;
    const steps: StepNote[][] = [];
    for (let s = 0; s < stepCount; s++) {
      const stepNotes: StepNote[] = [];
      for (let p = 0; p < PITCH_RANGE; p++) {
        if (grid[p]?.[s]) {
          stepNotes.push({
            pitch: baseMidi + (PITCH_RANGE - 1 - p),
            velocity,
            active: true,
          });
        }
      }
      steps.push(stepNotes);
    }
    onStepChange(steps);
  }, [grid, stepCount, baseMidi, velocity, onStepChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '2px solid #1a1a1c' }}>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono font-bold uppercase tracking-[3px] text-[#E63946]/90">
            POLY SEQ-{trackId.slice(-2).toUpperCase()}
          </span>
          <span className="text-xs font-medium text-daw-text">Step Sequencer</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Step count */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-daw-text-muted/60">STEPS</span>
            <select
              value={stepCount}
              onChange={(e) => updateStepCount(Number(e.target.value))}
              className="text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim font-mono"
            >
              {[4, 8, 16, 32, 64].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {/* Octave */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-daw-text-muted/60">OCT</span>
            <button
              onClick={() => setBaseOctave((o) => Math.max(0, o - 1))}
              className="text-[9px] px-1 bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim"
            >
              -
            </button>
            <span className="text-[9px] font-mono text-daw-text-dim w-4 text-center">
              {baseOctave}
            </span>
            <button
              onClick={() => setBaseOctave((o) => Math.min(7, o + 1))}
              className="text-[9px] px-1 bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim"
            >
              +
            </button>
          </div>
          {/* Velocity */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-mono text-daw-text-muted/60">VEL</span>
            <input
              type="number"
              min={1}
              max={127}
              value={velocity}
              onChange={(e) => setVelocity(Math.max(1, Math.min(127, Number(e.target.value))))}
              className="w-8 text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim font-mono text-center"
            />
          </div>
          {/* Clear */}
          <button
            onClick={clearAll}
            className="text-[8px] font-mono px-1.5 py-0.5 bg-daw-bg/60 text-daw-text-muted
                       hover:text-[#E63946] transition-colors uppercase tracking-wide"
          >
            Clear
          </button>
          <span className="text-[8px] font-mono text-daw-text-muted/40">
            {bpm} BPM
          </span>
        </div>
      </div>

      {/* Grid area */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Pitch labels (left side) */}
          <div className="shrink-0 flex flex-col sticky left-0 z-10 bg-daw-surface">
            {Array.from({ length: PITCH_RANGE }, (_, i) => {
              const midi = baseMidi + (PITCH_RANGE - 1 - i);
              const isBlackKey = [1, 3, 6, 8, 10].includes(midi % 12);
              const isC = midi % 12 === 0;
              return (
                <div
                  key={i}
                  className={`h-4 w-10 flex items-center justify-end pr-1 text-[7px] font-mono
                             border-b border-daw-border/10
                             ${isC ? 'text-daw-text-dim font-medium' : 'text-daw-text-muted/40'}
                             ${isBlackKey ? 'bg-daw-bg/40' : ''}`}
                >
                  {midiToName(midi)}
                </div>
              );
            })}
          </div>

          {/* Step grid */}
          <div className="flex-1">
            {Array.from({ length: PITCH_RANGE }, (_, pitchIdx) => {
              const midi = baseMidi + (PITCH_RANGE - 1 - pitchIdx);
              const isBlackKey = [1, 3, 6, 8, 10].includes(midi % 12);
              const isC = midi % 12 === 0;

              return (
                <div key={pitchIdx} className="flex h-4">
                  {Array.from({ length: stepCount }, (_, stepIdx) => {
                    const isOn = grid[pitchIdx]?.[stepIdx] ?? false;
                    const isActive = stepIdx === currentStep;
                    const isBeatStart = stepIdx % 4 === 0;

                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleNote(pitchIdx, stepIdx)}
                        className={`w-5 min-w-[20px] h-4 flex items-center justify-center
                                   border-r border-b transition-all duration-50
                                   ${isC ? 'border-b-daw-border/30' : 'border-b-daw-border/8'}
                                   ${isBeatStart ? 'border-r-daw-border/25' : 'border-r-daw-border/8'}
                                   ${isBlackKey ? 'bg-daw-bg/60' : 'bg-daw-bg/30'}
                                   ${isActive ? 'bg-[#E63946]/8' : ''}
                                   hover:bg-[#E63946]/15`}
                      >
                        {isOn && (
                          <div
                            className={`w-2.5 h-2.5 rounded-full
                                       ${isActive
                            ? 'bg-[#E63946] shadow-[0_0_6px_rgba(230,57,70,0.5)]'
                            : 'bg-[#E63946]/80'}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step markers at bottom */}
        <div className="flex sticky bottom-0 bg-daw-surface border-t border-daw-border/20">
          <div className="w-10 shrink-0" />
          <div className="flex flex-1">
            {Array.from({ length: stepCount }, (_, i) => (
              <div
                key={i}
                className={`w-5 min-w-[20px] text-center text-[6px] font-mono py-0.5
                           ${i === currentStep ? 'text-[#E63946] font-bold' : ''}
                           ${i % 4 === 0 ? 'text-daw-text-muted' : 'text-daw-text-muted/30'}`}
              >
                {i % 4 === 0 ? i / 4 + 1 : '\u00B7'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
