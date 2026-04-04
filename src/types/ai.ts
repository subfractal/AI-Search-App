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
}

export interface SuggestionAction {
  type: 'setVolume' | 'setPan' | 'mute' | 'unmute' | 'addEffect' | 'batch';
  trackId: string;
  value?: number;
  // For addEffect actions
  effectType?: string;
  effectParams?: Record<string, number | string>;
  // For batch actions (multiple changes at once)
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

// Genre profiles for context-aware analysis
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

// Streaming platform loudness targets
export interface StreamingTarget {
  name: string;
  integratedLufs: number;
  maxTruePeak: number;
  note: string;
}

// Phase correlation between stereo channels or track pairs
export interface PhaseCorrelation {
  trackId: string;
  correlation: number; // -1 (out of phase) to +1 (in phase)
  monoCompatible: boolean;
}
