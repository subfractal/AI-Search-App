import * as Tone from 'tone';
import { triggerDrumSound } from './instrument-service';
import { useInstrumentStore } from '@/stores/instrument-store';

let sequenceId: number | null = null;
let activeTrackId: string | null = null;
let currentStep = 0;

export function startDrumSequencer(trackId: string, bpm: number): void {
  stopDrumSequencer();
  activeTrackId = trackId;
  currentStep = 0;

  const stepDuration = (60 / bpm) / 4; // 16th notes

  sequenceId = Tone.getTransport().scheduleRepeat((time) => {
    const config = useInstrumentStore.getState().instruments[trackId];
    if (!config?.drumPattern) return;

    const { steps, sounds } = config.drumPattern;

    for (let i = 0; i < sounds.length; i++) {
      const row = steps[i];
      if (row && row[currentStep]) {
        const sound = sounds[i];
        if (sound) {
          triggerDrumSound(trackId, sound.id, sound.params, time);
        }
      }
    }

    currentStep = (currentStep + 1) % config.drumPattern.stepCount;
  }, stepDuration);
}

export function stopDrumSequencer(): void {
  if (sequenceId !== null) {
    Tone.getTransport().clear(sequenceId);
    sequenceId = null;
  }
  activeTrackId = null;
  currentStep = 0;
}

export function getCurrentStep(): number {
  return currentStep;
}

export function getActiveTrackId(): string | null {
  return activeTrackId;
}

export function isSequencerRunning(): boolean {
  return sequenceId !== null;
}
