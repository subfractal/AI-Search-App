import { describe, it, expect } from 'vitest';
import {
  applyArpeggiator,
  applyChord,
  applyScale,
  applyTransposer,
  applyVelocityProcessor,
  applyNoteRepeat,
  applyHumanize,
  applyMidiDelay,
} from './midi-effects-service';
import type { MidiNote } from '@/types/audio';
import {
  DEFAULT_ARP_PARAMS,
  DEFAULT_CHORD_PARAMS,
  DEFAULT_SCALE_PARAMS,
  DEFAULT_TRANSPOSER_PARAMS,
  DEFAULT_VELOCITY_PARAMS,
  DEFAULT_NOTE_REPEAT_PARAMS,
  DEFAULT_HUMANIZE_PARAMS,
  DEFAULT_MIDI_DELAY_PARAMS,
} from '@/types/midi-effects';

const makeNote = (pitch = 60, velocity = 100, startTime = 0, duration = 0.5): MidiNote => ({
  pitch,
  velocity,
  startTime,
  duration,
});

describe('MIDI Effects Service', () => {
  describe('applyArpeggiator', () => {
    it('returns notes for empty input', () => {
      expect(applyArpeggiator([], DEFAULT_ARP_PARAMS)).toEqual([]);
    });

    it('generates arpeggiated notes in up mode', () => {
      const notes = [makeNote(60), makeNote(64), makeNote(67)];
      const result = applyArpeggiator(notes, { ...DEFAULT_ARP_PARAMS, mode: 'up' });
      expect(result.length).toBeGreaterThan(0);
      // Notes should be sorted by start time
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.startTime).toBeGreaterThanOrEqual(result[i - 1]!.startTime);
      }
    });

    it('handles single note', () => {
      const notes = [makeNote(60)];
      const result = applyArpeggiator(notes, DEFAULT_ARP_PARAMS);
      expect(result.length).toBeGreaterThan(0);
    });

    it('respects octave range', () => {
      const notes = [makeNote(60)];
      const result = applyArpeggiator(notes, { ...DEFAULT_ARP_PARAMS, octaves: 2 });
      const pitches = result.map((n) => n.pitch);
      expect(Math.max(...pitches)).toBeLessThanOrEqual(127);
    });
  });

  describe('applyChord', () => {
    it('returns empty for empty input', () => {
      expect(applyChord([], DEFAULT_CHORD_PARAMS)).toEqual([]);
    });

    it('adds chord intervals', () => {
      const notes = [makeNote(60)];
      const result = applyChord(notes, { ...DEFAULT_CHORD_PARAMS, intervals: [0, 4, 7] });
      expect(result.length).toBe(3); // root + major third + fifth
    });

    it('clamps pitch to 0-127', () => {
      const notes = [makeNote(125)];
      const result = applyChord(notes, { ...DEFAULT_CHORD_PARAMS, intervals: [0, 4, 7] });
      for (const note of result) {
        expect(note.pitch).toBeGreaterThanOrEqual(0);
        expect(note.pitch).toBeLessThanOrEqual(127);
      }
    });
  });

  describe('applyScale', () => {
    it('returns empty for empty input', () => {
      expect(applyScale([], DEFAULT_SCALE_PARAMS)).toEqual([]);
    });

    it('quantizes notes to scale', () => {
      const notes = [makeNote(61)]; // C#, not in C major
      const result = applyScale(notes, { ...DEFAULT_SCALE_PARAMS, scale: 'major', root: 0 });
      expect(result.length).toBe(1);
      // Should snap to nearest scale degree (C=60 or D=62)
      expect([60, 62]).toContain(result[0]!.pitch);
    });

    it('handles chromatic scale (no change)', () => {
      const notes = [makeNote(61)];
      const result = applyScale(notes, { ...DEFAULT_SCALE_PARAMS, scale: 'chromatic' });
      expect(result[0]!.pitch).toBe(61);
    });
  });

  describe('applyTransposer', () => {
    it('transposes notes by semitones', () => {
      const notes = [makeNote(60)];
      const result = applyTransposer(notes, { ...DEFAULT_TRANSPOSER_PARAMS, semitones: 5 });
      expect(result[0]!.pitch).toBe(65);
    });

    it('clamps pitch to valid MIDI range', () => {
      const notes = [makeNote(125)];
      const result = applyTransposer(notes, { ...DEFAULT_TRANSPOSER_PARAMS, semitones: 10 });
      expect(result[0]!.pitch).toBeLessThanOrEqual(127);
    });

    it('handles negative transposition', () => {
      const notes = [makeNote(5)];
      const result = applyTransposer(notes, { ...DEFAULT_TRANSPOSER_PARAMS, semitones: -10 });
      expect(result[0]!.pitch).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyVelocityProcessor', () => {
    it('scales velocity to range', () => {
      const notes = [makeNote(60, 64)];
      const result = applyVelocityProcessor(notes, {
        ...DEFAULT_VELOCITY_PARAMS,
        min: 50,
        max: 100,
        curve: 1,
        randomize: 0,
      });
      expect(result[0]!.velocity).toBeGreaterThanOrEqual(50);
      expect(result[0]!.velocity).toBeLessThanOrEqual(100);
    });

    it('handles zero velocity', () => {
      const notes = [makeNote(60, 0)];
      const result = applyVelocityProcessor(notes, DEFAULT_VELOCITY_PARAMS);
      expect(result[0]!.velocity).toBeGreaterThanOrEqual(0);
      expect(result[0]!.velocity).toBeLessThanOrEqual(127);
    });
  });

  describe('applyNoteRepeat', () => {
    it('returns empty for empty input', () => {
      expect(applyNoteRepeat([], DEFAULT_NOTE_REPEAT_PARAMS)).toEqual([]);
    });

    it('creates repeated notes', () => {
      const notes = [makeNote(60, 100, 0, 1)];
      const result = applyNoteRepeat(notes, { ...DEFAULT_NOTE_REPEAT_PARAMS, divisions: 4, decay: 0.9 });
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('applyHumanize', () => {
    it('returns same number of notes', () => {
      const notes = [makeNote(60), makeNote(64)];
      const result = applyHumanize(notes, DEFAULT_HUMANIZE_PARAMS);
      expect(result.length).toBe(2);
    });

    it('preserves pitch', () => {
      const notes = [makeNote(60)];
      const result = applyHumanize(notes, { ...DEFAULT_HUMANIZE_PARAMS, timingAmount: 0, velocityAmount: 0 });
      expect(result[0]!.pitch).toBe(60);
    });
  });

  describe('applyMidiDelay', () => {
    it('returns empty for empty input', () => {
      expect(applyMidiDelay([], DEFAULT_MIDI_DELAY_PARAMS)).toEqual([]);
    });

    it('creates delayed copies', () => {
      const notes = [makeNote(60)];
      const result = applyMidiDelay(notes, { ...DEFAULT_MIDI_DELAY_PARAMS, feedback: 0.5, time: 0.25 });
      expect(result.length).toBeGreaterThan(1);
    });

    it('handles feedback at maximum (edge case)', () => {
      const notes = [makeNote(60)];
      // feedback = 1 was previously a division by zero bug
      const result = applyMidiDelay(notes, { ...DEFAULT_MIDI_DELAY_PARAMS, feedback: 1.0, time: 0.25, transpose: 0 });
      expect(result.length).toBeGreaterThan(1);
      expect(result.length).toBeLessThanOrEqual(9); // original + max 8 repeats
    });

    it('handles zero feedback', () => {
      const notes = [makeNote(60)];
      const result = applyMidiDelay(notes, { ...DEFAULT_MIDI_DELAY_PARAMS, feedback: 0, time: 0.25, transpose: 0 });
      // With feedback 0, repeats have velocity * 0^i = 0, so only original note
      expect(result.length).toBe(1);
    });
  });
});
