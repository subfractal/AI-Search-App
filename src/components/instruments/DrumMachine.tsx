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
    <div className="flex flex-col gap-2.5 p-3">
      {/* Header — industrial naming */}
      <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #1a1a1c' }}>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono uppercase tracking-[3px] text-[#E63946]/90 font-bold">
            DKT-DRUM-SEQ-01
          </span>
          <span className="text-xs font-medium text-daw-text">Drum Machine</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="daw-lcd px-2 py-0.5 text-[9px] font-mono">
            {bpm} BPM
          </span>
          <span className="text-[8px] font-mono text-daw-text-muted/50 uppercase tracking-wider">
            {pattern.stepCount} STEPS
          </span>
        </div>
      </div>

      {/* Step grid — red dot aesthetic */}
      <div className="flex flex-col gap-1 daw-inset p-2">
        {pattern.sounds.map((sound, soundIdx) => (
          <div key={sound.id} className="flex items-center gap-2">
            {/* Sound name — industrial label */}
            <button
              onClick={() => previewSound(soundIdx)}
              className="w-20 text-[9px] font-mono text-daw-text-dim text-left truncate
                         hover:text-[#E63946] transition-colors shrink-0 py-0.5
                         uppercase tracking-wide font-medium"
              title={`Preview ${sound.name}`}
            >
              {sound.name}
            </button>

            {/* Steps — red dot grid */}
            <div className="flex gap-1 flex-1">
              {Array.from({ length: pattern.stepCount }, (_, stepIdx) => {
                const isOn = pattern.steps[soundIdx]?.[stepIdx] ?? false;
                const isActive = stepIdx === activeStep;
                const isBarStart = stepIdx % 4 === 0;

                return (
                  <button
                    key={stepIdx}
                    onClick={() => toggleStep(trackId, soundIdx, stepIdx)}
                    className={`h-6 flex-1 flex items-center justify-center transition-all duration-75
                               ${isActive ? 'ring-1 ring-[#E63946]/50' : ''}`}
                    style={{
                      background: isBarStart && !isOn ? '#111113' : '#080808',
                      border: '1px solid #1a1a1c',
                      borderRadius: 0,
                      boxShadow: isOn ? 'inset 0 0 6px rgba(230,57,70,0.15)' : 'inset 0 1px 3px rgba(0,0,0,0.5)',
                    }}
                  >
                    {/* Red dot indicator */}
                    <div
                      className={`rounded-full transition-all duration-75
                                 ${isOn
                          ? isActive
                            ? 'w-3.5 h-3.5 bg-[#E63946] shadow-[0_0_12px_rgba(230,57,70,0.7)]'
                            : 'w-3 h-3 bg-[#E63946]/90 hover:bg-[#E63946]'
                          : isActive
                            ? 'w-2 h-2 bg-daw-text-muted/25'
                            : 'w-1.5 h-1.5 bg-daw-border/30'
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
      <div className="flex items-center gap-2">
        <div className="w-20" />
        <div className="flex gap-1 flex-1">
          {Array.from({ length: pattern.stepCount }, (_, i) => (
            <span
              key={i}
              className={`flex-1 text-center text-[8px] font-mono leading-none font-medium
                         ${i % 4 === 0 ? 'text-daw-text-muted' : 'text-daw-text-muted/25'}`}
            >
              {i % 4 === 0 ? i / 4 + 1 : '\u00B7'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
