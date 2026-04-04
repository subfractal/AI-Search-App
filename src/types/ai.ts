export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'applied';
export type SuggestionType =
  | 'level'
  | 'pan'
  | 'eq'
  | 'compression'
  | 'noise'
  | 'clipping'
  | 'arrangement'
  | 'general';

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
  type: 'setVolume' | 'setPan' | 'mute' | 'unmute';
  trackId: string;
  value?: number;
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

export interface TrackAnalysis {
  trackId: string;
  level: LevelAnalysis;
  frequency: FrequencyAnalysis;
  silenceRegions: Array<{ start: number; end: number }>;
  noiseFloor: number;
}

export interface MixAnalysis {
  tracks: TrackAnalysis[];
  overallLevel: LevelAnalysis;
  frequencyBalance: FrequencyAnalysis;
  stereoWidth: number;
  timestamp: number;
}

export interface AIActivityEntry {
  id: string;
  description: string;
  trackId: string | null;
  timestamp: number;
  undoable: boolean;
}
