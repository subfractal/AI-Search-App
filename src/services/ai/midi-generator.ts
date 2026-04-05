/**
 * Style-aware MIDI Generator — generates drum grooves, basslines,
 * arp patterns, chord comps, and melodies matching genre + chords.
 */

import type { MidiNote } from '@/types/audio';
import type { MixGenre } from '@/types/ai';
import type { MidiGeneratorConfig, GeneratorPattern } from '@/types/session-scan';

// Note constants
const C4 = 60;

// GM drum map subset
const KICK = 36;
const SNARE = 38;
const HIHAT = 42;
const OPEN_HAT = 46;
const CLAP = 39;
const TOM_LOW = 45;
const TOM_MID = 47;
const RIDE = 51;
const CRASH = 49;

// Scale intervals
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

// ─── Drum Patterns ───

interface DrumPattern {
  hits: Array<{ step: number; pitch: number; velocity: number }>;
  stepsPerBar: number;
}

const DRUM_PATTERNS: Record<MixGenre, DrumPattern> = {
  pop: {
    stepsPerBar: 16,
    hits: [
      { step: 0, pitch: KICK, velocity: 100 },
      { step: 4, pitch: SNARE, velocity: 90 },
      { step: 8, pitch: KICK, velocity: 95 },
      { step: 12, pitch: SNARE, velocity: 85 },
      ...Array.from({ length: 16 }, (_, i) => ({
        step: i, pitch: HIHAT, velocity: i % 2 === 0 ? 70 : 50,
      })),
    ],
  },
  edm: {
    stepsPerBar: 16,
    hits: [
      { step: 0, pitch: KICK, velocity: 110 },
      { step: 4, pitch: KICK, velocity: 105 },
      { step: 8, pitch: KICK, velocity: 110 },
      { step: 12, pitch: KICK, velocity: 105 },
      { step: 4, pitch: CLAP, velocity: 90 },
      { step: 12, pitch: CLAP, velocity: 85 },
      ...Array.from({ length: 8 }, (_, i) => ({
        step: i * 2, pitch: HIHAT, velocity: 60,
      })),
      { step: 7, pitch: OPEN_HAT, velocity: 65 },
      { step: 15, pitch: OPEN_HAT, velocity: 60 },
    ],
  },
  rock: {
    stepsPerBar: 16,
    hits: [
      { step: 0, pitch: KICK, velocity: 100 },
      { step: 6, pitch: KICK, velocity: 85 },
      { step: 8, pitch: KICK, velocity: 95 },
      { step: 4, pitch: SNARE, velocity: 100 },
      { step: 12, pitch: SNARE, velocity: 95 },
      ...Array.from({ length: 8 }, (_, i) => ({
        step: i * 2, pitch: HIHAT, velocity: 75,
      })),
      { step: 0, pitch: CRASH, velocity: 80 },
    ],
  },
  'hip-hop': {
    stepsPerBar: 16,
    hits: [
      { step: 0, pitch: KICK, velocity: 110 },
      { step: 5, pitch: KICK, velocity: 90 },
      { step: 10, pitch: KICK, velocity: 100 },
      { step: 4, pitch: SNARE, velocity: 95 },
      { step: 12, pitch: SNARE, velocity: 90 },
      ...Array.from({ length: 16 }, (_, i) => ({
        step: i, pitch: HIHAT, velocity: i % 4 === 0 ? 65 : 45,
      })),
    ],
  },
  jazz: {
    stepsPerBar: 12, // Swing triplets
    hits: [
      { step: 0, pitch: RIDE, velocity: 70 },
      { step: 2, pitch: RIDE, velocity: 55 },
      { step: 3, pitch: RIDE, velocity: 65 },
      { step: 5, pitch: RIDE, velocity: 50 },
      { step: 6, pitch: RIDE, velocity: 70 },
      { step: 8, pitch: RIDE, velocity: 55 },
      { step: 9, pitch: RIDE, velocity: 65 },
      { step: 11, pitch: RIDE, velocity: 50 },
      { step: 3, pitch: HIHAT, velocity: 60 },
      { step: 9, pitch: HIHAT, velocity: 55 },
    ],
  },
  classical: {
    stepsPerBar: 16,
    hits: [
      { step: 0, pitch: TOM_LOW, velocity: 60 },
      { step: 8, pitch: TOM_MID, velocity: 55 },
    ],
  },
  general: {
    stepsPerBar: 16,
    hits: [
      { step: 0, pitch: KICK, velocity: 100 },
      { step: 4, pitch: SNARE, velocity: 90 },
      { step: 8, pitch: KICK, velocity: 95 },
      { step: 12, pitch: SNARE, velocity: 85 },
      ...Array.from({ length: 8 }, (_, i) => ({
        step: i * 2, pitch: HIHAT, velocity: 65,
      })),
    ],
  },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getScaleNotes(key: string, scale: 'major' | 'minor', octave: number): number[] {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIndex = noteNames.indexOf(key);
  if (rootIndex === -1) return MAJOR_SCALE.map((i) => C4 + i);

  const intervals = scale === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const root = 12 * octave + rootIndex;
  return intervals.map((i) => root + i);
}

/**
 * Generate drum pattern MIDI notes.
 */
function generateDrums(
  config: MidiGeneratorConfig,
  seed: number,
): MidiNote[] {
  const rand = seededRandom(seed);
  const pattern = DRUM_PATTERNS[config.genre] ?? DRUM_PATTERNS.general;
  const stepDuration = (60 / 120) / (pattern.stepsPerBar / 4); // normalized to 120BPM
  const notes: MidiNote[] = [];

  for (let bar = 0; bar < config.bars; bar++) {
    for (const hit of pattern.hits) {
      // Complexity filter: skip some hits at low complexity
      if (rand() > config.complexity && hit.pitch !== KICK && hit.pitch !== SNARE) {
        continue;
      }
      const startTime = bar * (pattern.stepsPerBar * stepDuration) + hit.step * stepDuration;
      const swing = config.swing * stepDuration * 0.3 * (hit.step % 2 === 1 ? 1 : 0);
      notes.push({
        pitch: hit.pitch,
        velocity: Math.round(hit.velocity * (0.85 + rand() * 0.15) * (config.velocity / 100)),
        startTime: startTime + swing,
        duration: stepDuration * 0.8,
      });
    }
  }
  return notes;
}

/**
 * Generate bassline MIDI notes following scale.
 */
function generateBass(
  config: MidiGeneratorConfig,
  seed: number,
): MidiNote[] {
  const rand = seededRandom(seed);
  const scaleNotes = getScaleNotes(config.key, config.scale, config.octave - 1);
  const notes: MidiNote[] = [];
  const stepDuration = 60 / 120 / 4;
  const stepsPerBar = 16;

  for (let bar = 0; bar < config.bars; bar++) {
    const root = scaleNotes[0]!;
    const fifth = scaleNotes[4] ?? root;
    const barPattern = rand() > 0.5
      ? [root, root, fifth, root]
      : [root, scaleNotes[2] ?? root, fifth, root];

    for (let beat = 0; beat < 4; beat++) {
      const pitch = barPattern[beat]!;
      const startTime = bar * stepsPerBar * stepDuration + beat * 4 * stepDuration;
      const swing = config.swing * stepDuration * 0.2 * (beat % 2);

      if (rand() < config.complexity || beat === 0) {
        notes.push({
          pitch,
          velocity: Math.round((80 + rand() * 20) * (config.velocity / 100)),
          startTime: startTime + swing,
          duration: stepDuration * (rand() > 0.5 ? 3.5 : 2),
        });
      }

      // Sub-divisions at higher complexity
      if (config.complexity > 0.6 && rand() > 0.5) {
        const subPitch = scaleNotes[Math.floor(rand() * scaleNotes.length)]!;
        notes.push({
          pitch: subPitch,
          velocity: Math.round(65 * (config.velocity / 100)),
          startTime: startTime + 2 * stepDuration,
          duration: stepDuration * 1.5,
        });
      }
    }
  }
  return notes;
}

/**
 * Generate arpeggio pattern.
 */
function generateArp(
  config: MidiGeneratorConfig,
  seed: number,
): MidiNote[] {
  const rand = seededRandom(seed);
  const scaleNotes = getScaleNotes(config.key, config.scale, config.octave);
  const notes: MidiNote[] = [];
  const stepDuration = 60 / 120 / 4;
  const stepsPerBar = 16;

  // Create triad from scale
  const triad = [scaleNotes[0]!, scaleNotes[2]!, scaleNotes[4]!];
  if (scaleNotes[6]) triad.push(scaleNotes[6]);

  const directions = ['up', 'down', 'updown', 'random'] as const;
  const direction = directions[Math.floor(rand() * directions.length)]!;

  for (let bar = 0; bar < config.bars; bar++) {
    const divisions = config.complexity > 0.7 ? 16 : config.complexity > 0.4 ? 8 : 4;
    for (let step = 0; step < divisions; step++) {
      let noteIndex: number;
      if (direction === 'up') noteIndex = step % triad.length;
      else if (direction === 'down') noteIndex = (triad.length - 1 - step % triad.length);
      else if (direction === 'updown') {
        const cycle = triad.length * 2 - 2;
        const pos = step % (cycle || 1);
        noteIndex = pos < triad.length ? pos : cycle - pos;
      } else {
        noteIndex = Math.floor(rand() * triad.length);
      }

      const startTime = bar * stepsPerBar * stepDuration +
        step * (stepsPerBar / divisions) * stepDuration;
      notes.push({
        pitch: triad[noteIndex % triad.length]!,
        velocity: Math.round((70 + rand() * 25) * (config.velocity / 100)),
        startTime,
        duration: stepDuration * (stepsPerBar / divisions) * 0.8,
      });
    }
  }
  return notes;
}

/**
 * Generate chord comping pattern.
 */
function generateChordComp(
  config: MidiGeneratorConfig,
  seed: number,
): MidiNote[] {
  const rand = seededRandom(seed);
  const scaleNotes = getScaleNotes(config.key, config.scale, config.octave);
  const notes: MidiNote[] = [];
  const stepDuration = 60 / 120 / 4;
  const stepsPerBar = 16;

  // Simple chord voicings from scale degrees
  const chordDegrees = [
    [0, 2, 4],     // I
    [3, 5, 0],     // IV
    [4, 6, 1],     // V
    [5, 0, 2],     // vi
  ];

  for (let bar = 0; bar < config.bars; bar++) {
    const chord = chordDegrees[bar % chordDegrees.length]!;
    const voicing = chord.map((d) => scaleNotes[d % scaleNotes.length]!);

    // Whole note or rhythmic comping based on complexity
    if (config.complexity > 0.6) {
      const hits = [0, 3, 6, 10]; // Syncopated rhythm
      for (const hit of hits) {
        if (rand() > config.complexity * 0.8) continue;
        const startTime = bar * stepsPerBar * stepDuration + hit * stepDuration;
        for (const pitch of voicing) {
          notes.push({
            pitch,
            velocity: Math.round((75 + rand() * 20) * (config.velocity / 100)),
            startTime,
            duration: stepDuration * 2.5,
          });
        }
      }
    } else {
      // Sustained chords
      const startTime = bar * stepsPerBar * stepDuration;
      for (const pitch of voicing) {
        notes.push({
          pitch,
          velocity: Math.round((80 + rand() * 15) * (config.velocity / 100)),
          startTime,
          duration: stepsPerBar * stepDuration * 0.95,
        });
      }
    }
  }
  return notes;
}

/**
 * Generate simple melody.
 */
function generateMelody(
  config: MidiGeneratorConfig,
  seed: number,
): MidiNote[] {
  const rand = seededRandom(seed);
  const scaleNotes = getScaleNotes(config.key, config.scale, config.octave);
  const notes: MidiNote[] = [];
  const stepDuration = 60 / 120 / 4;
  const stepsPerBar = 16;

  let currentDegree = 0;

  for (let bar = 0; bar < config.bars; bar++) {
    const notesPerBar = Math.ceil(config.complexity * 8) + 2;
    let barTime = 0;

    for (let n = 0; n < notesPerBar && barTime < stepsPerBar; n++) {
      // Step motion with occasional leaps
      const leap = rand() > 0.7 ? Math.floor(rand() * 4) - 2 : (rand() > 0.5 ? 1 : -1);
      currentDegree = Math.max(0, Math.min(scaleNotes.length - 1, currentDegree + leap));

      const dur = rand() > 0.5 ? 2 : (rand() > 0.5 ? 4 : 1);
      const startTime = bar * stepsPerBar * stepDuration + barTime * stepDuration;

      // Occasional rest
      if (rand() > 0.8) {
        barTime += dur;
        continue;
      }

      notes.push({
        pitch: scaleNotes[currentDegree]!,
        velocity: Math.round((75 + rand() * 25) * (config.velocity / 100)),
        startTime,
        duration: dur * stepDuration * 0.85,
      });
      barTime += dur;
    }
  }
  return notes;
}

const GENERATORS: Record<GeneratorPattern, (config: MidiGeneratorConfig, seed: number) => MidiNote[]> = {
  drum: generateDrums,
  bass: generateBass,
  arp: generateArp,
  'chord-comp': generateChordComp,
  melody: generateMelody,
};

/**
 * Generate MIDI notes for a given pattern type and configuration.
 */
export function generateMidiPattern(config: MidiGeneratorConfig): MidiNote[] {
  const generator = GENERATORS[config.pattern];
  const seed = Date.now();
  return generator(config, seed);
}

/**
 * Get available pattern types.
 */
export function getAvailablePatterns(): GeneratorPattern[] {
  return Object.keys(GENERATORS) as GeneratorPattern[];
}
