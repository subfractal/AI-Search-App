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
  family?: InstrumentFamily;
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

export interface InstrumentPreset {
  name: string;
  type: InstrumentType;
  category: PresetCategory;
  params?: SynthParams;
}

export type PresetCategory =
  | 'keys'
  | 'bass'
  | 'lead'
  | 'pad'
  | 'pluck'
  | 'brass'
  | 'strings'
  | 'drums';

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'keys', label: 'Keys' },
  { id: 'bass', label: 'Bass' },
  { id: 'lead', label: 'Lead' },
  { id: 'pad', label: 'Pad' },
  { id: 'pluck', label: 'Pluck' },
  { id: 'brass', label: 'Brass' },
  { id: 'strings', label: 'Strings' },
  { id: 'drums', label: 'Drums' },
];

export const INSTRUMENT_PRESETS: InstrumentPreset[] = [
  // ── Keys ──
  {
    name: 'Electric Piano', type: 'fm-synth', category: 'keys',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 5000, filterResonance: 0.5,
      attack: 0.005, decay: 0.8, sustain: 0.4, release: 1.2,
    },
  },
  {
    name: 'Bright Piano', type: 'synth', category: 'keys',
    params: {
      oscillator: 'triangle', filterType: 'lowpass',
      filterFrequency: 8000, filterResonance: 0.3,
      attack: 0.002, decay: 1.0, sustain: 0.3, release: 0.8,
    },
  },
  {
    name: 'Organ', type: 'synth', category: 'keys',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 3000, filterResonance: 1,
      attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1,
    },
  },
  {
    name: 'Clavinet', type: 'fm-synth', category: 'keys',
    params: {
      oscillator: 'square', filterType: 'bandpass',
      filterFrequency: 2500, filterResonance: 3,
      attack: 0.001, decay: 0.4, sustain: 0.2, release: 0.3,
    },
  },
  // ── Bass ──
  {
    name: 'Sub Bass', type: 'mono-synth', category: 'bass',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 400, filterResonance: 2,
      attack: 0.005, decay: 0.3, sustain: 0.8, release: 0.2,
    },
  },
  {
    name: 'Analog Bass', type: 'mono-synth', category: 'bass',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 800, filterResonance: 6,
      attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.15,
    },
  },
  {
    name: 'Wobble Bass', type: 'mono-synth', category: 'bass',
    params: {
      oscillator: 'square', filterType: 'lowpass',
      filterFrequency: 600, filterResonance: 10,
      attack: 0.01, decay: 0.4, sustain: 0.5, release: 0.3,
    },
  },
  {
    name: 'FM Bass', type: 'fm-synth', category: 'bass',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 1200, filterResonance: 2,
      attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.2,
    },
  },
  // ── Lead ──
  {
    name: 'Saw Lead', type: 'mono-synth', category: 'lead',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 4000, filterResonance: 3,
      attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3,
    },
  },
  {
    name: 'Square Lead', type: 'mono-synth', category: 'lead',
    params: {
      oscillator: 'square', filterType: 'lowpass',
      filterFrequency: 3000, filterResonance: 2,
      attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.25,
    },
  },
  {
    name: 'Acid Lead', type: 'mono-synth', category: 'lead',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 1500, filterResonance: 15,
      attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.15,
    },
  },
  {
    name: 'FM Bell Lead', type: 'fm-synth', category: 'lead',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 6000, filterResonance: 0.5,
      attack: 0.001, decay: 1.5, sustain: 0.1, release: 1.0,
    },
  },
  // ── Pad ──
  {
    name: 'Warm Pad', type: 'synth', category: 'pad',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 1200, filterResonance: 1,
      attack: 0.8, decay: 1.0, sustain: 0.8, release: 2.0,
    },
  },
  {
    name: 'Ambient Pad', type: 'synth', category: 'pad',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 2000, filterResonance: 0.5,
      attack: 1.5, decay: 2.0, sustain: 0.9, release: 3.0,
    },
  },
  {
    name: 'Dark Pad', type: 'synth', category: 'pad',
    params: {
      oscillator: 'triangle', filterType: 'lowpass',
      filterFrequency: 600, filterResonance: 2,
      attack: 1.0, decay: 1.5, sustain: 0.7, release: 2.5,
    },
  },
  {
    name: 'Shimmer Pad', type: 'am-synth', category: 'pad',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 4000, filterResonance: 1,
      attack: 1.2, decay: 2.0, sustain: 0.85, release: 3.5,
    },
  },
  // ── Pluck ──
  {
    name: 'Pluck Synth', type: 'synth', category: 'pluck',
    params: {
      oscillator: 'triangle', filterType: 'lowpass',
      filterFrequency: 5000, filterResonance: 1,
      attack: 0.001, decay: 0.4, sustain: 0.05, release: 0.3,
    },
  },
  {
    name: 'Harp', type: 'synth', category: 'pluck',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 4000, filterResonance: 0.5,
      attack: 0.001, decay: 0.8, sustain: 0.02, release: 0.6,
    },
  },
  {
    name: 'Guitar', type: 'fm-synth', category: 'pluck',
    params: {
      oscillator: 'triangle', filterType: 'lowpass',
      filterFrequency: 3000, filterResonance: 1.5,
      attack: 0.002, decay: 0.6, sustain: 0.1, release: 0.5,
    },
  },
  {
    name: 'Marimba', type: 'fm-synth', category: 'pluck',
    params: {
      oscillator: 'sine', filterType: 'lowpass',
      filterFrequency: 3500, filterResonance: 0.5,
      attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.3,
    },
  },
  // ── Brass ──
  {
    name: 'Brass Stab', type: 'synth', category: 'brass',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 2000, filterResonance: 2,
      attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.3,
    },
  },
  {
    name: 'Trumpet', type: 'synth', category: 'brass',
    params: {
      oscillator: 'square', filterType: 'lowpass',
      filterFrequency: 3500, filterResonance: 1.5,
      attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.2,
    },
  },
  {
    name: 'French Horn', type: 'synth', category: 'brass',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 1500, filterResonance: 1,
      attack: 0.15, decay: 0.4, sustain: 0.7, release: 0.5,
    },
  },
  // ── Strings ──
  {
    name: 'String Ensemble', type: 'synth', category: 'strings',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 3000, filterResonance: 0.5,
      attack: 0.4, decay: 0.5, sustain: 0.9, release: 1.0,
    },
  },
  {
    name: 'Solo Violin', type: 'synth', category: 'strings',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 5000, filterResonance: 1,
      attack: 0.15, decay: 0.3, sustain: 0.8, release: 0.4,
    },
  },
  {
    name: 'Cello', type: 'synth', category: 'strings',
    params: {
      oscillator: 'sawtooth', filterType: 'lowpass',
      filterFrequency: 2000, filterResonance: 0.8,
      attack: 0.2, decay: 0.4, sustain: 0.85, release: 0.6,
    },
  },
  // ── Drums ──
  { name: 'Drum Machine', type: 'drum-machine', category: 'drums' },
];

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12]!;
  return `${note}${octave}`;
}

