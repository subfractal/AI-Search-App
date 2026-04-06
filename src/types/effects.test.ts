import { describe, it, expect } from 'vitest';
import {
  EFFECT_LABELS,
  DEFAULT_PARAMS,
  EFFECT_KNOB_DEFS,
  EFFECT_PRESETS,
} from './effects';
import type { EffectType } from './effects';

const ALL_TYPES: EffectType[] = [
  'reverb', 'delay', 'eq', 'compressor', 'chorus', 'distortion',
  'phaser', 'filter', 'pitchShift', 'gate', 'deesser', 'multibandComp',
  'flanger', 'tremolo', 'stereoImager', 'frequencyShifter', 'ringMod',
  'exciter', 'utility', 'limiter', 'saturator',
];

describe('Effects Type Definitions', () => {
  it('has labels for all effect types', () => {
    for (const type of ALL_TYPES) {
      expect(EFFECT_LABELS[type]).toBeDefined();
      expect(EFFECT_LABELS[type]!.length).toBeGreaterThan(0);
    }
  });

  it('has default params for all effect types', () => {
    for (const type of ALL_TYPES) {
      expect(DEFAULT_PARAMS[type]).toBeDefined();
      expect(typeof DEFAULT_PARAMS[type]).toBe('object');
    }
  });

  it('has knob definitions for all effect types', () => {
    for (const type of ALL_TYPES) {
      expect(EFFECT_KNOB_DEFS[type]).toBeDefined();
      expect(Array.isArray(EFFECT_KNOB_DEFS[type])).toBe(true);
      expect(EFFECT_KNOB_DEFS[type]!.length).toBeGreaterThan(0);
    }
  });

  it('knob defs have valid min/max/step', () => {
    for (const type of ALL_TYPES) {
      for (const knob of EFFECT_KNOB_DEFS[type]!) {
        expect(knob.min).toBeLessThan(knob.max);
        if (knob.step !== undefined) {
          expect(knob.step).toBeGreaterThan(0);
        }
        expect(knob.label.length).toBeGreaterThan(0);
        expect(knob.key.length).toBeGreaterThan(0);
      }
    }
  });

  it('default params are within knob ranges', () => {
    for (const type of ALL_TYPES) {
      const defaults = DEFAULT_PARAMS[type] as unknown as Record<string, number>;
      for (const knob of EFFECT_KNOB_DEFS[type]!) {
        const val = defaults[knob.key];
        if (val !== undefined) {
          expect(val).toBeGreaterThanOrEqual(knob.min);
          expect(val).toBeLessThanOrEqual(knob.max);
        }
      }
    }
  });

  it('has at least one preset for most effect types', () => {
    // Not all types need presets, but the list should be non-empty overall
    expect(EFFECT_PRESETS.length).toBeGreaterThan(10);
  });

  it('presets reference valid effect types', () => {
    for (const preset of EFFECT_PRESETS) {
      expect(ALL_TYPES).toContain(preset.type);
    }
  });

  it('labels do not contain DKT prefix', () => {
    for (const type of ALL_TYPES) {
      expect(EFFECT_LABELS[type]).not.toContain('DKT');
    }
  });
});
