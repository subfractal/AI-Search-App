export type EffectType =
  | 'reverb'
  | 'delay'
  | 'eq'
  | 'compressor'
  | 'chorus'
  | 'distortion'
  | 'phaser'
  | 'filter'
  | 'pitchShift'
  | 'gate'
  | 'deesser'
  | 'multibandComp'
  | 'flanger'
  | 'tremolo'
  | 'stereoImager'
  | 'frequencyShifter'
  | 'ringMod'
  | 'exciter'
  | 'utility'
  | 'limiter'
  | 'saturator';

// --- Existing param interfaces ---

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

// --- New param interfaces ---

export interface GateParams {
  threshold: number;
  smoothing: number;
}

export interface DeesserParams {
  frequency: number;
  threshold: number;
  ratio: number;
}

export interface MultibandCompParams {
  lowThreshold: number;
  midThreshold: number;
  highThreshold: number;
  lowRatio: number;
  midRatio: number;
  highRatio: number;
  lowFrequency: number;
  highFrequency: number;
}

export interface FlangerParams {
  frequency: number;
  delayTime: number;
  depth: number;
  feedback: number;
  wet: number;
}

export interface TremoloParams {
  frequency: number;
  depth: number;
  wet: number;
}

export interface StereoImagerParams {
  width: number;
}

export interface FrequencyShifterParams {
  shift: number;
  wet: number;
}

export interface RingModParams {
  frequency: number;
  wet: number;
}

export interface ExciterParams {
  drive: number;
  frequency: number;
  wet: number;
}

export interface UtilityParams {
  gain: number;
  pan: number;
  mono: number;
  phaseInvert: number;
}

export interface LimiterParams {
  threshold: number;
}

