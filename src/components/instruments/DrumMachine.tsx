import { useState, useEffect, useRef, useCallback } from 'react';
import { useInstrumentStore } from '@/stores/instrument-store';
import { useTransportStore } from '@/stores/transport-store';
import { triggerDrumSound } from '@/services/instrument-service';
import {
  startDrumSequencer,
  stopDrumSequencer,
  getCurrentStep,
  isSequencerRunning,
} from '@/services/drum-sequencer';

interface DrumMachineProps {
  trackId: string;
}

export default function DrumMachine({ trackId }: DrumMachineProps) {
  const config = useInstrumentStore((s) => s.instruments[trackId]);
  const toggleStep = useInstrumentStore((s) => s.toggleDrumStep);
  const bpm = useTransportStore((s) => s.bpm);
  const transportState = useTransportStore((s) => s.state);
  const [activeStep, setActiveStep] = useState(-1);
  const rafRef = useRef<number>(0);

  const pattern = config?.drumPattern;

  // Sync step indicator with sequencer
  const updateStep = useCallback(() => {
    if (isSequencerRunning()) {
      setActiveStep(getCurrentStep());
    } else {
      setActiveStep(-1);
    }
    rafRef.current = requestAnimationFrame(updateStep);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateStep);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateStep]);

  // Start/stop sequencer with transport
  useEffect(() => {
    if (transportState === 'playing') {
      startDrumSequencer(trackId, bpm);
    } else {
      stopDrumSequencer();
    }
    return () => stopDrumSequencer();
  }, [transportState, trackId, bpm]);

  if (!pattern) return null;

  const previewSound = (soundIndex: number) => {
    const sound = pattern.sounds[soundIndex];
    if (sound) {
      triggerDrumSound(trackId, sound.id, sound.params);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Header — industrial naming */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono uppercase tracking-[3px] text-[#E63946]/80">
            DKT-DRUM-SEQ-01
          </span>
          <span className="text-xs font-medium text-daw-text">Drum Machine</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xxs text-daw-text-muted tabular-nums font-mono">
            {bpm} BPM
          </span>
          <span className="text-[8px] font-mono text-daw-text-muted/40">
            {pattern.stepCount} STEPS
          </span>
        </div>
      </div>

      {/* Step grid — red dot aesthetic */}
      <div className="flex flex-col gap-0.5">
        {pattern.sounds.map((sound, soundIdx) => (
          <div key={sound.id} className="flex items-center gap-1.5">
            {/* Sound name — industrial label */}
            <button
              onClick={() => previewSound(soundIdx)}
              className="w-16 text-[9px] font-mono text-daw-text-dim text-left truncate
                         hover:text-[#E63946] transition-colors shrink-0 py-0.5
                         uppercase tracking-wide"
              title={`Preview ${sound.name}`}
            >
              {sound.name}
            </button>

            {/* Steps — red dot grid */}
            <div className="flex gap-0.5 flex-1">
              {Array.from({ length: pattern.stepCount }, (_, stepIdx) => {
                const isOn = pattern.steps[soundIdx]?.[stepIdx] ?? false;
                const isActive = stepIdx === activeStep;
                const isBarStart = stepIdx % 4 === 0;

                return (
                  <button
                    key={stepIdx}
                    onClick={() => toggleStep(trackId, soundIdx, stepIdx)}
                    className={`h-5 flex-1 flex items-center justify-center transition-all duration-75
                               ${isBarStart && !isOn ? 'bg-daw-surface-alt' : 'bg-daw-bg'}
                               ${isActive ? 'ring-1 ring-[#E63946]/40' : ''}
                               border border-daw-border/15 hover:border-daw-border/40`}
                  >
                    {/* Red dot indicator */}
                    <div
                      className={`rounded-full transition-all duration-75
                                 ${isOn
                          ? isActive
                            ? 'w-3 h-3 bg-[#E63946] shadow-[0_0_8px_rgba(230,57,70,0.6)]'
                            : 'w-2.5 h-2.5 bg-[#E63946]/85 hover:bg-[#E63946]'
                          : isActive
                            ? 'w-1.5 h-1.5 bg-daw-text-muted/20'
                            : 'w-1 h-1 bg-daw-border/40 group-hover:bg-daw-border'
                        }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Step numbers — beat markers */}
      <div className="flex items-center gap-1.5">
        <div className="w-16" />
        <div className="flex gap-0.5 flex-1">
          {Array.from({ length: pattern.stepCount }, (_, i) => (
            <span
              key={i}
              className={`flex-1 text-center text-[7px] font-mono leading-none
                         ${i % 4 === 0 ? 'text-daw-text-muted' : 'text-daw-text-muted/30'}`}
            >
              {i % 4 === 0 ? i / 4 + 1 : '\u00B7'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
