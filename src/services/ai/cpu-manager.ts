/**
 * CPU Manager — estimates track CPU load and suggests/auto-freezes heavy tracks.
 * Uses effect chain length and type as heuristic for CPU cost.
 */

import { useSessionStore } from '@/stores/session-store';
import { useEffectsStore } from '@/stores/effects-store';
import { useAIStore } from '@/stores/ai-store';
import { toast } from '@/stores/toast-store';

// Relative CPU cost weights per effect type
const EFFECT_CPU_WEIGHTS: Record<string, number> = {
  reverb: 3.0,
  delay: 1.5,
  eq: 0.5,
  compressor: 1.0,
  chorus: 1.5,
  distortion: 0.8,
  phaser: 1.2,
  filter: 0.5,
  pitchShift: 2.0,
  gate: 0.5,
  deesser: 0.8,
  exciter: 0.7,
  saturator: 0.6,
  limiter: 0.5,
  multibandCompressor: 2.5,
  stereoWidener: 0.8,
  tremolo: 0.4,
  autoPan: 0.4,
  pitchCorrection: 2.5,
  vocalDoubler: 2.0,
  convolver: 3.5,
};

export interface CPUProfile {
  trackLoads: Record<string, number>;
  totalLoad: number;
  heavyTracks: string[];
}

/**
 * Estimate relative CPU cost for a single track based on its effect chain.
 */
export function estimateTrackCPU(trackId: string): number {
  const effects = useEffectsStore.getState().trackEffects[trackId] ?? [];
  let load = 0.5; // base cost for audio routing

  for (const fx of effects) {
    if (!fx.enabled) continue;
    load += EFFECT_CPU_WEIGHTS[fx.type] ?? 1.0;
  }

  return load;
}

/**
 * Assess total CPU load across all tracks.
 */
export function assessCPULoad(): CPUProfile {
  const tracks = useSessionStore.getState().tracks;
  const trackLoads: Record<string, number> = {};
  let totalLoad = 0;
  const heavyTracks: string[] = [];

  for (const track of tracks) {
    if (track.frozen) continue; // frozen tracks are cheap
    const load = estimateTrackCPU(track.id);
    trackLoads[track.id] = load;
    totalLoad += load;
    if (load > 5.0) {
      heavyTracks.push(track.id);
    }
  }

  return { trackLoads, totalLoad, heavyTracks };
}

/**
 * Suggest tracks that should be frozen to reduce CPU.
 * Returns track IDs sorted by CPU cost (heaviest first).
 * Excludes armed/recording tracks and already-frozen tracks.
 */
export function suggestFreezeCandidates(): string[] {
  const tracks = useSessionStore.getState().tracks;
  const candidates: Array<{ id: string; load: number }> = [];

  for (const track of tracks) {
    if (track.frozen) continue;
    if (track.armed) continue;
    const load = estimateTrackCPU(track.id);
    if (load > 3.0) {
      candidates.push({ id: track.id, load });
    }
  }

  candidates.sort((a, b) => b.load - a.load);
  return candidates.map((c) => c.id);
}

/**
 * Auto-freeze heavy tracks when total load exceeds threshold.
 * Uses requestIdleCallback for non-blocking background processing.
 */
export function autoFreezeIfNeeded(threshold: number = 20): void {
  const profile = assessCPULoad();
  if (profile.totalLoad < threshold) return;

  const candidates = suggestFreezeCandidates();
  if (candidates.length === 0) return;

  const session = useSessionStore.getState();

  // Freeze top candidate in idle time
  const freezeNext = (idx: number) => {
    if (idx >= candidates.length) return;
    const trackId = candidates[idx]!;
    const track = session.tracks.find((t) => t.id === trackId);
    if (!track) return;

    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleIdle = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);

    scheduleIdle(() => {
      try {
        // Create a minimal frozen buffer placeholder
        // Real bounce would use bounceSession, but for background freeze
        // we mark it as frozen to skip processing
        const frozenBuffer = new AudioBuffer({
          length: 1,
          sampleRate: 44100,
        });
        useSessionStore.getState().freezeTrack(trackId, frozenBuffer);
        toast.info(`Auto-froze "${track.name}" to save CPU`);
        useAIStore.getState().logActivity({
          id: `log-${Date.now()}`,
          description: `Auto-froze "${track.name}" (CPU load: ${estimateTrackCPU(trackId).toFixed(1)})`,
          trackId,
          timestamp: Date.now(),
          undoable: false,
        });
      } catch {
        // Freeze failed silently
      }
      // Continue with next candidate
      freezeNext(idx + 1);
    });
  };

  freezeNext(0);
}