export interface SaturatorParams {
  drive: number;
  wet: number;
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
  | PitchShiftParams
  | GateParams
  | DeesserParams
  | MultibandCompParams
  | FlangerParams
  | TremoloParams
  | StereoImagerParams
  | FrequencyShifterParams
  | RingModParams
  | ExciterParams
  | UtilityParams
  | LimiterParams
  | SaturatorParams;

export interface EffectConfig {
  id: string;
  type: EffectType;
  enabled: boolean;
  params: EffectParams;
  source?: 'user' | 'mastering';
}

// --- Default params ---

export const DEFAULT_REVERB_PARAMS: ReverbParams = {
  decay: 2.5, preDelay: 0.01, wet: 0.5,
};

export const DEFAULT_DELAY_PARAMS: DelayParams = {
  delayTime: 0.25, feedback: 0.4, wet: 0.5,
};

export const DEFAULT_EQ3_PARAMS: EQ3Params = {
  low: 0, mid: 0, high: 0, lowFrequency: 400, highFrequency: 2500,
};

export const DEFAULT_COMPRESSOR_PARAMS: CompressorParams = {
  threshold: -24, ratio: 4, attack: 0.003, release: 0.25, knee: 30,
};

export const DEFAULT_CHORUS_PARAMS: ChorusParams = {
  frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.5,
};

export const DEFAULT_DISTORTION_PARAMS: DistortionParams = {
  distortion: 0.4, wet: 0.5,
};

export const DEFAULT_PHASER_PARAMS: PhaserParams = {
  frequency: 0.5, octaves: 3, baseFrequency: 350, wet: 0.5,
};

export const DEFAULT_FILTER_PARAMS: FilterParams = {
  frequency: 1000, type: 'lowpass', Q: 1, rolloff: -12,
};

export const DEFAULT_PITCH_SHIFT_PARAMS: PitchShiftParams = {
  pitch: 0, wet: 1, windowSize: 0.1,
};

export const DEFAULT_GATE_PARAMS: GateParams = {
  threshold: -40, smoothing: 0.01,
};

export const DEFAULT_DEESSER_PARAMS: DeesserParams = {
  frequency: 6000, threshold: -20, ratio: 4,
};

export const DEFAULT_MULTIBAND_COMP_PARAMS: MultibandCompParams = {
  lowThreshold: -24, midThreshold: -24, highThreshold: -24,
  lowRatio: 3, midRatio: 3, highRatio: 3,
  lowFrequency: 250, highFrequency: 3500,
};

export const DEFAULT_FLANGER_PARAMS: FlangerParams = {
  frequency: 0.5, delayTime: 0.003, depth: 0.7, feedback: 0.5, wet: 0.5,
};

export const DEFAULT_TREMOLO_PARAMS: TremoloParams = {
  frequency: 4, depth: 0.6, wet: 1,
};

export const DEFAULT_STEREO_IMAGER_PARAMS: StereoImagerParams = {
  width: 1,
};

export const DEFAULT_FREQUENCY_SHIFTER_PARAMS: FrequencyShifterParams = {
  shift: 0, wet: 0.5,
};

export const DEFAULT_RING_MOD_PARAMS: RingModParams = {
  frequency: 300, wet: 0.5,
};

export const DEFAULT_EXCITER_PARAMS: ExciterParams = {
  drive: 0.2, frequency: 5000, wet: 0.5,
};

export const DEFAULT_UTILITY_PARAMS: UtilityParams = {
  gain: 0, pan: 0, mono: 0, phaseInvert: 0,
};

export const DEFAULT_LIMITER_PARAMS: LimiterParams = {
  threshold: -1,
};

export const DEFAULT_SATURATOR_PARAMS: SaturatorParams = {
  drive: 0.3, wet: 0.5,
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
  gate: DEFAULT_GATE_PARAMS,
  deesser: DEFAULT_DEESSER_PARAMS,
  multibandComp: DEFAULT_MULTIBAND_COMP_PARAMS,
  flanger: DEFAULT_FLANGER_PARAMS,
  tremolo: DEFAULT_TREMOLO_PARAMS,
  stereoImager: DEFAULT_STEREO_IMAGER_PARAMS,
  frequencyShifter: DEFAULT_FREQUENCY_SHIFTER_PARAMS,
  ringMod: DEFAULT_RING_MOD_PARAMS,
  exciter: DEFAULT_EXCITER_PARAMS,
  utility: DEFAULT_UTILITY_PARAMS,
  limiter: DEFAULT_LIMITER_PARAMS,
  saturator: DEFAULT_SATURATOR_PARAMS,
};

export const EFFECT_LABELS: Record<EffectType, string> = {
  reverb: 'Reverb',
  delay: 'Delay',
  eq: 'EQ3',
  compressor: 'Compressor',
  chorus: 'Chorus',
  distortion: 'Distortion',
  phaser: 'Phaser',
  filter: 'Filter',
  pitchShift: 'Pitch Shift',
  gate: 'Gate',
  deesser: 'De-Esser',
  multibandComp: 'Multiband Comp',
  flanger: 'Flanger',
  tremolo: 'Tremolo',
  stereoImager: 'Stereo Imager',
  frequencyShifter: 'Freq Shifter',
  ringMod: 'Ring Mod',
  exciter: 'Exciter',
  utility: 'Utility',
  limiter: 'Limiter',
  saturator: 'Saturator',
};

export interface EffectPreset {
  name: string;
  type: EffectType;
  params: EffectParams;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  { name: 'Hall Reverb', type: 'reverb', params: { decay: 3.5, preDelay: 0.03, wet: 0.6 } },
  { name: 'Room Reverb', type: 'reverb', params: { decay: 1.2, preDelay: 0.005, wet: 0.35 } },
  { name: 'Slapback Delay', type: 'delay', params: { delayTime: 0.12, feedback: 0.2, wet: 0.5 } },
  { name: 'Ping Pong Delay', type: 'delay', params: { delayTime: 0.375, feedback: 0.55, wet: 0.4 } },
  { name: 'Vocal EQ', type: 'eq', params: { low: -3, mid: 2, high: 1, lowFrequency: 300, highFrequency: 3000 } },
  { name: 'Bass Boost', type: 'eq', params: { low: 6, mid: -1, high: -2, lowFrequency: 250, highFrequency: 2500 } },
  { name: 'Air / Presence', type: 'eq', params: { low: -2, mid: 0, high: 5, lowFrequency: 400, highFrequency: 4000 } },
  { name: 'Bus Compressor', type: 'compressor', params: { threshold: -18, ratio: 4, attack: 0.01, release: 0.15, knee: 10 } },
  { name: 'Vocal Compressor', type: 'compressor', params: { threshold: -20, ratio: 3, attack: 0.005, release: 0.1, knee: 6 } },
  { name: 'Warm Chorus', type: 'chorus', params: { frequency: 1.2, delayTime: 4, depth: 0.8, wet: 0.5 } },
  { name: 'Tape Saturation', type: 'distortion', params: { distortion: 0.15, wet: 0.6 } },
  { name: 'Octave Up', type: 'pitchShift', params: { pitch: 12, wet: 1, windowSize: 0.1 } },
  { name: 'Octave Down', type: 'pitchShift', params: { pitch: -12, wet: 1, windowSize: 0.1 } },
  { name: 'Harmonizer +5', type: 'pitchShift', params: { pitch: 7, wet: 0.5, windowSize: 0.1 } },
  { name: 'High-Pass 80Hz', type: 'filter', params: { frequency: 80, type: 'highpass', Q: 0.7, rolloff: -12 } },
  { name: 'Low-Pass 12kHz', type: 'filter', params: { frequency: 12000, type: 'lowpass', Q: 0.7, rolloff: -12 } },
  // New presets for new effects
  { name: 'Noise Gate', type: 'gate', params: { threshold: -40, smoothing: 0.01 } },
  { name: 'Tight Gate', type: 'gate', params: { threshold: -30, smoothing: 0.005 } },
  { name: 'Vocal De-Ess', type: 'deesser', params: { frequency: 6000, threshold: -20, ratio: 4 } },
  { name: 'Gentle De-Ess', type: 'deesser', params: { frequency: 7000, threshold: -15, ratio: 2.5 } },
  { name: 'Mastering MB', type: 'multibandComp', params: { lowThreshold: -20, midThreshold: -18, highThreshold: -16, lowRatio: 2, midRatio: 2.5, highRatio: 3, lowFrequency: 250, highFrequency: 3500 } },
  { name: 'Jet Flanger', type: 'flanger', params: { frequency: 0.3, delayTime: 0.004, depth: 0.8, feedback: 0.7, wet: 0.5 } },
  { name: 'Subtle Flanger', type: 'flanger', params: { frequency: 0.1, delayTime: 0.002, depth: 0.4, feedback: 0.3, wet: 0.3 } },
  { name: 'Auto Tremolo', type: 'tremolo', params: { frequency: 4, depth: 0.6, wet: 1 } },
  { name: 'Fast Tremolo', type: 'tremolo', params: { frequency: 8, depth: 0.8, wet: 1 } },
  { name: 'Wide Stereo', type: 'stereoImager', params: { width: 1.5 } },
  { name: 'Mono Collapse', type: 'stereoImager', params: { width: 0 } },
  { name: 'Frequency Shift +10', type: 'frequencyShifter', params: { shift: 10, wet: 0.5 } },
  { name: 'Ring Mod Bell', type: 'ringMod', params: { frequency: 440, wet: 0.5 } },
  { name: 'Presence Exciter', type: 'exciter', params: { drive: 0.2, frequency: 5000, wet: 0.5 } },
  { name: 'Air Exciter', type: 'exciter', params: { drive: 0.15, frequency: 8000, wet: 0.4 } },
  { name: 'Gain Utility', type: 'utility', params: { gain: 0, pan: 0, mono: 0, phaseInvert: 0 } },
  { name: 'Brickwall Limiter', type: 'limiter', params: { threshold: -1 } },
  { name: 'Soft Limiter', type: 'limiter', params: { threshold: -3 } },
  { name: 'Tube Warmth', type: 'saturator', params: { drive: 0.2, wet: 0.5 } },
  { name: 'Tape Saturation', type: 'saturator', params: { drive: 0.4, wet: 0.6 } },
  { name: 'Heavy Saturation', type: 'saturator', params: { drive: 0.7, wet: 0.8 } },
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
  gate: [
    { key: 'threshold', label: 'Thresh', min: -80, max: 0 },
    { key: 'smoothing', label: 'Smooth', min: 0.001, max: 0.1 },
  ],
  deesser: [
    { key: 'frequency', label: 'Freq', min: 2000, max: 12000 },
    { key: 'threshold', label: 'Thresh', min: -40, max: 0 },
    { key: 'ratio', label: 'Ratio', min: 1, max: 10 },
  ],
  multibandComp: [
    { key: 'lowThreshold', label: 'Lo Th', min: -60, max: 0 },
    { key: 'midThreshold', label: 'Mid Th', min: -60, max: 0 },
    { key: 'highThreshold', label: 'Hi Th', min: -60, max: 0 },
    { key: 'lowRatio', label: 'Lo R', min: 1, max: 20 },
    { key: 'midRatio', label: 'Mid R', min: 1, max: 20 },
    { key: 'highRatio', label: 'Hi R', min: 1, max: 20 },
  ],
  flanger: [
    { key: 'frequency', label: 'Rate', min: 0.05, max: 5 },
    { key: 'delayTime', label: 'Delay', min: 0.001, max: 0.01 },
    { key: 'depth', label: 'Depth', min: 0, max: 1 },
    { key: 'feedback', label: 'Fdbk', min: 0, max: 0.95 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  tremolo: [
    { key: 'frequency', label: 'Rate', min: 0.1, max: 20 },
    { key: 'depth', label: 'Depth', min: 0, max: 1 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  stereoImager: [
    { key: 'width', label: 'Width', min: 0, max: 2 },
  ],
  frequencyShifter: [
    { key: 'shift', label: 'Shift', min: -500, max: 500 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  ringMod: [
    { key: 'frequency', label: 'Freq', min: 20, max: 5000 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  exciter: [
    { key: 'drive', label: 'Drive', min: 0, max: 1 },
    { key: 'frequency', label: 'Freq', min: 1000, max: 12000 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
  utility: [
    { key: 'gain', label: 'Gain', min: -24, max: 24 },
    { key: 'pan', label: 'Pan', min: -1, max: 1 },
    { key: 'mono', label: 'Mono', min: 0, max: 1, step: 1 },
    { key: 'phaseInvert', label: 'Phase', min: 0, max: 1, step: 1 },
  ],
  limiter: [
    { key: 'threshold', label: 'Ceil', min: -12, max: 0 },
  ],
  saturator: [
    { key: 'drive', label: 'Drive', min: 0, max: 1 },
    { key: 'wet', label: 'Wet', min: 0, max: 1 },
  ],
};
