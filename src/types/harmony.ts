export interface DetectedChord {
  root: string;
  quality: 'major' | 'minor' | 'dim' | 'aug' | '7' | 'maj7' | 'min7' | 'sus2' | 'sus4';
  startBeat: number;
  endBeat: number;
  notes: number[];
}

export interface HarmonicTopography {
  key: string;
  scale: 'major' | 'minor';
  chordProgression: DetectedChord[];
  tensionCurve: number[];
  scaleConsistency: number;
  suggestedNextChords: string[];
}

export type ReharmonizationStyle =
  | 'neo-soul'
  | 'jazz'
  | 'lo-fi'
  | 'classical'
  | 'edm'
  | 'blues'
  | 'gospel';

export interface StyleProfile {
  name: string;
  chordExtensions: number[];
  voicingSpread: number;
  rhythmQuantize: number;
  velocityCurve: 'flat' | 'dynamic' | 'soft';
  swingAmount: number;
  substitutions: Record<string, string[]>;
}

export interface PhraseAnalysis {
  phrases: Array<{
    startBeat: number;
    endBeat: number;
    noteCount: number;
    avgVelocity: number;
    density: number;
  }>;
  overallDensity: number;
  phraseLengthVariance: number;
}
