import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { useLibraryStore } from '@/stores/library-store';
import { generateId } from '@/utils/id';
import { isMidiClip } from '@/types/audio';
import type { ComposerResult, GeneratorModel, MusicalRole } from '@/types/ai';
import type { MidiClip, MidiNote } from '@/types/audio';
import {
  encodePattern,
  decodePattern,
  crossover,
  mutate,
  evolvePopulation,
} from '@/services/ai/genetic-generator';

const MODEL_LABELS: Record<GeneratorModel, string> = {
  markov: 'Markov',
  lstm: 'LSTM',
  vae: 'VAE',
  gan: 'GAN',
  evolutionary: 'Evo',
  diffusion: 'Diffusion',
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

// Role-aware generation parameters
interface RoleConfig {
  rootRange: number[];   // MIDI root note candidates
  octaveSpan: number;    // how many octaves to span
  durPool: number[];     // default note durations (beats)
  denseDurPool: number[]; // durations when density > 0.7
  velocityBase: number;
  chordTones?: boolean;  // generate chords (multiple simultaneous notes)
  preferredDegrees?: number[]; // scale degrees to favor
}

const ROLE_CONFIGS: Record<MusicalRole, RoleConfig> = {
  bass: { rootRange: [28, 31, 33, 35, 36], octaveSpan: 1, durPool: [1, 2, 2, 4], denseDurPool: [0.5, 1, 1, 2], velocityBase: 90, preferredDegrees: [0, 2, 4, 6] },
  lead: { rootRange: [60, 62, 64, 65, 67], octaveSpan: 2, durPool: [0.25, 0.5, 1, 1], denseDurPool: [0.25, 0.25, 0.5, 0.5], velocityBase: 85 },
  pad: { rootRange: [48, 50, 52, 53, 55], octaveSpan: 2, durPool: [2, 4, 4, 8], denseDurPool: [1, 2, 2, 4], velocityBase: 60, chordTones: true },
  chords: { rootRange: [48, 50, 52, 53, 55], octaveSpan: 2, durPool: [1, 2, 2, 4], denseDurPool: [0.5, 1, 1, 2], velocityBase: 75, chordTones: true },
  arp: { rootRange: [55, 57, 59, 60, 62], octaveSpan: 2, durPool: [0.25, 0.25, 0.5], denseDurPool: [0.125, 0.25, 0.25], velocityBase: 70 },
  drums: { rootRange: [36, 36, 36, 36], octaveSpan: 0, durPool: [0.25, 0.5, 0.5, 1], denseDurPool: [0.25, 0.25, 0.25, 0.5], velocityBase: 95 },
  percussion: { rootRange: [42, 44, 46, 49, 51], octaveSpan: 0, durPool: [0.25, 0.5, 0.5], denseDurPool: [0.25, 0.25, 0.5], velocityBase: 80 },
  fx: { rootRange: [60, 64, 67, 72, 76], octaveSpan: 3, durPool: [0.5, 1, 2, 4], denseDurPool: [0.25, 0.5, 1, 2], velocityBase: 55 },
  vocal: { rootRange: [55, 57, 59, 60, 62], octaveSpan: 1.5, durPool: [0.5, 1, 1, 2], denseDurPool: [0.25, 0.5, 0.5, 1], velocityBase: 80 },
  general: { rootRange: [48, 50, 52, 53, 55, 57, 59], octaveSpan: 2, durPool: [0.5, 1, 1, 2], denseDurPool: [0.25, 0.5, 0.5, 1], velocityBase: 82 },
};

// Drum note map for GM-like mapping
const DRUM_NOTES = [36, 38, 42, 46, 44, 49, 51, 39, 56, 75]; // kick, snare, hihat, open-hh, pedal-hh, crash, ride, clap, cowbell, claves

function createRng(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)] ?? items[0]!;
}

