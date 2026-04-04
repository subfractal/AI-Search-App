import type { PhaseCorrelation } from '@/types/ai';

/**
 * Calculate phase correlation for a stereo buffer.
 * Returns value from -1 (fully out of phase) to +1 (fully in phase).
 * Values below 0 indicate phase cancellation issues.
 * Mono-incompatible if correlation < 0.
 */
export function analyzePhaseCorrelation(
  trackId: string,
  buffer: AudioBuffer,
): PhaseCorrelation {
  // Need at least 2 channels for stereo correlation
  if (buffer.numberOfChannels < 2) {
    return { trackId, correlation: 1, monoCompatible: true };
  }

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const length = Math.min(left.length, right.length);

  let sumLR = 0;
  let sumLL = 0;
  let sumRR = 0;

  for (let i = 0; i < length; i++) {
    const l = left[i]!;
    const r = right[i]!;
    sumLR += l * r;
    sumLL += l * l;
    sumRR += r * r;
  }

  const denominator = Math.sqrt(sumLL * sumRR);
  const correlation = denominator > 0 ? sumLR / denominator : 1;

  return {
    trackId,
    correlation: Math.round(correlation * 100) / 100,
    monoCompatible: correlation >= 0,
  };
}

/**
 * Analyze phase for all tracks and return those with issues.
 */
export function analyzeAllPhase(
  trackIds: string[],
  buffers: Map<string, AudioBuffer>,
): PhaseCorrelation[] {
  const results: PhaseCorrelation[] = [];

  for (const trackId of trackIds) {
    const buffer = buffers.get(trackId);
    if (!buffer) continue;
    results.push(analyzePhaseCorrelation(trackId, buffer));
  }

  return results;
}
