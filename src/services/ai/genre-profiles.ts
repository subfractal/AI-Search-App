import type { MixGenre, GenreProfile, StreamingTarget } from '@/types/ai';

/**
 * Genre-specific mixing/mastering profiles based on industry standards.
 * Each profile defines target loudness, dynamic range, and frequency tolerances.
 */
export const GENRE_PROFILES: Record<MixGenre, GenreProfile> = {
  pop: {
    name: 'Pop',
    targetLufs: -14,
    maxTruePeak: -1.0,
    dynamicRangeMin: 6,
    dynamicRangeMax: 14,
    lowEndTolerance: 8,
    highEndTolerance: 6,
    compressionThreshold: 20,
    description: 'Vocal-forward, polished. Bright, clear, present EQ.',
  },
  edm: {
    name: 'EDM',
    targetLufs: -8,
    maxTruePeak: -1.0,
    dynamicRangeMin: 4,
    dynamicRangeMax: 10,
    lowEndTolerance: 12,
    highEndTolerance: 8,
    compressionThreshold: 15,
    description: 'High loudness, heavy kick/bass. Clipper stage common.',
  },
  rock: {
    name: 'Rock',
    targetLufs: -12,
    maxTruePeak: -1.0,
    dynamicRangeMin: 8,
    dynamicRangeMax: 18,
    lowEndTolerance: 10,
    highEndTolerance: 8,
    compressionThreshold: 22,
    description: 'Live energy, guitar girth. Saturation and aggressive mids.',
  },
  'hip-hop': {
    name: 'Hip-Hop',
    targetLufs: -10,
    maxTruePeak: -1.0,
    dynamicRangeMin: 5,
    dynamicRangeMax: 12,
    lowEndTolerance: 14,
    highEndTolerance: 6,
    compressionThreshold: 18,
    description: 'Bass weight, upfront vocals. Hard 808s, 3-5kHz kick click.',
  },
  jazz: {
    name: 'Jazz',
    targetLufs: -18,
    maxTruePeak: -1.0,
    dynamicRangeMin: 15,
    dynamicRangeMax: 35,
    lowEndTolerance: 8,
    highEndTolerance: 5,
    compressionThreshold: 30,
    description: 'Natural dynamics, ensemble balance. Transparency over loudness.',
  },
  classical: {
    name: 'Classical',
    targetLufs: -20,
    maxTruePeak: -1.0,
    dynamicRangeMin: 20,
    dynamicRangeMax: 50,
    lowEndTolerance: 6,
    highEndTolerance: 4,
    compressionThreshold: 40,
    description: 'Venue acoustics, full dynamic range. Organic and transparent.',
  },
  general: {
    name: 'General',
    targetLufs: -14,
    maxTruePeak: -1.0,
    dynamicRangeMin: 8,
    dynamicRangeMax: 25,
    lowEndTolerance: 10,
    highEndTolerance: 8,
    compressionThreshold: 25,
    description: 'Balanced profile suitable for most content.',
  },
};

/**
 * Streaming platform loudness normalization targets.
 * Based on 2026 industry standards.
 */
export const STREAMING_TARGETS: StreamingTarget[] = [
  {
    name: 'Spotify',
    integratedLufs: -14,
    maxTruePeak: -1.0,
    note: 'Normalization "Normal" mode',
  },
  {
    name: 'Apple Music',
    integratedLufs: -16,
    maxTruePeak: -1.0,
    note: 'Rewards dynamic range',
  },
  {
    name: 'YouTube',
    integratedLufs: -14,
    maxTruePeak: -1.0,
    note: 'Common for music/video',
  },
  {
    name: 'Tidal',
    integratedLufs: -14,
    maxTruePeak: -1.0,
    note: 'High-fidelity focus',
  },
  {
    name: 'Amazon Music',
    integratedLufs: -14,
    maxTruePeak: -2.0,
    note: 'More conservative true peak',
  },
];

export function getGenreProfile(genre: MixGenre): GenreProfile {
  return GENRE_PROFILES[genre];
}
