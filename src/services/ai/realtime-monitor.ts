import { useAIStore } from '@/stores/ai-store';
import { useSessionStore } from '@/stores/session-store';
import { getTrackLevel } from '@/services/track-manager';
import type { RealtimeLevel } from '@/types/ai';

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastAutoAnalysis = 0;

const CLIPPING_THRESHOLD_DB = -0.5;
const CLIPPING_PERSIST_MS = 2000;
const AUTO_ANALYSIS_DEBOUNCE_MS = 10000;

// Per-track clipping start times
const clippingStartTimes = new Map<string, number>();

export function startMonitoring(intervalMs: number = 500): void {
  if (monitorInterval !== null) return;

  monitorInterval = setInterval(() => {
    const tracks = useSessionStore.getState().tracks;
    const aiStore = useAIStore.getState();
    if (!aiStore.enabled || tracks.length === 0) return;

    const levels: Record<string, RealtimeLevel> = {};
    const clippingAlerts: string[] = [];
    const now = Date.now();
    let hasIssue = false;

    for (const track of tracks) {
      const db = getTrackLevel(track.id);
      const clipping = db > CLIPPING_THRESHOLD_DB;

      levels[track.id] = {
        rms: db,
        peak: db,
        clipping,
      };

      if (clipping) {
        if (!clippingStartTimes.has(track.id)) {
          clippingStartTimes.set(track.id, now);
        }
        const clippingDuration = now - (clippingStartTimes.get(track.id) ?? now);
        if (clippingDuration > CLIPPING_PERSIST_MS) {
          clippingAlerts.push(track.id);
          hasIssue = true;
        }
      } else {
        clippingStartTimes.delete(track.id);
      }
    }

    aiStore.setRealtimeLevels(levels);
    if (clippingAlerts.length > 0) {
      aiStore.setClippingAlerts(clippingAlerts);
    }

    // Trigger auto-analysis if persistent issues detected (debounced)
    if (hasIssue && now - lastAutoAnalysis > AUTO_ANALYSIS_DEBOUNCE_MS) {
      lastAutoAnalysis = now;
      // Dynamically import to avoid circular dependency
      import('./suggestion-engine').then(({ runAnalysis }) => {
        runAnalysis();
      });
    }
  }, intervalMs);
}

export function stopMonitoring(): void {
  if (monitorInterval !== null) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  clippingStartTimes.clear();
  useAIStore.getState().setClippingAlerts([]);
}

export function isMonitoring(): boolean {
  return monitorInterval !== null;
}

export function toggleMonitoring(): void {
  if (isMonitoring()) {
    stopMonitoring();
  } else {
    startMonitoring();
  }
}
