export type EffectType =
  | 'reverb'
  | 'delay'
  | 'eq'
  | 'compressor'
  | 'chorus'
  | 'distortion'
  | 'phaser'
  | 'filter'
  | 'pitchShift';

export interface ReverbParams {
  decay: number;
  preDelay: number;
  wet: number;
}

export interface DelayParams {
  delayTime: number;
  feedback: number;
  wet: number;
}

export interface EQ3Params {
  low: number;
  mid: number;
  high: number;
  lowFrequency: number;
  highFrequency: number;
}

export interface CompressorParams {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
}

export interface ChorusParams {
  frequency: number;
  delayTime: number;
  depth: number;
  wet: number;
}

export interface DistortionParams {
  distortion: number;
  wet: number;
}

export interface PhaserParams {
  frequency: number;
  octaves: number;
  baseFrequency: number;
  wet: number;
}

export type FilterRolloff = -12 | -24 | -48;
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';

export interface FilterParams {
  frequency: number;
  type: FilterType;
  Q: number;
  rolloff: FilterRolloff;
}

export interface PitchShiftParams {
  pitch: number;
  wet: number;
  windowSize: number;
}

export type EffectParams =
  | ReverbParams
  | DelayParams
  | EQ3Params
  | CompressorParams
  | ChorusParams
  | DistortionParams
  | PhaserParams
  | FilterParams
  | PitchShiftParams;

export interface EffectConfig {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: EffectParams;
}

export const DEFAULT_REVERB_PARAMS: ReverbParams = {
  decay: 2.5,
  preDelay: 0.01,
  wet: 0.5,
};

export const DEFAULT_DELAY_PARAMS: DelayParams = {
  delayTime: 0.25,
  feedback: 0.4,
  wet: 0.5,
};

export const DEFAULT_EQ3_PARAMS: EQ3Params = {
  low: 0,
  mid: 0,
  high: 0,
  lowFrequency: 400,
  highFrequency: 2500,
};

export const DEFAULT_COMPRESSOR_PARAMS: CompressorParams = {
  threshold: -24,
  ratio: 4,
  attack: 0.003,
  release: 0.25,
  knee: 30,
};

export const DEFAULT_CHORUS_PARAMS: ChorusParams = {
  frequency: 1.5,
  delayTime: 3.5,
  depth: 0.7,
  wet: 0.5,
};

export const DEFAULT_DISTORTION_PARAMS: DistortionParams = {
  distortion: 0.4,
  wet: 0.5,
};

export const DEFAULT_PHASER_PARAMS: PhaserParams = {
  frequency: 0.5,
  octaves: 3,
  baseFrequency: 350,
  wet: 0.5,
};

export const DEFAULT_FILTER_PARAMS: FilterParams = {
  frequency: 1000,
  type: 'lowpass',
  Q: 1,
  rolloff: -12,
};

export const DEFAULT_PITCH_SHIFT_PARAMS: PitchShiftParams = {
  pitch: 0,
  wet: 1,
  windowSize: 0.1,
};

export const DEFAULT_PARAMS: Record<EffectType, EffectParams> = {
  reverb: DEFAULT_REVERB_PARAMS,
  delay: DEFAULT_DELAY_PARAMS,
  eq: DEFAULT_EQ3_PARAMS,
  compressor: DEFAULT_COMPRESSOR_PARAMS,
  chorus: DEFAULT_CHORUS_PARAMS,
  distortion: DEFAULT_DISTORTION_PARAMS,
  phaser: DEFAULT_PHASER_PARAMS,
  filter: DEFAULT_FILTER_PARAMS,
  pitchShift: DEFAULT_PITCH_SHIFT_PARAMS,
};

export const EFFECT_LABELS: Record<EffectType, string> = {
  reverb: 'DKT-VERB-01',
  delay: 'DKT-DLY-01',
  eq: 'DKT-EQ3-01',
  compressor: 'DKT-COMP-01',
  chorus: 'DKT-CHOR-01',
  distortion: 'DKT-DIST-01',
  phaser: 'DKT-PHAS-01',
  filter: 'DKT-FILT-01',
  pitchShift: 'DKT-PTCH-01',
};

