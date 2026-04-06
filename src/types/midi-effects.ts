export type MidiEffectType =
  | 'arpeggiator'
  | 'chord'
  | 'scale'
  | 'transposer'
  | 'velocity'
  | 'noteRepeat'
  | 'humanize'
  | 'midiDelay';

export type ArpMode = 'up' | 'down' | 'upDown' | 'random';
export type ScaleType = 'major' | 'minor' | 'dorian' | 'phrygian'
  | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'
  | 'pentatonic' | 'blues' | 'chromatic';

export interface ArpeggiatorParams {
  mode: ArpMode;
  rate: number;
  octaves: number;
  gate: number;
}

export interface ChordParams {
  intervals: number[];
  inversion: number;
}

export interface ScaleParams {
  root: number;
  scale: ScaleType;
}

export interface TransposerParams {
  semitones: number;
}

export interface VelocityParams {
  min: number;
  max: number;
  curve: number;
  randomize: number;
}

export interface NoteRepeatParams {
  divisions: number;
  gate: number;
  decay: number;
}

export interface HumanizeParams {
  timingAmount: number;
  velocityAmount: number;
}

export interface MidiDelayParams {
  time: number;
  feedback: number;
  transpose: number;
}

export type MidiEffectParams =
  | ArpeggiatorParams
  | ChordParams
  | ScaleParams
  | TransposerParams
  | VelocityParams
  | NoteRepeatParams
  | HumanizeParams
  | MidiDelayParams;

export interface MidiEffectConfig {
  id: string;
  type: MidiEffectType;
  enabled: boolean;
  params: MidiEffectParams;
}

export const MIDI_EFFECT_LABELS: Record<MidiEffectType, string> = {
  arpeggiator: 'Arpeggiator',
  chord: 'Chord',
  scale: 'Scale',
  transposer: 'Transposer',
  velocity: 'Velocity',
  noteRepeat: 'Note Repeat',
  humanize: 'Humanize',
  midiDelay: 'MIDI Delay',
};

export const DEFAULT_ARP_PARAMS: ArpeggiatorParams = {
  mode: 'up', rate: 0.125, octaves: 1, gate: 0.8,
};

export const DEFAULT_CHORD_PARAMS: ChordParams = {
  intervals: [0, 4, 7], inversion: 0,
};

export const DEFAULT_SCALE_PARAMS: ScaleParams = {
  root: 0, scale: 'major',
};

export const DEFAULT_TRANSPOSER_PARAMS: TransposerParams = {
  semitones: 0,
};

export const DEFAULT_VELOCITY_PARAMS: VelocityParams = {
  min: 0, max: 127, curve: 1, randomize: 0,
};

export const DEFAULT_NOTE_REPEAT_PARAMS: NoteRepeatParams = {
  divisions: 4, gate: 0.5, decay: 0.9,
};

export const DEFAULT_HUMANIZE_PARAMS: HumanizeParams = {
  timingAmount: 0.02, velocityAmount: 10,
};

export const DEFAULT_MIDI_DELAY_PARAMS: MidiDelayParams = {
  time: 0.25, feedback: 0.5, transpose: 0,
};

export const MIDI_EFFECT_DEFAULTS: Record<MidiEffectType, MidiEffectParams> = {
  arpeggiator: DEFAULT_ARP_PARAMS,
  chord: DEFAULT_CHORD_PARAMS,
  scale: DEFAULT_SCALE_PARAMS,
  transposer: DEFAULT_TRANSPOSER_PARAMS,
  velocity: DEFAULT_VELOCITY_PARAMS,
  noteRepeat: DEFAULT_NOTE_REPEAT_PARAMS,
  humanize: DEFAULT_HUMANIZE_PARAMS,
  midiDelay: DEFAULT_MIDI_DELAY_PARAMS,
};

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
