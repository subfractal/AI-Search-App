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
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-daw-text">Drum Machine</span>
        <span className="text-xxs text-daw-text-muted tabular-nums">
          {bpm} BPM
        </span>
      </div>

      {/* Step grid */}
      <div className="flex flex-col gap-px">
        {pattern.sounds.map((sound, soundIdx) => (
          <div key={sound.id} className="flex items-center gap-1">
            {/* Sound name */}
            <button
              onClick={() => previewSound(soundIdx)}
              className="w-14 text-xxs text-daw-text-dim text-left truncate
                         hover:text-daw-accent transition-colors shrink-0 py-0.5"
              title={`Preview ${sound.name}`}
            >
              {sound.name}
            </button>

            {/* Steps */}
            <div className="flex gap-px flex-1">
              {Array.from({ length: pattern.stepCount }, (_, stepIdx) => {
                const isOn = pattern.steps[soundIdx]?.[stepIdx] ?? false;
                const isActive = stepIdx === activeStep;
                const isBarStart = stepIdx % 4 === 0;

                return (
                  <button
                    key={stepIdx}
                    onClick={() => toggleStep(trackId, soundIdx, stepIdx)}
                    className={`h-5 flex-1 rounded-sm transition-all duration-75
                               ${isOn
                        ? isActive
                          ? 'bg-daw-accent shadow-[0_0_6px_rgba(255,107,53,0.4)]'
                          : 'bg-daw-accent/70 hover:bg-daw-accent'
                        : isActive
                          ? 'bg-daw-panel-hover border border-daw-accent/30'
                          : isBarStart
                            ? 'bg-daw-surface-alt hover:bg-daw-panel border border-daw-border/20'
                            : 'bg-daw-bg hover:bg-daw-surface border border-daw-border/10'
                      }`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Step numbers */}
      <div className="flex items-center gap-1">
        <div className="w-14" />
        <div className="flex gap-px flex-1">
          {Array.from({ length: pattern.stepCount }, (_, i) => (
            <span
              key={i}
              className={`flex-1 text-center text-[7px] leading-none
                         ${i % 4 === 0 ? 'text-daw-text-muted' : 'text-daw-text-muted/40'}`}
            >
              {i % 4 === 0 ? i / 4 + 1 : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
