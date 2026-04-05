import { generateId } from '@/utils/id';
import type { MidiClip, MidiNote } from '@/types/audio';
import type { DrumPattern } from '@/types/instruments';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function interpolateClips(
  clipA: MidiClip,
  clipB: MidiClip,
  steps: number,
  trackId: string,
): MidiClip[] {
  const results: MidiClip[] = [];
  const maxLen = Math.max(clipA.notes.length, clipB.notes.length);

  // Pad shorter clip by repeating its notes cyclically
  const notesA = padNotes(clipA.notes, maxLen);
  const notesB = padNotes(clipB.notes, maxLen);

  for (let step = 1; step <= steps; step++) {
    const t = step / (steps + 1);
    const notes: MidiNote[] = [];

    for (let i = 0; i < maxLen; i++) {
      const a = notesA[i]!;
      const b = notesB[i]!;
      notes.push({
        pitch: Math.round(lerp(a.pitch, b.pitch, t)),
        velocity: Math.round(lerp(a.velocity, b.velocity, t)),
        startTime: lerp(a.startTime, b.startTime, t),
        duration: lerp(a.duration, b.duration, t),
      });
    }

    results.push({
      id: generateId('clip'),
      trackId,
      name: `Morph ${step}/${steps}`,
      notes,
      startTime: 0,
      duration: lerp(clipA.duration, clipB.duration, t),
    });
  }

  return results;
}

function padNotes(notes: MidiNote[], targetLen: number): MidiNote[] {
  if (notes.length === 0) {
    return Array.from({ length: targetLen }, () => ({
      pitch: 60, velocity: 64, startTime: 0, duration: 0.5,
    }));
  }
  const padded: MidiNote[] = [];
  for (let i = 0; i < targetLen; i++) {
    padded.push(notes[i % notes.length]!);
  }
  return padded;
}

export function morphDrumPatterns(
  patternA: DrumPattern,
  patternB: DrumPattern,
  t: number,
): DrumPattern {
  const rows = Math.max(patternA.steps.length, patternB.steps.length);
  const cols = Math.max(patternA.stepCount, patternB.stepCount);
  const steps: boolean[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const a = patternA.steps[r]?.[c] ?? false;
      const b = patternB.steps[r]?.[c] ?? false;

      if (a === b) {
        row.push(a);
      } else {
        // Probabilistic: at t=0 favor A, at t=1 favor B
        row.push(Math.random() < t ? b : a);
      }
    }
    steps.push(row);
  }

  return {
    steps,
    stepCount: cols,
    sounds: patternA.sounds.length >= patternB.sounds.length
      ? patternA.sounds
      : patternB.sounds,
  };
}
