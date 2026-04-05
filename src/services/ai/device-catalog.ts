import type { EffectType, EffectConfig } from '@/types/effects';
import type { TrackAnalysis, MixGenre } from '@/types/ai';

export interface DeviceRecommendation {
  effectType: EffectType;
  reason: string;
  params: Record<string, number>;
  priority: number; // 1 = highest
}

/**
 * Recommend effects for a track based on analysis data, genre, and existing effects.
 * The AI mastering pipeline and suggestion engine call this to determine which
 * stock devices to apply.
 */
export function recommendEffectsForTrack(
  analysis: TrackAnalysis,
  genre: MixGenre,
  existingEffects: EffectConfig[],
): DeviceRecommendation[] {
  const recommendations: DeviceRecommendation[] = [];
  const hasEffect = (type: EffectType) => existingEffects.some((e) => e.type === type);

  // 1. Noise gate — high noise floor
  if (analysis.noiseFloor > -40 && !hasEffect('gate')) {
    recommendations.push({
      effectType: 'gate',
      reason: `Noise floor at ${analysis.noiseFloor.toFixed(0)} dB — gate recommended`,
      params: { threshold: Math.min(-20, analysis.noiseFloor + 6), smoothing: 0.01 },
      priority: 2,
    });
  }

  // 2. De-esser — harsh high frequencies (vocal-like content)
  if (analysis.frequency.high > analysis.frequency.mid + 8 && !hasEffect('deesser')) {
    recommendations.push({
      effectType: 'deesser',
      reason: 'Harsh sibilance detected — de-esser recommended',
      params: { threshold: -30, ratio: 6, frequency: 6000 },
      priority: 3,
    });
  }

  // 3. Multiband compressor — uneven frequency balance with wide dynamics
  if (
    analysis.level.dynamicRange > 18 &&
    Math.abs(analysis.frequency.low - analysis.frequency.high) > 12 &&
    !hasEffect('multibandComp')
  ) {
    recommendations.push({
      effectType: 'multibandComp',
      reason: 'Uneven frequency dynamics — multiband compression recommended',
      params: {
        lowThreshold: -24, lowRatio: 3,
        midThreshold: -20, midRatio: 2,
        highThreshold: -18, highRatio: 2.5,
        lowFrequency: 250, highFrequency: 4000,
      },
      priority: 3,
    });
  }

  // 4. Limiter — peaks approaching 0 dBFS
  if (analysis.level.peak > -1.5 && !hasEffect('limiter')) {
    recommendations.push({
      effectType: 'limiter',
      reason: `Peak at ${analysis.level.peak.toFixed(1)} dBFS — limiter recommended`,
      params: { threshold: -1 },
      priority: 1,
    });
  }

  // 5. Clipping — add limiter urgently
  if (analysis.level.clipping && !hasEffect('limiter') && !hasEffect('compressor')) {
    recommendations.push({
      effectType: 'limiter',
      reason: 'Clipping detected — limiter required',
      params: { threshold: -1.5 },
      priority: 1,
    });
  }

  // 6. Stereo imager — narrow stereo width (needs context from mix analysis)
  // We infer narrow stereo from frequency characteristics heuristically
  if (!hasEffect('stereoImager')) {
    // For genres that benefit from width
    const widthGenres: MixGenre[] = ['edm', 'pop', 'rock'];
    if (widthGenres.includes(genre)) {
      recommendations.push({
        effectType: 'stereoImager',
        reason: `Stereo width enhancement for ${genre} mix`,
        params: { width: 0.7 },
        priority: 5,
      });
    }
  }

  // 7. Exciter — lacks presence (dull high end)
  if (analysis.frequency.high < analysis.frequency.mid - 6 && !hasEffect('exciter')) {
    recommendations.push({
      effectType: 'exciter',
      reason: 'Lacks high-end presence — exciter recommended',
      params: { drive: 0.15, wet: 0.3 },
      priority: 4,
    });
  }

  // 8. Saturator — warmth for appropriate genres
  const warmGenres: MixGenre[] = ['rock', 'hip-hop'];
  if (warmGenres.includes(genre) && !hasEffect('saturator') && !hasEffect('distortion')) {
    recommendations.push({
      effectType: 'saturator',
      reason: `Subtle saturation for ${genre} warmth`,
      params: { drive: 0.1, wet: 0.25 },
      priority: 5,
    });
  }

  // 9. High-pass filter — excessive low end (rumble)
  if (analysis.frequency.low > analysis.frequency.mid + 10 && !hasEffect('filter')) {
    recommendations.push({
      effectType: 'filter',
      reason: 'Excessive low-end rumble — high-pass filter recommended',
      params: { frequency: 80, type: 0, Q: 0.7, rolloff: -12 },
      priority: 2,
    });
  }

  // Sort by priority (lower number = higher priority)
  return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * Get top N device recommendations for a track.
 */
export function getTopRecommendations(
  analysis: TrackAnalysis,
  genre: MixGenre,
  existingEffects: EffectConfig[],
  maxCount = 3,
): DeviceRecommendation[] {
  return recommendEffectsForTrack(analysis, genre, existingEffects).slice(0, maxCount);
}
