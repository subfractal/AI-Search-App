export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'applied';
export type SuggestionType =
  | 'level'
  | 'pan'
  | 'eq'
  | 'compression'
  | 'noise'
  | 'clipping'
  | 'arrangement'
  | 'general'
  | 'masking'
  | 'loudness'
  | 'gain-staging';

export type SuggestionPriority = 'auto' | 'inline' | 'sidebar';
export type SuggestionApplyMode = 'manual' | 'realtime-preview' | 'offline-commit' | 'safe-auto';

export interface SuggestionEvidence {
  label: string;
  value: string | number | boolean;
}

export interface SuggestionConstraint {
  label: string;
  value: string;
}

export interface AISuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  targetTrackId: string | null;
  title: string;
  description: string;
  confidence: number;
  status: SuggestionStatus;
  action: SuggestionAction | null;
  timestamp: number;
  regionStart?: number;
  regionEnd?: number;
  rationale?: string;
  evidence?: SuggestionEvidence[];
  constraints?: SuggestionConstraint[];
  applyMode?: SuggestionApplyMode;
  realtimeSafe?: boolean;
  reversible?: boolean;
}

export interface SuggestionAction {
  type: 'setVolume' | 'setPan' | 'mute' | 'unmute' | 'addEffect' | 'batch';
  trackId: string;
  value?: number;
  effectType?: string;
  effectParams?: Record<string, number | string>;
  actions?: SuggestionAction[];
}

export interface LevelAnalysis {
  rms: number;
  peak: number;
  dynamicRange: number;
  clipping: boolean;
}

export interface FrequencyAnalysis {
  low: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
}

export interface LoudnessResult {
  integrated: number;
  shortTerm: number;
  momentary: number;
  range: number;
  truePeak: number;
}

export interface TrackAnalysis {
  trackId: string;
  level: LevelAnalysis;
  frequency: FrequencyAnalysis;
  loudness: LoudnessResult | null;
  silenceRegions: Array<{ start: number; end: number }>;
  noiseFloor: number;
}

export interface MaskingPair {
  trackAId: string;
  trackBId: string;
  maskedBands: string[];
  severity: number;
  suggestedAction: string;
  dominantTrackId: string;
}

export interface GainStagingTrack {
  trackId: string;
  trackName: string;
  currentPeak: number;
  currentVolume: number;
  suggestedVolume: number;
  adjustment: number;
}

export interface GainStagingResult {
  tracks: GainStagingTrack[];
  headroom: number;
  masterAdjustment: number;
}

export interface RealtimeLevel {
  rms: number;
  peak: number;
  clipping: boolean;
}

export interface MixAnalysis {
  tracks: TrackAnalysis[];
  overallLevel: LevelAnalysis;
  overallLoudness: LoudnessResult | null;
  frequencyBalance: FrequencyAnalysis;
  stereoWidth: number;
  maskingPairs: MaskingPair[];
  phaseCorrelations: PhaseCorrelation[];
  timestamp: number;
}

export interface AIActivityEntry {
  id: string;
  description: string;
  trackId: string | null;
  timestamp: number;
  undoable: boolean;
}

export type MixGenre =
  | 'pop'
  | 'edm'
  | 'rock'
  | 'hip-hop'
  | 'jazz'
  | 'classical'
  | 'general';

export interface GenreProfile {
  name: string;
  targetLufs: number;
  maxTruePeak: number;
  dynamicRangeMin: number;
  dynamicRangeMax: number;
  lowEndTolerance: number;
  highEndTolerance: number;
  compressionThreshold: number;
  description: string;
}

export interface StreamingTarget {
  name: string;
  integratedLufs: number;
  maxTruePeak: number;
  note: string;
}

export interface PhaseCorrelation {
  trackId: string;
  correlation: number;
  monoCompatible: boolean;
}

export type GeneratorModel =
  | 'markov'
  | 'lstm'
  | 'vae'
  | 'gan'
  | 'evolutionary'
  | 'diffusion';

// AI Coproducer capability modes
export type CoproducerMode = 'create' | 'diagnose' | 'improve' | 'organize' | 'commit';

// Musical role for context-aware generation
export type MusicalRole =
  | 'bass'
  | 'lead'
  | 'pad'
  | 'chords'
  | 'arp'
  | 'drums'
  | 'percussion'
  | 'fx'
  | 'vocal'
  | 'general';

export const COPRODUCER_MODES: { id: CoproducerMode; label: string; description: string }[] = [
  { id: 'create', label: 'Create', description: 'Generate new musical material — melodies, chords, bass, drums, fills, transitions, variations' },
  { id: 'diagnose', label: 'Diagnose', description: 'Analyze mix balance, loudness, masking, phase, density, arrangement repetition, export readiness' },
  { id: 'improve', label: 'Improve', description: 'Suggest and apply bounded mix changes, routing, grouping, preset/kit swaps, variation paths' },
  { id: 'organize', label: 'Organize', description: 'Structure the project — naming, colors, groups, folders, buses, assets, templates' },
  { id: 'commit', label: 'Commit', description: 'Handle render-aware outcomes — bounce prep, stem export, save reusable clips/presets/templates' },
];

export const MUSICAL_ROLES: { id: MusicalRole; label: string }[] = [
  { id: 'bass', label: 'Bass' },
  { id: 'lead', label: 'Lead' },
  { id: 'pad', label: 'Pad' },
  { id: 'chords', label: 'Chords' },
  { id: 'arp', label: 'Arp' },
  { id: 'drums', label: 'Drums' },
  { id: 'percussion', label: 'Perc' },
  { id: 'fx', label: 'FX' },
  { id: 'vocal', label: 'Vocal' },
  { id: 'general', label: 'General' },
];

export interface ComposerSettings {
  model: GeneratorModel;
  bars: number;
  density: number;
  temperature: number;
  seed: number;
  role: MusicalRole;
  coproducerMode: CoproducerMode;
}

export interface ComposerResult {
  trackId: string;
  clipId: string;
  noteCount: number;
  model: GeneratorModel;
  bars: number;
}

// Region-specific analysis
export interface TimeRegion {
  start: number;
  end: number;
  label?: string;
}

export interface RegionAnalysis {
  region: TimeRegion;
  level: LevelAnalysis;
  frequency: FrequencyAnalysis;
}

// Mastering pipeline
export interface MasteringStage {
  name: string;
  description: string;
  applied: boolean;
  effects: string[];
}

export interface MasteringResult {
  stages: MasteringStage[];
  finalLufs: number;
  finalTruePeak: number;
  genre: MixGenre;
}

// Evolutionary AI generation
export interface EvolutionState {
  population: number[][][];
  generation: number;
  fitness: number[];
}

// Offline task model
export type OfflineTaskStatus = 'pending' | 'running' | 'done' | 'failed';
export type ActionClass = 'immediate' | 'preview' | 'automation-write' | 'offline-commit';

export interface OfflineTask {
  id: string;
  taskType: string;
  scope: string;
  params: Record<string, unknown>;
  status: OfflineTaskStatus;
  undoable: boolean;
  resultAssetId?: string;
  createdAt: number;
}

// Composer preset
export interface ComposerPreset {
  id: string;
  name: string;
  settings: ComposerSettings;
}
