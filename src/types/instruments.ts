export type InstrumentType =
  | 'synth'
  | 'fm-synth'
  | 'am-synth'
  | 'mono-synth'
  | 'drum-machine';

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface SynthParams {
  oscillator: OscillatorType;
  filterType: FilterType;
  filterFrequency: number;
  filterResonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface DrumSound {
  id: string;
  name: string;
  key: string;
  type: 'synth' | 'sample';
  params: DrumSynthParams;
}

export interface DrumSynthParams {
  frequency: number;
  decay: number;
  pitchDecay: number;
  noise: boolean;
  noiseType: 'white' | 'pink' | 'brown';
}

export interface DrumPattern {
  steps: boolean[][];
  stepCount: number;
  sounds: DrumSound[];
}

export interface InstrumentConfig {
  type: InstrumentType;
  name: string;
  synthParams?: SynthParams;
  drumPattern?: DrumPattern;
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  oscillator: 'sawtooth',
  filterType: 'lowpass',
  filterFrequency: 2000,
  filterResonance: 1,
  attack: 0.01,
  decay: 0.2,
  sustain: 0.5,
  release: 0.4,
};

export const DEFAULT_DRUM_SOUNDS: DrumSound[] = [
  {
    id: 'kick', name: 'Kick', key: 'C2',
    type: 'synth',
    params: { frequency: 60, decay: 0.3, pitchDecay: 0.05, noise: false, noiseType: 'white' },
  },
  {
    id: 'snare', name: 'Snare', key: 'D2',
    type: 'synth',
    params: { frequency: 200, decay: 0.15, pitchDecay: 0.01, noise: true, noiseType: 'white' },
  },
  {
    id: 'hihat', name: 'Hi-Hat', key: 'F#2',
    type: 'synth',
    params: { frequency: 800, decay: 0.05, pitchDecay: 0, noise: true, noiseType: 'white' },
  },
  {
    id: 'clap', name: 'Clap', key: 'D#2',
    type: 'synth',
    params: { frequency: 400, decay: 0.1, pitchDecay: 0.02, noise: true, noiseType: 'pink' },
  },
  {
    id: 'tom-hi', name: 'Tom Hi', key: 'A2',
    type: 'synth',
    params: { frequency: 200, decay: 0.2, pitchDecay: 0.04, noise: false, noiseType: 'white' },
  },
  {
    id: 'tom-lo', name: 'Tom Lo', key: 'G2',
    type: 'synth',
    params: { frequency: 120, decay: 0.25, pitchDecay: 0.05, noise: false, noiseType: 'white' },
  },
  {
    id: 'open-hat', name: 'Open HH', key: 'A#2',
    type: 'synth',
    params: { frequency: 600, decay: 0.3, pitchDecay: 0, noise: true, noiseType: 'white' },
  },
  {
    id: 'rim', name: 'Rim', key: 'C#2',
    type: 'synth',
    params: { frequency: 500, decay: 0.03, pitchDecay: 0.01, noise: false, noiseType: 'white' },
  },
];

export const DEFAULT_DRUM_PATTERN: DrumPattern = {
  stepCount: 16,
  sounds: DEFAULT_DRUM_SOUNDS,
  steps: DEFAULT_DRUM_SOUNDS.map(() => new Array(16).fill(false) as boolean[]),
};

export const INSTRUMENT_PRESETS: Array<{ name: string; type: InstrumentType }> = [
  { name: 'Analog Synth', type: 'synth' },
  { name: 'FM Synth', type: 'fm-synth' },
  { name: 'AM Synth', type: 'am-synth' },
  { name: 'Mono Lead', type: 'mono-synth' },
  { name: 'Drum Machine', type: 'drum-machine' },
];

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12]!;
  return `${note}${octave}`;
}
