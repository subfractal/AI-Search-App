/**
 * Track Classifier — auto-classifies imported audio files by spectral analysis
 * and filename keywords. Assigns role, color, and suggested name.
 */

import type { MusicalRole } from '@/types/ai';
import type { TrackClassification } from '@/types/commands';
import { buildSpectralProfile } from './spectral-profiler';

// Keyword -> role mapping (checked first, highest confidence)
const FILENAME_KEYWORDS: Record<string, MusicalRole> = {
  kick: 'drums',
  snare: 'drums',
  hihat: 'drums',
  'hi-hat': 'drums',
  clap: 'drums',
  hat: 'drums',
  tom: 'drums',
  cymbal: 'drums',
  drum: 'drums',
  perc: 'percussion',
  shaker: 'percussion',
  tamb: 'percussion',
  conga: 'percussion',
  bass: 'bass',
  sub: 'bass',
  808: 'bass',
  vocal: 'vocal',
  vox: 'vocal',
  voice: 'vocal',
  acapella: 'vocal',
  lead: 'lead',
  melody: 'lead',
  synth: 'lead',
  pad: 'pad',
  ambient: 'pad',
  atmosphere: 'pad',
  texture: 'pad',
  chord: 'chords',
  keys: 'chords',
  piano: 'chords',
  organ: 'chords',
  guitar: 'chords',
  arp: 'arp',
  arpegg: 'arp',
  fx: 'fx',
  riser: 'fx',
  sweep: 'fx',
  impact: 'fx',
  noise: 'fx',
};

// Role -> color mapping (deterministic)
const ROLE_COLORS: Record<MusicalRole, string> = {
  drums: '#E53E3E',
  percussion: '#ED8936',
  bass: '#3182CE',
  vocal: '#9F7AEA',
  lead: '#38B2AC',
  pad: '#4FD1C5',
  chords: '#48BB78',
  arp: '#ECC94B',
  fx: '#FC8181',
  general: '#A0AEC0',
};

// Role -> display label for naming
const ROLE_LABELS: Record<MusicalRole, string> = {
  drums: 'Drums',
  percussion: 'Perc',
  bass: 'Bass',
  vocal: 'Vocal',
  lead: 'Lead',
  pad: 'Pad',
  chords: 'Keys',
  arp: 'Arp',
  fx: 'FX',
  general: 'Audio',
};

type SpectralType = TrackClassification['spectralProfile'];

function classifyBySpectrum(
  buffer: AudioBuffer,
  trackId: string,
): { role: MusicalRole; profile: SpectralType; confidence: number } {
  const sp = buildSpectralProfile(trackId, buffer);

  // Percussive: high flatness (noise-like) + low centroid spread
  if (sp.flatness > 0.4 && sp.centroid < 3000) {
    return { role: 'drums', profile: 'percussive', confidence: 0.6 };
  }

  // Bass-heavy: dominant low band + low centroid
  if (sp.dominantBand === 'low' && sp.centroid < 500) {
    return { role: 'bass', profile: 'bass-heavy', confidence: 0.7 };
  }

  // Bright: high centroid + dominant high/highMid
  if (sp.centroid > 4000 && (sp.dominantBand === 'high' || sp.dominantBand === 'highMid')) {
    return { role: 'lead', profile: 'bright', confidence: 0.5 };
  }

  // Mid-focused: vocal-like range
  if (sp.dominantBand === 'mid' && sp.centroid > 800 && sp.centroid < 3000) {
    return { role: 'vocal', profile: 'mid-focused', confidence: 0.4 };
  }

  // Broadband: wide bandwidth, no dominant band
  return { role: 'general', profile: 'broadband', confidence: 0.3 };
}

/**
 * Clean up raw filenames into readable track names.
 * "track_01_final_v3" -> "Audio 01", "808_sub_bass_loop" -> "Bass"
 */
export function generateSmartName(fileName: string, role: MusicalRole): string {
  const label = ROLE_LABELS[role] ?? 'Audio';
  // Extract any trailing number from filename
  const numMatch = fileName.match(/(\d+)/);
  const num = numMatch ? ` ${numMatch[1]}` : '';
  return `${label}${num}`;
}

/**
 * Get deterministic color for a given role.
 */
export function pickRoleColor(role: MusicalRole): string {
  return ROLE_COLORS[role] ?? ROLE_COLORS.general;
}

/**
 * Classify an imported audio file by filename keywords and spectral analysis.
 */
export function classifyTrack(
  trackId: string,
  buffer: AudioBuffer,
  fileName: string,
): TrackClassification {
  const lowerName = fileName.toLowerCase().replace(/[_\-.\s]+/g, ' ');

  // Check filename keywords first (higher confidence)
  for (const [keyword, role] of Object.entries(FILENAME_KEYWORDS)) {
    if (lowerName.includes(keyword)) {
      return {
        suggestedRole: role,
        suggestedName: generateSmartName(fileName, role),
        suggestedColor: pickRoleColor(role),
        confidence: 0.85,
        spectralProfile: 'broadband', // filename match, skip spectral detail
      };
    }
  }

  // Fall back to spectral classification
  const spectral = classifyBySpectrum(buffer, trackId);
  return {
    suggestedRole: spectral.role,
    suggestedName: generateSmartName(fileName, spectral.role),
    suggestedColor: pickRoleColor(spectral.role),
    confidence: spectral.confidence,
    spectralProfile: spectral.profile,
  };
}