export interface EffectPreset {
  name: string;
  type: EffectType;
  params: EffectParams;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  {
    name: 'Hall Reverb',
    type: 'reverb',
    params: { decay: 3.5, preDelay: 0.03, wet: 0.6 },
  },
  {
    name: 'Room Reverb',
    type: 'reverb',
    params: { decay: 1.2, preDelay: 0.005, wet: 0.35 },
  },
  {
    name: 'Slapback Delay',
    type: 'delay',
    params: { delayTime: 0.12, feedback: 0.2, wet: 0.5 },
  },
  {
    name: 'Ping Pong Delay',
    type: 'delay',
    params: { delayTime: 0.375, feedback: 0.55, wet: 0.4 },
  },
  {
    name: 'Vocal EQ',
    type: 'eq',
    params: {
      low: -3, mid: 2, high: 1,
      lowFrequency: 300, highFrequency: 3000,
    },
  },
  {
    name: 'Bass Boost',
    type: 'eq',
    params: {
      low: 6, mid: -1, high: -2,
      lowFrequency: 250, highFrequency: 2500,
    },
  },
  {
    name: 'Air / Presence',
    type: 'eq',
    params: {
      low: -2, mid: 0, high: 5,
      lowFrequency: 400, highFrequency: 4000,
    },
  },
  {
    name: 'Bus Compressor',
    type: 'compressor',
    params: {
      threshold: -18, ratio: 4, attack: 0.01, release: 0.15, knee: 10,
    },
  },
  {
    name: 'Vocal Compressor',
    type: 'compressor',
    params: {
      threshold: -20, ratio: 3, attack: 0.005, release: 0.1, knee: 6,
    },
  },
  {
    name: 'Limiter',
    type: 'compressor',
    params: {
      threshold: -3, ratio: 20, attack: 0.001, release: 0.05, knee: 0,
    },
  },
  {
    name: 'Warm Chorus',
    type: 'chorus',
    params: { frequency: 1.2, delayTime: 4, depth: 0.8, wet: 0.5 },
  },
  {
    name: 'Tape Saturation',
    type: 'distortion',
    params: { distortion: 0.15, wet: 0.6 },
  },
  {
    name: 'Octave Up',
    type: 'pitchShift',
    params: { pitch: 12, wet: 1, windowSize: 0.1 },
  },
  {
    name: 'Octave Down',
    type: 'pitchShift',
    params: { pitch: -12, wet: 1, windowSize: 0.1 },
  },
  {
    name: 'Harmonizer +5',
    type: 'pitchShift',
    params: { pitch: 7, wet: 0.5, windowSize: 0.1 },
  },
  {
    name: 'High-Pass 80Hz',
    type: 'filter',
    params: { frequency: 80, type: 'highpass', Q: 0.7, rolloff: -12 },
  },
  {
    name: 'Low-Pass 12kHz',
    type: 'filter',
    params: { frequency: 12000, type: 'lowpass', Q: 0.7, rolloff: -12 },
  },
];

export interface EffectParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
}

export const EFFECT_KNOB_DEFS: Record<EffectType, EffectParamDef[]> = {
  reverb: [
    { key: 'decay', label: 'Decay', min: 0.1, max: 10 },
    { key: 'preDelay', label: 'Pre', min: 0, max: 0.1 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  delay: [
    { key: 'delayTime', label: 'Time', min: 0, max: 2 },
    { key: 'feedback', label: 'Fdbk', min: 0, max: 0.95 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  eq: [
    { key: 'low', label: 'Low', min: -24, max: 24 },
    { key: 'mid', label: 'Mid', min: -24, max: 24 },
    { key: 'high', label: 'High', min: -24, max: 24 },
    { key: 'lowFrequency', label: 'Lo F', min: 60, max: 800 },
    { key: 'highFrequency', label: 'Hi F', min: 1000, max: 12000 },
  ],
  compressor: [
    { key: 'threshold', label: 'Thresh', min: -60, max: 0 },
    { key: 'ratio', label: 'Ratio', min: 1, max: 20 },
    { key: 'attack', label: 'Atk', min: 0, max: 1 },
    { key: 'release', label: 'Rel', min: 0, max: 1 },
    { key: 'knee', label: 'Knee', min: 0, max: 40 },
  ],
  chorus: [
    { key: 'frequency', label: 'Rate', min: 0.1, max: 10 },
    { key: 'delayTime', label: 'Delay', min: 0.5, max: 20 },
    { key: 'depth', label: 'Depth', min: 0, max: 1 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  distortion: [
    { key: 'distortion', label: 'Drive', min: 0, max: 1 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  phaser: [
    { key: 'frequency', label: 'Rate', min: 0.1, max: 10 },
    { key: 'octaves', label: 'Oct', min: 1, max: 6 },
    { key: 'baseFrequency', label: 'Base', min: 100, max: 2000 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  filter: [
    { key: 'frequency', label: 'Freq', min: 20, max: 20000 },
    { key: 'Q', label: 'Q', min: 0.1, max: 20 },
  ],
  pitchShift: [
    { key: 'pitch', label: 'Semi', min: -24, max: 24, step: 1 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
    { key: 'windowSize', label: 'Win', min: 0.01, max: 0.5 },
  ],
};
