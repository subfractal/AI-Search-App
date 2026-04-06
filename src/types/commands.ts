import type { MusicalRole } from './ai';

export type CommandIntent =
  | 'duck'
  | 'setVolume'
  | 'setPan'
  | 'mute'
  | 'unmute'
  | 'solo'
  | 'unsolo'
  | 'addEffect'
  | 'removeEffect'
  | 'freeze'
  | 'unfreeze'
  | 'rename'
  | 'setColor'
  | 'analyze'
  | 'master'
  | 'compose'
  | 'export'
  | 'setBpm'
  | 'loop'
  | 'record'
  | 'play'
  | 'stop'
  // Arrangement commands
  | 'boostSection'
  | 'thinSection'
  | 'addBreakdown'
  | 'extendSection'
  | 'fadeOutro'
  | 'duplicateSection'
  | 'energyBuildup'
  // Mix commands
  | 'eqBoost'
  | 'eqCut'
  | 'widenStereo'
  | 'reduceMuddiness'
  | 'tightenLowEnd'
  | 'gainStaging'
  | 'addWarmth'
  | 'reduceHarshness'
  | 'compressTracks'
  // Session commands
  | 'balanceLevels'
  | 'engineeringScan'
  | 'sessionScan'
  | 'referenceMatch'
  | 'unknown';

export interface CommandTarget {
  type: 'trackName' | 'trackRole' | 'all' | 'selected';
  value: string;
}

export interface ParsedCommand {
  intent: CommandIntent;
  targets: CommandTarget[];
  params: Record<string, string | number>;
  confidence: number;
  raw: string;
}

export interface CommandResult {
  success: boolean;
  description: string;
  undoable: boolean;
  affectedTrackIds: string[];
}

export interface CommandGrammarRule {
  pattern: RegExp;
  intent: CommandIntent;
  extract: (match: RegExpMatchArray) => {
    targets: CommandTarget[];
    params: Record<string, string | number>;
  };
}

export interface TrackClassification {
  suggestedRole: MusicalRole;
  suggestedName: string;
  suggestedColor: string;
  confidence: number;
  spectralProfile: 'bass-heavy' | 'mid-focused' | 'bright' | 'percussive' | 'broadband';
}

export interface SpectralProfile {
  trackId: string;
  centroid: number;
  bandwidth: number;
  rolloff: number;
  flatness: number;
  dominantBand: 'low' | 'lowMid' | 'mid' | 'highMid' | 'high';
}