// --- Instrument family expansion ---
export type InstrumentFamily =
  | 'subtractive' | 'wavetable' | 'sampler' | 'drum-machine' | 'drum-sampler';

export interface SubtractiveSynthPreset {
  family: 'subtractive';
  oscillator: OscillatorType;
  oscillator2?: OscillatorType;
  oscMix?: number;
  glide?: number;
  unisonVoices?: number;
  unisonDetune?: number;
  filterType: FilterType;
  filterFrequency: number;
  filterResonance: number;
  filterEnvAmount?: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  lfoRate?: number;
  lfoDepth?: number;
  lfoTarget?: 'filter' | 'pitch' | 'amp';
}

export interface WavetableSynthPreset {
  family: 'wavetable';
  wavetableIndex: number;
  morphPosition: number;
  filterType: FilterType;
  filterFrequency: number;
  filterResonance: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  macros: [number, number, number, number];
}

export interface SamplerInstrumentPreset {
  family: 'sampler';
  sampleUrl?: string;
  rootNote: number;
  loopEnabled: boolean;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

// --- Drum kit architecture ---
export interface DrumPad {
  id: string;
  name: string;
  midiNote: number;
  sound: DrumSound;
  muteGroup?: number;
  chokeGroup?: number;
}

export interface DrumKit {
  id: string;
  name: string;
  pads: DrumPad[];
  tags: string[];
}

export interface PatternVariation {
  id: string;
  name: string;
  steps: boolean[][];
  velocities?: number[][];
}

// --- Factory kits ---
export const FACTORY_KITS: DrumKit[] = [
  {
    id: 'kit-808',
    name: '808 Electronic',
    tags: ['electronic', 'hip-hop', 'trap'],
    pads: [
      { id: 'p0', name: 'Kick', midiNote: 36, sound: { id: 'kick', name: 'Kick', key: 'C2', type: 'synth', params: { frequency: 55, decay: 0.8, pitchDecay: 0.15, noise: false, noiseType: 'white' } } },
      { id: 'p1', name: 'Snare', midiNote: 38, sound: { id: 'snare', name: 'Snare', key: 'D2', type: 'synth', params: { frequency: 200, decay: 0.3, pitchDecay: 0.05, noise: true, noiseType: 'white' } } },
      { id: 'p2', name: 'Clap', midiNote: 39, sound: { id: 'clap', name: 'Clap', key: 'D#2', type: 'synth', params: { frequency: 400, decay: 0.15, pitchDecay: 0.01, noise: true, noiseType: 'pink' } } },
      { id: 'p3', name: 'HiHat', midiNote: 42, sound: { id: 'hihat', name: 'HiHat', key: 'F#2', type: 'synth', params: { frequency: 6000, decay: 0.08, pitchDecay: 0.01, noise: true, noiseType: 'white' } } },
      { id: 'p4', name: 'Open Hat', midiNote: 46, sound: { id: 'openhat', name: 'Open Hat', key: 'A#2', type: 'synth', params: { frequency: 6000, decay: 0.35, pitchDecay: 0.01, noise: true, noiseType: 'white' } }, muteGroup: 1 },
      { id: 'p5', name: 'Cowbell', midiNote: 56, sound: { id: 'cowbell', name: 'Cowbell', key: 'G#3', type: 'synth', params: { frequency: 800, decay: 0.2, pitchDecay: 0.02, noise: false, noiseType: 'white' } } },
      { id: 'p6', name: 'Low Tom', midiNote: 43, sound: { id: 'lowtom', name: 'Low Tom', key: 'G2', type: 'synth', params: { frequency: 80, decay: 0.5, pitchDecay: 0.1, noise: false, noiseType: 'white' } } },
      { id: 'p7', name: 'Rim', midiNote: 37, sound: { id: 'rim', name: 'Rim', key: 'C#2', type: 'synth', params: { frequency: 1200, decay: 0.05, pitchDecay: 0.02, noise: true, noiseType: 'pink' } } },
    ],
  },
  {
    id: 'kit-909',
    name: '909 Dance',
    tags: ['electronic', 'house', 'techno'],
    pads: [
      { id: 'p0', name: 'Kick', midiNote: 36, sound: { id: 'kick', name: 'Kick', key: 'C2', type: 'synth', params: { frequency: 50, decay: 0.6, pitchDecay: 0.12, noise: false, noiseType: 'white' } } },
      { id: 'p1', name: 'Snare', midiNote: 38, sound: { id: 'snare', name: 'Snare', key: 'D2', type: 'synth', params: { frequency: 220, decay: 0.25, pitchDecay: 0.04, noise: true, noiseType: 'white' } } },
      { id: 'p2', name: 'Clap', midiNote: 39, sound: { id: 'clap', name: 'Clap', key: 'D#2', type: 'synth', params: { frequency: 500, decay: 0.12, pitchDecay: 0.01, noise: true, noiseType: 'pink' } } },
      { id: 'p3', name: 'HiHat', midiNote: 42, sound: { id: 'hihat', name: 'HiHat', key: 'F#2', type: 'synth', params: { frequency: 8000, decay: 0.05, pitchDecay: 0.01, noise: true, noiseType: 'white' } } },
      { id: 'p4', name: 'Open Hat', midiNote: 46, sound: { id: 'openhat', name: 'Open Hat', key: 'A#2', type: 'synth', params: { frequency: 8000, decay: 0.4, pitchDecay: 0.01, noise: true, noiseType: 'white' } }, muteGroup: 1 },
      { id: 'p5', name: 'Ride', midiNote: 51, sound: { id: 'ride', name: 'Ride', key: 'D#3', type: 'synth', params: { frequency: 5000, decay: 0.6, pitchDecay: 0.01, noise: true, noiseType: 'white' } } },
      { id: 'p6', name: 'Low Tom', midiNote: 43, sound: { id: 'lowtom', name: 'Low Tom', key: 'G2', type: 'synth', params: { frequency: 100, decay: 0.45, pitchDecay: 0.08, noise: false, noiseType: 'white' } } },
      { id: 'p7', name: 'Hi Tom', midiNote: 48, sound: { id: 'hitom', name: 'Hi Tom', key: 'C3', type: 'synth', params: { frequency: 200, decay: 0.35, pitchDecay: 0.06, noise: false, noiseType: 'white' } } },
    ],
  },
  {
    id: 'kit-acoustic',
    name: 'Acoustic Kit',
    tags: ['acoustic', 'pop', 'rock', 'jazz'],
    pads: [
      { id: 'p0', name: 'Kick', midiNote: 36, sound: { id: 'kick', name: 'Kick', key: 'C2', type: 'synth', params: { frequency: 60, decay: 0.4, pitchDecay: 0.08, noise: true, noiseType: 'brown' } } },
      { id: 'p1', name: 'Snare', midiNote: 38, sound: { id: 'snare', name: 'Snare', key: 'D2', type: 'synth', params: { frequency: 180, decay: 0.2, pitchDecay: 0.03, noise: true, noiseType: 'white' } } },
      { id: 'p2', name: 'Cross Stick', midiNote: 37, sound: { id: 'xstick', name: 'Cross Stick', key: 'C#2', type: 'synth', params: { frequency: 1500, decay: 0.04, pitchDecay: 0.02, noise: true, noiseType: 'pink' } } },
      { id: 'p3', name: 'HiHat', midiNote: 42, sound: { id: 'hihat', name: 'HiHat', key: 'F#2', type: 'synth', params: { frequency: 7000, decay: 0.06, pitchDecay: 0.01, noise: true, noiseType: 'white' } } },
      { id: 'p4', name: 'Open Hat', midiNote: 46, sound: { id: 'openhat', name: 'Open Hat', key: 'A#2', type: 'synth', params: { frequency: 7000, decay: 0.3, pitchDecay: 0.01, noise: true, noiseType: 'white' } }, muteGroup: 1 },
      { id: 'p5', name: 'Ride', midiNote: 51, sound: { id: 'ride', name: 'Ride', key: 'D#3', type: 'synth', params: { frequency: 4000, decay: 0.5, pitchDecay: 0.01, noise: true, noiseType: 'white' } } },
      { id: 'p6', name: 'Floor Tom', midiNote: 43, sound: { id: 'floortom', name: 'Floor Tom', key: 'G2', type: 'synth', params: { frequency: 90, decay: 0.4, pitchDecay: 0.06, noise: true, noiseType: 'brown' } } },
      { id: 'p7', name: 'Rack Tom', midiNote: 48, sound: { id: 'racktom', name: 'Rack Tom', key: 'C3', type: 'synth', params: { frequency: 160, decay: 0.3, pitchDecay: 0.05, noise: true, noiseType: 'brown' } } },
    ],
  },
];

export const DEFAULT_SUBTRACTIVE_PRESET: SubtractiveSynthPreset = {
  family: 'subtractive',
  oscillator: 'sawtooth',
  filterType: 'lowpass',
  filterFrequency: 2000,
  filterResonance: 1,
  attack: 0.01,
  decay: 0.3,
  sustain: 0.7,
  release: 0.3,
};

export const DEFAULT_WAVETABLE_PRESET: WavetableSynthPreset = {
  family: 'wavetable',
  wavetableIndex: 0,
  morphPosition: 0,
  filterType: 'lowpass',
  filterFrequency: 4000,
  filterResonance: 0.5,
  attack: 0.01,
  decay: 0.4,
  sustain: 0.6,
  release: 0.4,
  macros: [0.5, 0.5, 0.5, 0.5],
};

export const DEFAULT_SAMPLER_PRESET: SamplerInstrumentPreset = {
  family: 'sampler',
  rootNote: 60,
  loopEnabled: false,
  attack: 0.005,
  decay: 0.2,
  sustain: 0.8,
  release: 0.3,
};
