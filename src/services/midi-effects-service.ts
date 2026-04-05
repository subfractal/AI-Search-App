import type { MidiNote } from '@/types/audio';
import type {
  ArpeggiatorParams,
  ChordParams,
  ScaleParams,
  TransposerParams,
  VelocityParams,
  NoteRepeatParams,
  HumanizeParams,
  MidiDelayParams,
} from '@/types/midi-effects';
import { SCALE_INTERVALS } from '@/types/midi-effects';

export function applyArpeggiator(
  notes: MidiNote[],
  params: ArpeggiatorParams,
): MidiNote[] {
  if (notes.length === 0) return notes;

  const pitches = [...new Set(notes.map((n) => n.pitch))].sort((a, b) => a - b);
  const expanded: number[] = [];
  for (let oct = 0; oct < params.octaves; oct++) {
    for (const p of pitches) expanded.push(p + oct * 12);
  }

  let ordered: number[];
  switch (params.mode) {
    case 'down': ordered = [...expanded].reverse(); break;
    case 'upDown': ordered = [...expanded, ...expanded.slice(1, -1).reverse()]; break;
    case 'random': ordered = expanded.sort(() => Math.random() - 0.5); break;
    default: ordered = expanded;
  }

  const baseTime = notes.length > 0 ? Math.min(...notes.map((n) => n.startTime)) : 0;
  const baseVel = notes.length > 0 ? Math.round(notes.reduce((s, n) => s + n.velocity, 0) / notes.length) : 100;

  return ordered.map((pitch, i) => ({
    pitch: Math.min(127, Math.max(0, pitch)),
    velocity: baseVel,
    startTime: baseTime + i * params.rate,
    duration: params.rate * params.gate,
  }));
}

export function applyChord(
  notes: MidiNote[],
  params: ChordParams,
): MidiNote[] {
  const result: MidiNote[] = [];
  for (const note of notes) {
    const intervals = [...params.intervals];
    // Apply inversion
    for (let inv = 0; inv < params.inversion && intervals.length > 1; inv++) {
      const first = intervals.shift()!;
      intervals.push(first + 12);
    }
    for (const interval of intervals) {
      result.push({
        ...note,
        pitch: Math.min(127, Math.max(0, note.pitch + interval)),
      });
    }
  }
  return result;
}

export function applyScale(
  notes: MidiNote[],
  params: ScaleParams,
): MidiNote[] {
  const intervals = SCALE_INTERVALS[params.scale] ?? SCALE_INTERVALS.chromatic;
  return notes.map((note) => {
    const relative = ((note.pitch - params.root) % 12 + 12) % 12;
    // Find closest scale degree
    let closest = intervals[0]!;
    let minDist = 12;
    for (const deg of intervals) {
      const dist = Math.min(Math.abs(relative - deg), 12 - Math.abs(relative - deg));
      if (dist < minDist) {
        minDist = dist;
        closest = deg;
      }
    }
    const octave = Math.floor((note.pitch - params.root) / 12);
    const newPitch = params.root + octave * 12 + closest;
    return { ...note, pitch: Math.min(127, Math.max(0, newPitch)) };
  });
}

export function applyTransposer(
  notes: MidiNote[],
  params: TransposerParams,
): MidiNote[] {
  return notes.map((n) => ({
    ...n,
    pitch: Math.min(127, Math.max(0, n.pitch + params.semitones)),
  }));
}

export function applyVelocityProcessor(
  notes: MidiNote[],
  params: VelocityParams,
): MidiNote[] {
  return notes.map((n) => {
    let vel = n.velocity;
    // Apply curve (1 = linear, >1 = compress, <1 = expand)
    const normalized = vel / 127;
    const curved = Math.pow(normalized, params.curve);
    vel = Math.round(curved * (params.max - params.min) + params.min);
    // Apply randomization
    if (params.randomize > 0) {
      vel += Math.round((Math.random() - 0.5) * 2 * params.randomize);
    }
    return { ...n, velocity: Math.min(127, Math.max(1, vel)) };
  });
}

export function applyNoteRepeat(
  notes: MidiNote[],
  params: NoteRepeatParams,
): MidiNote[] {
  const result: MidiNote[] = [];
  for (const note of notes) {
    for (let i = 0; i < params.divisions; i++) {
      const velMultiplier = Math.pow(params.decay, i);
      result.push({
        ...note,
        startTime: note.startTime + i * (note.duration / params.divisions),
        duration: (note.duration / params.divisions) * params.gate,
        velocity: Math.max(1, Math.round(note.velocity * velMultiplier)),
      });
    }
  }
  return result;
}

export function applyHumanize(
  notes: MidiNote[],
  params: HumanizeParams,
): MidiNote[] {
  return notes.map((n) => ({
    ...n,
    startTime: Math.max(0, n.startTime + (Math.random() - 0.5) * 2 * params.timingAmount),
    velocity: Math.min(127, Math.max(1,
      n.velocity + Math.round((Math.random() - 0.5) * 2 * params.velocityAmount),
    )),
  }));
}

export function applyMidiDelay(
  notes: MidiNote[],
  params: MidiDelayParams,
): MidiNote[] {
  const result: MidiNote[] = [...notes];
  const maxRepeats = Math.min(8, Math.ceil(1 / Math.max(0.01, 1 - params.feedback)));
  let current = notes;

  for (let i = 1; i <= maxRepeats; i++) {
    const velMultiplier = Math.pow(params.feedback, i);
    if (velMultiplier < 0.05) break;

    current = current.map((n) => ({
      ...n,
      startTime: n.startTime + params.time,
      pitch: Math.min(127, Math.max(0, n.pitch + params.transpose)),
      velocity: Math.max(1, Math.round(n.velocity * velMultiplier)),
    }));
    result.push(...current);
  }
  return result;
}
