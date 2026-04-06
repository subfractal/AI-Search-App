/**
 * AI Device Control — reads and adjusts native device parameters
 * with explainable reasoning and reversible changes.
 */

import { useEffectsStore } from '@/stores/effects-store';
import { useSessionStore } from '@/stores/session-store';
import { analyzeMix } from './mix-analyzer';

export interface DeviceParameterDelta {
  trackId: string;
  trackName: string;
  effectId: string;
  effectType: string;
  paramName: string;
  before: number;
  after: number;
  reason: string;
}

export interface DeviceControlResult {
  deltas: DeviceParameterDelta[];
  explanation: string;
  reversible: boolean;
  timestamp: number;
}

// Snapshot for undo
let lastSnapshot: Map<string, Record<string, Record<string, number | string>>> | null = null;

/**
 * Take a snapshot of all current effect parameters.
 */
function takeSnapshot(): Map<string, Record<string, Record<string, number | string>>> {
  const effects = useEffectsStore.getState();
  const snap = new Map<string, Record<string, Record<string, number | string>>>();
  for (const [trackId, fxList] of Object.entries(effects.trackEffects)) {
    const trackSnap: Record<string, Record<string, number | string>> = {};
    for (const fx of fxList) {
      trackSnap[fx.id] = { ...fx.params };
    }
    snap.set(trackId, trackSnap);
  }
  return snap;
}

/**
 * Revert to last snapshot.
 */
export function revertDeviceChanges(): boolean {
  if (!lastSnapshot) return false;
  const effects = useEffectsStore.getState();
  for (const [trackId, fxSnap] of lastSnapshot.entries()) {
    for (const [fxId, params] of Object.entries(fxSnap)) {
      effects.updateEffect(trackId, fxId, params);
    }
  }
  lastSnapshot = null;
  return true;
}

/**
 * AI-driven device parameter adjustment based on mix analysis.
 * Analyzes the current mix and suggests/applies parameter changes
 * to existing effects.
 */
export function runDeviceOptimization(): DeviceControlResult {
  const session = useSessionStore.getState();
  const effects = useEffectsStore.getState();
  const sampleRate = session.config.sampleRate;

  // Take snapshot before changes
  lastSnapshot = takeSnapshot();

  const analysis = analyzeMix(session.tracks, sampleRate);
  const deltas: DeviceParameterDelta[] = [];

  for (const track of session.tracks) {
    const trackEffects = effects.trackEffects[track.id] ?? [];
    const ta = analysis.tracks.find(t => t.trackId === track.id);
    if (!ta) continue;

    for (const fx of trackEffects) {
      if (!fx.enabled) continue;
      // Cast params to generic record for safe property access
      const p = fx.params as unknown as Record<string, number | string>;

      // EQ optimization
      if (fx.type === 'eq') {
        // If track has excessive low end, cut lows
        if (ta.frequency.low - ta.frequency.mid > 8) {
          const before = typeof p.low === 'number' ? p.low : 0;
          const after = Math.max(-12, before - 3);
          if (before !== after) {
            effects.updateEffect(track.id, fx.id, { low: after });
            deltas.push({
              trackId: track.id, trackName: track.name,
              effectId: fx.id, effectType: fx.type,
              paramName: 'low', before, after,
              reason: `Low-end buildup: ${ta.frequency.low.toFixed(0)} dB vs mid `
                + `${ta.frequency.mid.toFixed(0)} dB`,
            });
          }
        }
        // If harsh highs, cut highs
        if (ta.frequency.high - ta.frequency.mid > 6) {
          const before = typeof p.high === 'number' ? p.high : 0;
          const after = Math.max(-12, before - 2);
          if (before !== after) {
            effects.updateEffect(track.id, fx.id, { high: after });
            deltas.push({
              trackId: track.id, trackName: track.name,
              effectId: fx.id, effectType: fx.type,
              paramName: 'high', before, after,
              reason: `Harsh highs: ${ta.frequency.high.toFixed(0)} dB vs mid `
                + `${ta.frequency.mid.toFixed(0)} dB`,
            });
          }
        }
      }

      // Compressor optimization
      if (fx.type === 'compressor') {
        // If dynamic range is very wide, lower threshold
        if (ta.level.dynamicRange > 25) {
          const before = typeof p.threshold === 'number' ? p.threshold : -20;
          const after = Math.max(-40, before - 3);
          if (before !== after) {
            effects.updateEffect(track.id, fx.id, { threshold: after });
            deltas.push({
              trackId: track.id, trackName: track.name,
              effectId: fx.id, effectType: fx.type,
              paramName: 'threshold', before, after,
              reason: `Wide dynamics (${ta.level.dynamicRange.toFixed(0)} dB DR)`
                + ' — lowering threshold for more control',
            });
          }
        }
        // If attack is very slow and track is percussive
        if (ta.level.dynamicRange > 15 && typeof p.attack === 'number' && p.attack > 0.05) {
          const before = p.attack;
          const after = Math.max(0.001, before * 0.5);
          effects.updateEffect(track.id, fx.id, { attack: after });
          deltas.push({
            trackId: track.id, trackName: track.name,
            effectId: fx.id, effectType: fx.type,
            paramName: 'attack', before,
            after: Math.round(after * 1000) / 1000,
            reason: 'Faster attack to catch transients',
          });
        }
      }

      // Reverb optimization
      if (fx.type === 'reverb') {
        // If stereo image is narrow, increase reverb wet
        if (analysis.stereoWidth < 0.2 && typeof p.wet === 'number') {
          const before = p.wet;
          const after = Math.min(1, before + 0.1);
          if (before !== after) {
            effects.updateEffect(track.id, fx.id, { wet: after });
            deltas.push({
              trackId: track.id, trackName: track.name,
              effectId: fx.id, effectType: fx.type,
              paramName: 'wet', before, after,
              reason: `Narrow stereo image `
                + `(${Math.round(analysis.stereoWidth * 100)}%)`
                + ' — adding reverb width',
            });
          }
        }
      }
    }
  }

  return {
    deltas,
    explanation: deltas.length > 0
      ? `Optimized ${deltas.length} parameter(s) across `
        + `${new Set(deltas.map(d => d.trackId)).size} track(s)`
      : 'No optimizations needed — current settings look good',
    reversible: true,
    timestamp: Date.now(),
  };
}
