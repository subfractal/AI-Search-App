import { generateId } from '@/utils/id';
import type { MidiClip, MidiNote } from '@/types/audio';
import type { DrumPattern } from '@/types/instruments';

type Chromosome = number[][];

function createRng(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function encodePattern(clip: MidiClip): Chromosome {
  return clip.notes.map((n) => [n.pitch, n.velocity, n.startTime, n.duration]);
}

export function decodePattern(
  chromosome: Chromosome,
  trackId: string,
  name: string = 'Evolved Pattern',
): MidiClip {
  const notes: MidiNote[] = chromosome.map((gene) => ({
    pitch: Math.max(0, Math.min(127, Math.round(gene[0]!))),
    velocity: Math.max(1, Math.min(127, Math.round(gene[1]!))),
    startTime: Math.max(0, gene[2]!),
    duration: Math.max(0.05, gene[3]!),
  }));

  const maxEnd = notes.reduce(
    (max, n) => Math.max(max, n.startTime + n.duration),
    0,
  );

  return {
    id: generateId('clip'),
    trackId,
    name,
    notes,
    startTime: 0,
    duration: Math.max(1, maxEnd),
  };
}

export function crossover(
  parentA: Chromosome,
  parentB: Chromosome,
  rng: () => number,
): Chromosome {
  if (parentA.length === 0) return [...parentB.map((g) => [...g])];
  if (parentB.length === 0) return [...parentA.map((g) => [...g])];

  const point = Math.floor(rng() * parentA.length);
  const child: Chromosome = [];

  // Rhythm (timing) from parentA, pitches from parentB
  for (let i = 0; i < Math.max(parentA.length, parentB.length); i++) {
    if (i < point) {
      child.push([...(parentA[i] ?? parentB[i]!)]);
    } else {
      const a = parentA[i];
      const b = parentB[i];
      if (a && b) {
        // Mix: pitch/velocity from B, timing from A
        child.push([b[0]!, b[1]!, a[2]!, a[3]!]);
      } else {
        child.push([...(b ?? a!)]);
      }
    }
  }

  return child;
}

export function mutate(
  chromosome: Chromosome,
  rate: number,
  rng: () => number,
): Chromosome {
  return chromosome.map((gene) => {
    const mutated = [...gene];
    if (rng() < rate) mutated[0] = gene[0]! + Math.round((rng() - 0.5) * 4); // ±2 semitones
    if (rng() < rate) mutated[1] = gene[1]! + Math.round((rng() - 0.5) * 40); // ±20 velocity
    if (rng() < rate) mutated[2] = gene[2]! + (rng() - 0.5) * 0.25; // ±1/16th note
    if (rng() < rate * 0.5) mutated[3] = gene[3]! * (0.5 + rng()); // duration variation
    return mutated;
  });
}

export function evolvePopulation(
  population: Chromosome[],
  fitness: number[],
  eliteRate: number = 0.1,
  mutationRate: number = 0.15,
  seed: number = Date.now(),
): Chromosome[] {
  const rng = createRng(seed);
  const n = population.length;
  if (n === 0) return [];

  // Sort by fitness descending
  const indexed = population.map((chrom, i) => ({ chrom, fit: fitness[i] ?? 0 }));
  indexed.sort((a, b) => b.fit - a.fit);

  const eliteCount = Math.max(1, Math.floor(n * eliteRate));
  const next: Chromosome[] = [];

  // Keep elites
  for (let i = 0; i < eliteCount; i++) {
    next.push(indexed[i]!.chrom.map((g) => [...g]));
  }

  // Tournament selection + crossover + mutation for the rest
  while (next.length < n) {
    const a = tournamentSelect(indexed, rng);
    const b = tournamentSelect(indexed, rng);
    let child = crossover(a, b, rng);
    child = mutate(child, mutationRate, rng);
    next.push(child);
  }

  return next;
}

function tournamentSelect(
  pop: Array<{ chrom: Chromosome; fit: number }>,
  rng: () => number,
): Chromosome {
  const a = Math.floor(rng() * pop.length);
  const b = Math.floor(rng() * pop.length);
  return (pop[a]!.fit >= pop[b]!.fit ? pop[a]! : pop[b]!).chrom;
}

export function generateDrumVariation(
  pattern: DrumPattern,
  mutations: number,
  seed: number = Date.now(),
): DrumPattern {
  const rng = createRng(seed);
  const newSteps = pattern.steps.map((row) => [...row]);

  for (let m = 0; m < mutations; m++) {
    const row = Math.floor(rng() * newSteps.length);
    const col = Math.floor(rng() * pattern.stepCount);
    if (newSteps[row]) {
      newSteps[row]![col] = !newSteps[row]![col];
    }
  }

  return { ...pattern, steps: newSteps };
}