function generateDrumNotes(
  bars: number,
  density: number,
  _temperature: number,
  seed: number,
): MidiNote[] {
  const rng = createRng(seed);
  const beatsTotal = bars * 4;
  const notes: MidiNote[] = [];
  const sixteenth = 0.25;

  for (let step = 0; step < beatsTotal / sixteenth; step++) {
    const time = step * sixteenth;
    const beat = step % 16;

    // Kick on 1 and 9 (beat 1 and 3)
    if (beat === 0 || beat === 8) {
      notes.push({ pitch: 36, velocity: 100 + Math.round((rng() - 0.5) * 10), startTime: time, duration: sixteenth });
    }
    // Snare on 5 and 13 (beat 2 and 4)
    if (beat === 4 || beat === 12) {
      notes.push({ pitch: 38, velocity: 95 + Math.round((rng() - 0.5) * 10), startTime: time, duration: sixteenth });
    }
    // Hi-hat — density controls fill level
    if (density > 0.7) {
      // 16th hats
      notes.push({ pitch: 42, velocity: 60 + Math.round(rng() * 30), startTime: time, duration: sixteenth });
    } else if (density > 0.4 && beat % 2 === 0) {
      // 8th hats
      notes.push({ pitch: 42, velocity: 65 + Math.round(rng() * 25), startTime: time, duration: sixteenth });
    } else if (beat % 4 === 0) {
      // Quarter hats
      notes.push({ pitch: 42, velocity: 70, startTime: time, duration: sixteenth });
    }
    // Extra percussion hits based on density
    if (rng() < density * 0.15) {
      const extraNote = pick(rng, DRUM_NOTES.slice(3));
      notes.push({ pitch: extraNote, velocity: 50 + Math.round(rng() * 40), startTime: time, duration: sixteenth });
    }
  }

  return notes.sort((a, b) => a.startTime - b.startTime);
}

