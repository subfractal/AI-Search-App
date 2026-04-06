import type { TrackAnalysis, FrequencyAnalysis, MaskingPair } from '@/types/ai';

const BAND_NAMES: (keyof FrequencyAnalysis)[] = [
  'low',
  'lowMid',
  'mid',
  'highMid',
  'high',
];

const BAND_LABELS: Record<string, string> = {
  low: 'Low (20-250 Hz)',
  lowMid: 'Low-Mid (250-1k Hz)',
  mid: 'Mid (1k-4k Hz)',
  highMid: 'High-Mid (4k-8k Hz)',
  high: 'High (8k-20k Hz)',
};

/**
 * Detect frequency masking between two tracks by comparing per-band energy.
 * Overlap coefficient = min(energyA, energyB) / max(energyA, energyB)
 * in linear power domain. Bands with overlap > threshold are flagged.
 */
export function detectMasking(
  trackA: TrackAnalysis,
  trackB: TrackAnalysis,
  overlapThreshold: number = 0.7,
): MaskingPair | null {
  const maskedBands: string[] = [];
  let totalOverlap = 0;

  for (const band of BAND_NAMES) {
    const energyA = Math.pow(10, trackA.frequency[band] / 10);
    const energyB = Math.pow(10, trackB.frequency[band] / 10);
    const maxE = Math.max(energyA, energyB);

    if (maxE < 1e-10) continue;

    const overlap = Math.min(energyA, energyB) / maxE;
    totalOverlap += overlap;

    if (overlap > overlapThreshold) {
      maskedBands.push(BAND_LABELS[band] ?? band);
    }
  }

  if (maskedBands.length === 0) return null;

  const severity = totalOverlap / BAND_NAMES.length;

  // Suggest EQ cut on the track with lower peak (less dominant)
  const aIsDominant = trackA.level.peak >= trackB.level.peak;
  const suggestedAction = aIsDominant
    ? `Apply EQ cut on the quieter track in: ${maskedBands.join(', ')}`
    : `Apply EQ cut on the quieter track in: ${maskedBands.join(', ')}`;

  return {
    trackAId: trackA.trackId,
    trackBId: trackB.trackId,
    maskedBands,
    severity,
    suggestedAction,
    dominantTrackId: aIsDominant ? trackA.trackId : trackB.trackId,
  };
}

/**
 * Analyze all pairs of tracks for spectral masking.
 * Returns only pairs with significant overlap.
 */
export function analyzeAllMasking(
  tracks: TrackAnalysis[],
): MaskingPair[] {
  const pairs: MaskingPair[] = [];

  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const pair = detectMasking(tracks[i]!, tracks[j]!);
      if (pair && pair.severity > 0.5) {
        pairs.push(pair);
      }
    }
  }

  // Sort by severity (worst first)
  pairs.sort((a, b) => b.severity - a.severity);
  return pairs;
}
