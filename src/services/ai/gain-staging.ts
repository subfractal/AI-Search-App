import type { TrackAnalysis, GainStagingResult, GainStagingTrack } from '@/types/ai';
import { useMixerStore } from '@/stores/mixer-store';
import { useSessionStore } from '@/stores/session-store';

const TARGET_PEAK_DB = -6;
const MASTER_HEADROOM_DB = -3;

/**
 * Analyze current gain staging and calculate suggested volume adjustments
 * to bring each track to a target peak level with proper headroom.
 */
export function analyzeGainStaging(
  trackAnalyses: TrackAnalysis[],
): GainStagingResult {
  const session = useSessionStore.getState();
  const tracks: GainStagingTrack[] = [];

  for (const analysis of trackAnalyses) {
    const track = session.tracks.find((t) => t.id === analysis.trackId);
    if (!track) continue;

    const currentPeak = analysis.level.peak;
    const adjustment = TARGET_PEAK_DB - currentPeak;
    const suggestedVolume = track.volume + adjustment;

    tracks.push({
      trackId: analysis.trackId,
      trackName: track.name,
      currentPeak,
      currentVolume: track.volume,
      suggestedVolume: Math.round(suggestedVolume * 10) / 10,
      adjustment: Math.round(adjustment * 10) / 10,
    });
  }

  // Estimate if summed output would exceed master headroom
  // Simplified: assume peaks could sum (worst case)
  const summedPeakLinear = tracks.reduce(
    (sum, t) => sum + Math.pow(10, (t.suggestedVolume + TARGET_PEAK_DB) / 20),
    0,
  );
  const estimatedSumDb =
    summedPeakLinear > 0 ? 20 * Math.log10(summedPeakLinear) : -Infinity;

  let masterAdjustment = 0;
  if (estimatedSumDb > MASTER_HEADROOM_DB) {
    masterAdjustment = MASTER_HEADROOM_DB - estimatedSumDb;
    // Apply master adjustment to each track
    for (const t of tracks) {
      t.suggestedVolume =
        Math.round((t.suggestedVolume + masterAdjustment) * 10) / 10;
      t.adjustment = Math.round((t.adjustment + masterAdjustment) * 10) / 10;
    }
  }

  return {
    tracks,
    headroom: MASTER_HEADROOM_DB,
    masterAdjustment: Math.round(masterAdjustment * 10) / 10,
  };
}

/**
 * Apply gain staging result — sets all track volumes to suggested values.
 */
export function applyGainStaging(result: GainStagingResult): void {
  const mixer = useMixerStore.getState();
  const session = useSessionStore.getState();

  for (const t of result.tracks) {
    mixer.setVolume(t.trackId, t.suggestedVolume);
    session.updateTrack(t.trackId, { volume: t.suggestedVolume });
  }
}