function generateNotes(
  model: GeneratorModel,
  bars: number,
  density: number,
  temperature: number,
  seed: number,
  role: MusicalRole = 'general',
): MidiNote[] {
  // Special drum generation path
  if (role === 'drums' || role === 'percussion') {
    return generateDrumNotes(bars, density, temperature, seed);
  }

  const rng = createRng(seed);
  const beatsTotal = bars * 4;
  const scale = rng() > 0.5 ? MAJOR : MINOR;
  const roleConfig = ROLE_CONFIGS[role];
  const root = pick(rng, roleConfig.rootRange);
  const notes: MidiNote[] = [];
  let time = 0;
  let prevDegree = 0;

  while (time < beatsTotal) {
    const durPool = density > 0.7 ? roleConfig.denseDurPool : roleConfig.durPool;
    const duration = Math.min(pick(rng, durPool), beatsTotal - time);
    const gate = rng();

    if (gate < clamp01(density + 0.15)) {
      let degree = prevDegree;

      switch (model) {
        case 'markov': {
          const transitions: Record<number, number[]> = {
            0: [0, 2, 4],
            1: [0, 2, 4],
            2: [1, 3, 4],
            3: [2, 4, 5],
            4: [0, 2, 5],
            5: [0, 3, 4],
            6: [4, 5, 0],
          };
          degree = pick(rng, transitions[prevDegree % 7] ?? [0, 2, 4]);
          break;
        }
        case 'lstm':
          degree = (prevDegree + pick(rng, [0, 1, -1, 2])) % 7;
          break;
        case 'vae':
          degree = Math.floor(rng() * 7 * clamp01(temperature + 0.4)) % 7;
          break;
        case 'gan':
          degree = pick(rng, roleConfig.preferredDegrees ?? [0, 2, 4, 5, 6]);
          break;
        case 'evolutionary':
          degree = (prevDegree + pick(rng, [-2, -1, 1, 2, 3])) % 7;
          break;
        case 'diffusion':
          degree = Math.floor(rng() * 7);
          break;
      }

      if (degree < 0) degree += 7;
      const octaveMax = Math.floor(roleConfig.octaveSpan);
      const octave = model === 'diffusion' && rng() > 0.7 ? 12 * Math.min(octaveMax, 1) : 0;
      const pitch = root + scale[degree]! + octave;
      const velocity = Math.max(40, Math.min(120, Math.round(
        roleConfig.velocityBase + (rng() - 0.5) * 40 * (temperature + 0.2),
      )));
      notes.push({ pitch, velocity, startTime: time, duration });

      // Add chord tones for pad/chord roles
      if (roleConfig.chordTones && rng() > 0.3) {
        const third = scale[(degree + 2) % 7]!;
        const fifth = scale[(degree + 4) % 7]!;
        notes.push({ pitch: root + third + octave, velocity: Math.round(velocity * 0.85), startTime: time, duration });
        if (rng() > 0.4) {
          notes.push({ pitch: root + fifth + octave, velocity: Math.round(velocity * 0.75), startTime: time, duration });
        }
      }

      prevDegree = degree;
    }

    time += duration;
  }

  // Arp role: sort notes by pitch within each beat for arpeggiation effect
  if (role === 'arp') {
    const sorted = notes.sort((a, b) => a.startTime - b.startTime || a.pitch - b.pitch);
    return sorted;
  }

  // Evolutionary model: run real genetic algorithm when existing clips exist
  if (model === 'evolutionary' && notes.length > 4) {
    const existingNotes = collectExistingMidiNotes();
    if (existingNotes.length > 4) {
      // Use existing clips as parent population alongside the generated notes
      const generatedClip: MidiClip = {
        id: 'tmp', trackId: 'tmp', name: 'tmp',
        notes, startTime: 0, duration: bars * 4,
      };
      const parentChrom = encodePattern(generatedClip);

      // Build a small population from existing material + generated
      const existingChrom = existingNotes.slice(0, notes.length).map(
        (n) => [n.pitch, n.velocity, n.startTime, n.duration],
      );
      const pop = [parentChrom];
      // Add crossover offspring with existing material
      for (let i = 0; i < 5; i++) {
        pop.push(crossover(parentChrom, existingChrom.length > 0 ? existingChrom : parentChrom, rng));
      }
      // Mutate each member
      const mutated = pop.map((ch) => mutate(ch, 0.15 * temperature, rng));
      // Simple fitness: prefer medium-range pitches, moderate velocity, rhythmic variety
      const fitness = mutated.map((ch) => {
        let f = 0;
        for (const gene of ch) {
          const pitch = gene[0] ?? 60;
          const vel = gene[1] ?? 80;
          f += pitch >= 40 && pitch <= 90 ? 1 : 0;
          f += vel >= 50 && vel <= 110 ? 0.5 : 0;
        }
        return f;
      });
      const evolved = evolvePopulation(mutated, fitness, 0.1, 0.15 * temperature, seed);
      // Pick the best evolved individual
      const best = evolved[0] ?? parentChrom;
      const decoded = decodePattern(best, 'tmp', 'Evolved');
      return decoded.notes.slice(0, notes.length * 2).sort((a, b) => a.startTime - b.startTime);
    } else {
      // Fallback: light mutation
      for (let i = 1; i < notes.length; i += 4) {
        notes[i] = { ...notes[i]!, pitch: notes[i]!.pitch + (rng() > 0.5 ? 2 : -2) };
      }
    }
  }

  return notes.sort((a, b) => a.startTime - b.startTime);
}

