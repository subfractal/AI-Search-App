import type { MidiClip, MidiNote } from '@/types/audio';
import { generateId } from '@/utils/id';

export type VariationType =
  | 'regenerate'
  | 'mutate-rhythm'
  | 'mutate-melody'
  | 'mutate-velocity'
  | 'mutate-density'
  | 'mutate-fill'
  | 'simplify'
  | 'embellish'
  | 'register-shift'
  | 'contour-invert';

export interface VariationRequest {
  sourceClipId: string;
  variationType: VariationType;
  intensity: number;
  preserveRhythm: boolean;
  preservePitchContour: boolean;
  preserveKit: boolean;
  bars?: number;
  seed?: number;
}

function createRng(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function mutateRhythm(
  notes: MidiNote[],
  intensity: number,
  rng: () => number,
): MidiNote[] {
  return notes.map((n) => {
    if (rng() > intensity) return n;
    const shift = (rng() - 0.5) * 0.5 * intensity;
    const durScale = 1 + (rng() - 0.5) * 0.4 * intensity;
    return {
      ...n,
      startTime: Math.max(0, n.startTime + shift),
      duration: Math.max(0.05, n.duration * durScale),
    };
  });
}

function mutateMelody(
  notes: MidiNote[],
  intensity: number,
  rng: () => number,
): MidiNote[] {
  const scale = [0, 2, 4, 5, 7, 9, 11];
  return notes.map((n) => {
    if (rng() > intensity) return n;
    const steps = Math.round((rng() - 0.5) * 4 * intensity);
    const degree = scale.indexOf(n.pitch % 12);
    if (degree === -1) return { ...n, pitch: clamp(n.pitch + steps, 24, 108) };
    const newDegree = ((degree + steps) % 7 + 7) % 7;
    const octaveShift = Math.floor((degree + steps) / 7) * 12;
    const base = Math.floor(n.pitch / 12) * 12;
    return { ...n, pitch: clamp(base + (scale[newDegree] ?? 0) + octaveShift, 24, 108) };
  });
}

function mutateVelocity(
  notes: MidiNote[],
  intensity: number,
  rng: () => number,
): MidiNote[] {
  return notes.map((n) => {
    if (rng() > intensity * 0.8) return n;
    const delta = Math.round((rng() - 0.5) * 40 * intensity);
    return { ...n, velocity: clamp(n.velocity + delta, 10, 127) };
  });
}

function mutateDensity(
  notes: MidiNote[],
  intensity: number,
  rng: () => number,
): MidiNote[] {
  const result: MidiNote[] = [];
  for (const n of notes) {
    if (rng() < intensity * 0.3) continue;
    result.push(n);
    if (rng() < intensity * 0.2) {
      result.push({
        ...n,
        startTime: n.startTime + n.duration * 0.5,
        duration: n.duration * 0.5,
        velocity: clamp(n.velocity - 15, 10, 127),
      });
    }
  }
  return result;
}

function generateFill(
  notes: MidiNote[],
  intensity: number,
  rng: () => number,
  duration: number,
): MidiNote[] {
  const result = [...notes];
  const fillStart = duration * (1 - 0.25 * intensity);
  const fillNotes = notes.filter((n) => n.startTime < duration * 0.5);
  for (const n of fillNotes) {
    if (rng() > intensity * 0.6) continue;
    const time = fillStart + rng() * (duration - fillStart);
    result.push({
      ...n,
      startTime: time,
      duration: Math.min(n.duration * 0.5, duration - time),
      velocity: clamp(n.velocity + Math.round(rng() * 20), 10, 127),
    });
  }
  return result;
}

function simplify(
  notes: MidiNote[],
  intensity: number,
): MidiNote[] {
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
  const keep = Math.max(1, Math.round(sorted.length * (1 - intensity * 0.6)));
  const strongest = [...sorted]
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, keep);
  return strongest.sort((a, b) => a.startTime - b.startTime);
}

function embellish(
  notes: MidiNote[],
  intensity: number,
  rng: () => number,
): MidiNote[] {
  const result: MidiNote[] = [];
  for (const n of notes) {
    result.push(n);
    if (rng() < intensity * 0.4) {
      const grace = rng() > 0.5 ? 1 : -1;
      result.push({
        ...n,
        pitch: clamp(n.pitch + grace, 24, 108),
        startTime: Math.max(0, n.startTime - 0.05),
        duration: 0.05,
        velocity: clamp(n.velocity - 20, 10, 127),
      });
    }
    if (rng() < intensity * 0.3) {
      result.push({
        ...n,
        startTime: n.startTime + n.duration,
        duration: n.duration * 0.25,
        velocity: clamp(n.velocity - 30, 10, 127),
      });
    }
  }
  return result;
}

function registerShift(
  notes: MidiNote[],
  intensity: number,
  rng: () => number,
): MidiNote[] {
  const direction = rng() > 0.5 ? 12 : -12;
  const amount = Math.round(intensity * 2) * direction;
  return notes.map((n) => ({
    ...n,
    pitch: clamp(n.pitch + (rng() < intensity ? amount : 0), 24, 108),
  }));
}

function contourInvert(
  notes: MidiNote[],
): MidiNote[] {
  if (notes.length < 2) return notes;
  const pitches = notes.map((n) => n.pitch);
  const center = Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length);
  return notes.map((n) => ({
    ...n,
    pitch: clamp(center - (n.pitch - center), 24, 108),
  }));
}

const VARIATION_MAP: Record<
  VariationType,
  (notes: MidiNote[], intensity: number, rng: () => number, duration: number) => MidiNote[]
> = {
  'regenerate': (notes, intensity, rng) =>
    mutateMelody(mutateRhythm(notes, intensity, rng), intensity, rng),
  'mutate-rhythm': (notes, intensity, rng) => mutateRhythm(notes, intensity, rng),
  'mutate-melody': (notes, intensity, rng) => mutateMelody(notes, intensity, rng),
  'mutate-velocity': (notes, intensity, rng) => mutateVelocity(notes, intensity, rng),
  'mutate-density': (notes, intensity, rng) => mutateDensity(notes, intensity, rng),
  'mutate-fill': (notes, intensity, rng, dur) => generateFill(notes, intensity, rng, dur),
  'simplify': (notes, intensity) => simplify(notes, intensity),
  'embellish': (notes, intensity, rng) => embellish(notes, intensity, rng),
  'register-shift': (notes, intensity, rng) => registerShift(notes, intensity, rng),
  'contour-invert': (notes) => contourInvert(notes),
};

export function generateVariation(
  request: VariationRequest,
  sourceClip: MidiClip,
): MidiClip {
  const seed = request.seed ?? Date.now();
  const rng = createRng(seed);
  const mutator = VARIATION_MAP[request.variationType];
  const mutatedNotes = mutator(
    [...sourceClip.notes],
    request.intensity,
    rng,
    sourceClip.duration,
  );

  return {
    id: generateId('clip'),
    trackId: sourceClip.trackId,
    name: `${sourceClip.name} [${request.variationType}]`,
    notes: mutatedNotes,
    startTime: sourceClip.startTime + sourceClip.duration,
    duration: request.bars ? request.bars * 4 : sourceClip.duration,
  };
}
