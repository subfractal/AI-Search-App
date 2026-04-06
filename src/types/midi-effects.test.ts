import { describe, it, expect } from 'vitest';
import {
  MIDI_EFFECT_LABELS,
  MIDI_EFFECT_DEFAULTS,
  SCALE_INTERVALS,
} from './midi-effects';
import type { MidiEffectType } from './midi-effects';

const ALL_MIDI_TYPES: MidiEffectType[] = [
  'arpeggiator', 'chord', 'scale', 'transposer',
  'velocity', 'noteRepeat', 'humanize', 'midiDelay',
];

describe('MIDI Effects Type Definitions', () => {
  it('has labels for all MIDI effect types', () => {
    for (const type of ALL_MIDI_TYPES) {
      expect(MIDI_EFFECT_LABELS[type]).toBeDefined();
      expect(MIDI_EFFECT_LABELS[type]!.length).toBeGreaterThan(0);
    }
  });

  it('has defaults for all MIDI effect types', () => {
    for (const type of ALL_MIDI_TYPES) {
      expect(MIDI_EFFECT_DEFAULTS[type]).toBeDefined();
      expect(typeof MIDI_EFFECT_DEFAULTS[type]).toBe('object');
    }
  });

  it('scale intervals have valid semitone values', () => {
    for (const [name, intervals] of Object.entries(SCALE_INTERVALS)) {
      expect(intervals.length).toBeGreaterThan(0);
      for (const interval of intervals) {
        expect(interval).toBeGreaterThanOrEqual(0);
        expect(interval).toBeLessThanOrEqual(11);
        expect(Number.isInteger(interval)).toBe(true);
      }
      // All scales should include root (0)
      expect(intervals).toContain(0);
      // Should be sorted ascending
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]!);
      }
      // No name should be empty
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('chromatic scale has all 12 semitones', () => {
    expect(SCALE_INTERVALS.chromatic.length).toBe(12);
  });

  it('major scale has 7 notes', () => {
    expect(SCALE_INTERVALS.major.length).toBe(7);
    expect(SCALE_INTERVALS.major).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('arpeggiator defaults are valid', () => {
    const defaults = MIDI_EFFECT_DEFAULTS.arpeggiator as { rate: number; octaves: number; mode: string };
    expect(defaults.rate).toBeGreaterThan(0);
    expect(defaults.octaves).toBeGreaterThanOrEqual(1);
    expect(['up', 'down', 'upDown', 'random']).toContain(defaults.mode);
  });
});