export function generateComposition(): ComposerResult | null {
  const session = useSessionStore.getState();
  const ai = useAIStore.getState();
  const settings = ai.composer;

  let trackId: string = session.selectedTrackId ?? '';
  const selected = session.tracks.find((t) => t.id === trackId);

  const roleLabel = settings.role !== 'general' ? ` ${settings.role}` : '';

  if (!selected || selected.type !== 'midi') {
    trackId = session.addMidiTrack(`AI${roleLabel} ${MODEL_LABELS[settings.model]} ${settings.bars}bar`);
  }

  const notes = generateNotes(
    settings.model,
    settings.bars,
    settings.density,
    settings.temperature,
    settings.seed,
    settings.role,
  );

  const clip: MidiClip = {
    id: generateId('clip'),
    trackId,
    name: `AI${roleLabel} ${MODEL_LABELS[settings.model]} ${settings.bars}bar`,
    notes,
    startTime: 0,
    duration: settings.bars * 4,
  };

  session.addClipToTrack(trackId, clip);

  // Save to library for reuse
  useLibraryStore.getState().saveClipAsAsset(
    clip,
    clip.name,
    [settings.model, `${settings.bars}bar`, settings.role],
    true,
  );

  ai.logActivity({
    id: generateId('log'),
    description: `Generated ${notes.length} notes using ${MODEL_LABELS[settings.model]} (${settings.bars} bars)`,
    trackId,
    timestamp: Date.now(),
    undoable: false,
  });

  return {
    trackId,
    clipId: clip.id,
    noteCount: notes.length,
    model: settings.model,
    bars: settings.bars,
  };
}

// --- Real Markov Chain Learning from existing MIDI clips ---

type TransitionMatrix = Map<string, Map<number, number>>;

export function buildTransitionMatrix(
  notes: MidiNote[],
  order: number = 1,
): TransitionMatrix {
  const matrix: TransitionMatrix = new Map();
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  for (let i = order; i < sorted.length; i++) {
    const context = sorted
      .slice(i - order, i)
      .map((n) => n.pitch)
      .join(',');
    const next = sorted[i]!.pitch;

    if (!matrix.has(context)) {
      matrix.set(context, new Map());
    }
    const counts = matrix.get(context)!;
    counts.set(next, (counts.get(next) ?? 0) + 1);
  }

  return matrix;
}

function sampleFromMatrix(
  matrix: TransitionMatrix,
  context: string,
  rng: () => number,
): number | null {
  const counts = matrix.get(context);
  if (!counts || counts.size === 0) return null;

  let total = 0;
  for (const c of counts.values()) total += c;

  let r = rng() * total;
  for (const [pitch, count] of counts.entries()) {
    r -= count;
    if (r <= 0) return pitch;
  }
  return counts.keys().next().value ?? null;
}

function collectExistingMidiNotes(): MidiNote[] {
  const session = useSessionStore.getState();
  const allNotes: MidiNote[] = [];
  for (const track of session.tracks) {
    for (const clip of track.clips) {
      if (isMidiClip(clip)) {
        allNotes.push(...clip.notes);
      }
    }
  }
  return allNotes;
}

export function generateVariation(
  sourceClip: MidiClip,
  amount: number,
  seed: number,
): MidiClip {
  const rng = createRng(seed);
  const allNotes = collectExistingMidiNotes();
  const matrix = buildTransitionMatrix(
    allNotes.length > 10 ? allNotes : sourceClip.notes,
    1,
  );

  const newNotes: MidiNote[] = sourceClip.notes.map((note) => {
    if (rng() > amount) return { ...note };

    const context = `${note.pitch}`;
    const newPitch = sampleFromMatrix(matrix, context, rng);

    return {
      ...note,
      pitch: newPitch ?? note.pitch + Math.round((rng() - 0.5) * 4),
      velocity: Math.max(1, Math.min(127,
        note.velocity + Math.round((rng() - 0.5) * 20 * amount),
      )),
    };
  });

  const variation: MidiClip = {
    id: generateId('clip'),
    trackId: sourceClip.trackId,
    name: `Variation of ${sourceClip.name}`,
    notes: newNotes,
    startTime: 0,
    duration: sourceClip.duration,
  };

  useAIStore.getState().logActivity({
    id: generateId('log'),
    description: `Created variation of "${sourceClip.name}" (${newNotes.length} notes, ${Math.round(amount * 100)}% change)`,
    trackId: sourceClip.trackId,
    timestamp: Date.now(),
    undoable: false,
  });

  return variation;
}
