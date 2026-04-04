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
  timestamp: number;
}

export interface AIActivityEntry {
  id: string;
  description: string;
  trackId: string | null;
  timestamp: number;
  undoable: boolean;
}
