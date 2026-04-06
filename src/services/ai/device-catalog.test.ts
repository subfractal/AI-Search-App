import { describe, it, expect } from 'vitest';
import { recommendEffectsForTrack, getTopRecommendations } from './device-catalog';
import type { TrackAnalysis } from '@/types/ai';
import type { EffectConfig } from '@/types/effects';

const makeAnalysis = (overrides: Partial<TrackAnalysis> = {}): TrackAnalysis => ({
  trackId: 'track-1',
  level: { rms: -18, peak: -6, dynamicRange: 12, clipping: false },
  frequency: { low: -20, lowMid: -18, mid: -15, highMid: -16, high: -18 },
  loudness: null,
  silenceRegions: [],
  noiseFloor: -60,
  ...overrides,
});

describe('Device Catalog', () => {
  describe('recommendEffectsForTrack', () => {
    it('returns empty for clean analysis', () => {
      const recs = recommendEffectsForTrack(makeAnalysis(), 'pop', []);
      // May still recommend stereo imager for pop
      for (const rec of recs) {
        expect(rec.effectType).toBeDefined();
        expect(rec.reason).toBeTruthy();
        expect(rec.priority).toBeGreaterThan(0);
      }
    });

    it('recommends gate for high noise floor', () => {
      const recs = recommendEffectsForTrack(
        makeAnalysis({ noiseFloor: -30 }),
        'general',
        [],
      );
      expect(recs.some((r) => r.effectType === 'gate')).toBe(true);
    });

    it('recommends de-esser for harsh highs', () => {
      const recs = recommendEffectsForTrack(
        makeAnalysis({
          frequency: { low: -20, lowMid: -18, mid: -20, highMid: -10, high: -10 },
        }),
        'general',
        [],
      );
      expect(recs.some((r) => r.effectType === 'deesser')).toBe(true);
    });

    it('recommends limiter when clipping', () => {
      const recs = recommendEffectsForTrack(
        makeAnalysis({
          level: { rms: -6, peak: 0, dynamicRange: 6, clipping: true },
        }),
        'general',
        [],
      );
      expect(recs.some((r) => r.effectType === 'limiter')).toBe(true);
    });

    it('recommends limiter for peaks near 0 dBFS', () => {
      const recs = recommendEffectsForTrack(
        makeAnalysis({
          level: { rms: -12, peak: -0.5, dynamicRange: 12, clipping: false },
        }),
        'general',
        [],
      );
      expect(recs.some((r) => r.effectType === 'limiter')).toBe(true);
    });

    it('does not duplicate existing effects', () => {
      const existing: EffectConfig[] = [
        { id: 'fx-1', type: 'gate', params: { threshold: -20, smoothing: 0.01 }, enabled: true },
      ];
      const recs = recommendEffectsForTrack(
        makeAnalysis({ noiseFloor: -30 }),
        'general',
        existing,
      );
      expect(recs.some((r) => r.effectType === 'gate')).toBe(false);
    });

    it('recommends exciter for dull high end', () => {
      const recs = recommendEffectsForTrack(
        makeAnalysis({
          frequency: { low: -20, lowMid: -18, mid: -10, highMid: -18, high: -20 },
        }),
        'general',
        [],
      );
      expect(recs.some((r) => r.effectType === 'exciter')).toBe(true);
    });

    it('recommends stereo imager for EDM', () => {
      const recs = recommendEffectsForTrack(makeAnalysis(), 'edm', []);
      expect(recs.some((r) => r.effectType === 'stereoImager')).toBe(true);
    });

    it('recommends saturator for rock/hip-hop', () => {
      const recs = recommendEffectsForTrack(makeAnalysis(), 'rock', []);
      expect(recs.some((r) => r.effectType === 'saturator')).toBe(true);
    });

    it('results are sorted by priority', () => {
      const recs = recommendEffectsForTrack(
        makeAnalysis({
          noiseFloor: -30,
          level: { rms: -6, peak: -0.5, dynamicRange: 20, clipping: false },
          frequency: { low: -20, lowMid: -18, mid: -10, highMid: -18, high: -20 },
        }),
        'edm',
        [],
      );
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i]!.priority).toBeGreaterThanOrEqual(recs[i - 1]!.priority);
      }
    });
  });

  describe('getTopRecommendations', () => {
    it('limits results to maxCount', () => {
      const recs = getTopRecommendations(
        makeAnalysis({
          noiseFloor: -30,
          level: { rms: -6, peak: -0.5, dynamicRange: 20, clipping: true },
          frequency: { low: -30, lowMid: -18, mid: -10, highMid: -18, high: -20 },
        }),
        'edm',
        [],
        2,
      );
      expect(recs.length).toBeLessThanOrEqual(2);
    });

    it('defaults to 3 max', () => {
      const recs = getTopRecommendations(
        makeAnalysis({
          noiseFloor: -30,
          level: { rms: -6, peak: -0.5, dynamicRange: 20, clipping: true },
          frequency: { low: -30, lowMid: -18, mid: -10, highMid: -18, high: -20 },
        }),
        'edm',
        [],
      );
      expect(recs.length).toBeLessThanOrEqual(3);
    });
  });
});
