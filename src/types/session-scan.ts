/**
 * Types for Session Intelligence Scanner and related AI features.
 */

import type { MixGenre, AudioSection, MixAnalysis } from './ai';
import type { DetectedChord, HarmonicTopography } from './harmony';

// ─── Session Intelligence Scan ───

export interface TrackRoleGuess {
  trackId: string;
  role: string;
  confidence: number;
  spectralCategory: string;
}

export interface TempoEstimate {
  bpm: number;
  confidence: number;
  timeSignature: string;
}

export interface KeyEstimate {
  key: string;
  scale: 'major' | 'minor' | 'other';
  confidence: number;
}

export interface SessionScanResult {
  tempo: TempoEstimate;
  key: KeyEstimate;
  sections: AudioSection[];
  chords: DetectedChord[];
  trackRoles: TrackRoleGuess[];
  energyCurve: number[];
  mixAnalysis: MixAnalysis;
  harmony: HarmonicTopography | null;
  scannedAt: number;
}

// ─── Enriched Session Scan ───

export interface ClippingIssue {
  trackId: string;
  peakDb: number;
  clippingSamples: number;
  regionStart: number;
  regionEnd: number;
}

export interface PhaseIssue {
  trackId: string;
  correlation: number;
  monoCompatible: boolean;
  severity: 'low' | 'medium' | 'high';
}

export interface StereoBalanceInfo {
  trackId: string;
  pan: number;
  stereoWidth: number;
  imbalance: number; // 0 = balanced, 1 = fully one-sided
}

export interface MaskingHotspot {
  trackAId: string;
  trackBId: string;
  bands: string[];
  severity: number;
  suggestedAction: string;
}

export interface DynamicProfile {
  trackId: string;
  rms: number;
  peak: number;
  dynamicRange: number;
  crestFactor: number;
  loudnessLufs: number | null;
}

export interface GainStagingIssue {
  trackId: string;
  currentPeak: number;
  suggestedAdjustment: number;
  headroomDb: number;
}

export interface EnrichedScanResult extends SessionScanResult {
  clippingIssues: ClippingIssue[];
  phaseIssues: PhaseIssue[];
  stereoBalance: StereoBalanceInfo[];
  maskingHotspots: MaskingHotspot[];
  dynamicProfiles: DynamicProfile[];
  gainStagingIssues: GainStagingIssue[];
  overallHealth: number; // 0-100 score
}

// ─── Arrangement Map ───

export type ArrangementSectionType =
  | 'intro'
  | 'verse'
  | 'pre-chorus'
  | 'chorus'
  | 'bridge'
  | 'breakdown'
  | 'drop'
  | 'outro'
  | 'interlude'
  | 'build';

export interface ArrangementSuggestion {
  sectionType: ArrangementSectionType;
  startBar: number;
  lengthBars: number;
  energy: number;
  description: string;
}

export interface ArrangementMap {
  suggestions: ArrangementSuggestion[];
  totalBars: number;
  genre: MixGenre;
  energyCurve: number[];
}

// ─── Adaptive Template ───

export interface AdaptiveTemplate {
  id: string;
  name: string;
  genre: MixGenre;
  bpm: number;
  key: string;
  trackStack: TemplateTrackDef[];
  busStructure: TemplateBusDef[];
  suggestedEffects: TemplateEffectDef[];
  createdFrom: string;
  createdAt: number;
}

export interface TemplateTrackDef {
  name: string;
  type: 'audio' | 'midi';
  role: string;
  color: string;
  volume: number;
  pan: number;
}

export interface TemplateBusDef {
  name: string;
  type: 'group' | 'return';
  receivesFrom: string[];
}

export interface TemplateEffectDef {
  trackRole: string;
  effectType: string;
  params: Record<string, number>;
  reason: string;
}

// ─── MIDI Generator ───

export type GeneratorPattern = 'drum' | 'bass' | 'arp' | 'chord-comp' | 'melody';

export interface MidiGeneratorConfig {
  pattern: GeneratorPattern;
  bars: number;
  genre: MixGenre;
  complexity: number;
  swing: number;
  key: string;
  scale: 'major' | 'minor';
  octave: number;
  velocity: number;
}

// ─── Audio-to-MIDI ───

export type TranscriptionMode = 'melody' | 'bass' | 'chords';

export interface TranscriptionResult {
  notes: Array<{ pitch: number; velocity: number; startTime: number; duration: number }>;
  mode: TranscriptionMode;
  confidence: number;
  trackId: string;
}

// ─── Stem Separation ───

export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

export interface StemResult {
  stems: Array<{ type: StemType; buffer: AudioBuffer; name: string }>;
  sourceTrackId: string;
}

// ─── Reference Matching ───

export interface ReferenceDelta {
  parameter: string;
  category: 'loudness' | 'tonal' | 'dynamics' | 'stereo' | 'spectral';
  current: number;
  reference: number;
  delta: number;
  unit: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface ReferenceMatchResult {
  deltas: ReferenceDelta[];
  overallSimilarity: number;
  referenceAnalysis: { rms: number; peak: number; spectral: number[] };
  mixAnalysis: { rms: number; peak: number; spectral: number[] };
}

export interface SectionReferenceDelta extends ReferenceDelta {
  sectionLabel: string;
  sectionStart: number;
  sectionEnd: number;
}

export interface SectionReferenceComparison {
  sectionLabel: string;
  sectionStart: number;
  sectionEnd: number;
  deltas: ReferenceDelta[];
  similarity: number;
}

export interface EnrichedReferenceResult extends ReferenceMatchResult {
  sections: SectionReferenceComparison[];
  perSectionSimilarity: number[];
}

// ─── Routing Builder ───

export interface RoutingSuggestion {
  type: 'group' | 'send' | 'sidechain';
  name: string;
  sourceTrackIds: string[];
  targetName: string;
  reason: string;
  priority: number;
}

export interface RoutingPlan {
  groups: RoutingSuggestion[];
  sends: RoutingSuggestion[];
  sidechains: RoutingSuggestion[];
}

// ─── Collaboration ───

export interface CollaboratorPresence {
  userId: string;
  displayName: string;
  color: string;
  cursorPosition: number;
  activeTrackId: string | null;
  lastSeen: number;
}

export interface CollabSession {
  sessionId: string;
  projectId: string;
  collaborators: CollaboratorPresence[];
  isHost: boolean;
  status: 'connected' | 'disconnected' | 'reconnecting';
}
