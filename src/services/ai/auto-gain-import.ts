/**
 * Auto Gain on Import — normalizes imported audio to target peak level.
 * Extends existing gain-staging.ts for automatic import-time processing.
 */

import { useMixerStore } from '@/stores/mixer-store';
import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';

const TARGET_PEAK_DB = -6;
const MIN_ADJUSTMENT_DB = 1;

/**
 * Compute peak level of an audio buffer in dB.
 */
function computePeakDb(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]!);
    if (abs > peak) peak = abs;
  }
  return 20 * Math.log10(Math.max(peak, 1e-10));
}

/**
 * Auto-apply gain staging on import.
 * Adjusts track volume so peak reaches TARGET_PEAK_DB.
 * Returns the adjustment applied, or 0 if no adjustment was needed.
 */
export function autoGainOnImport(
  trackId: string,
  buffer: AudioBuffer,
): { adjustment: number; applied: boolean } {
  const peakDb = computePeakDb(buffer);
  const adjustment = TARGET_PEAK_DB - peakDb;

  // Only adjust if difference is significant
  if (Math.abs(adjustment) < MIN_ADJUSTMENT_DB) {
    return { adjustment: 0, applied: false };
  }

  const session = useSessionStore.getState();
  const track = session.tracks.find((t) => t.id === trackId);
  if (!track) return { adjustment: 0, applied: false };

  const newVolume = Math.round((track.volume + adjustment) * 10) / 10;
  useMixerStore.getState().setVolume(trackId, newVolume);
  session.updateTrack(trackId, { volume: newVolume });

  useAIStore.getState().logActivity({
    id: `gain-${Date.now()}`,
    description: `Auto gain staging: ${adjustment > 0 ? '+' : ''}${adjustment.toFixed(1)}dB on "${track.name}"`,
    trackId,
    timestamp: Date.now(),
    undoable: false,
  });

  return { adjustment: Math.round(adjustment * 10) / 10, applied: true };
}
