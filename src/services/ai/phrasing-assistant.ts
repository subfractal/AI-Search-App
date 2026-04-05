/**
 * Phrasing Assistant — analyzes MIDI melodies and suggests
 * phrasing improvements: humanization, anticipation, dynamics.
 */

import type { MidiNote, MidiClip } from '@/types/audio';
import type { PhraseAnalysis } from '@/types/harmony';

/**
 * Detect phrase boundaries based on gaps between notes.
 */
export function analyzePhrasing(clip: MidiClip): PhraseAnalysis {
  if (clip.notes.length === 0) {
    return { phrases: [], overallDensity: 0, phraseLengthVariance: 0 };
  }

  const sorted = [...clip.notes].sort((a, b) => a.startTime - b.startTime);
  const gapThreshold = 0.3; // seconds — gaps larger than this start a new phrase

  const phrases: PhraseAnalysis['phrases'] = [];
  let phraseStart = sorted[0]!.startTime;
  let phraseNotes: MidiNote[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const gap = curr.startTime - (prev.startTime + prev.duration);

    if (gap > gapThreshold) {
      // End current phrase
      const endTime = prev.startTime + prev.duration;
      const avgVel = phraseNotes.reduce((s, n) => s + n.velocity, 0) / phraseNotes.length;
      const duration = endTime - phraseStart;
      phrases.push({
        startBeat: phraseStart,
        endBeat: endTime,
        noteCount: phraseNotes.length,
        avgVelocity: Math.round(avgVel),
        density: duration > 0 ? phraseNotes.length / duration : 0,
      });
      // Start new phrase
      phraseStart = curr.startTime;
      phraseNotes = [curr];
    } else {
      phraseNotes.push(curr);
    }
  }

  // Final phrase
  const lastNote = sorted[sorted.length - 1]!;
  const endTime = lastNote.startTime + lastNote.duration;
  const avgVel = phraseNotes.reduce((s, n) => s + n.velocity, 0) / phraseNotes.length;
  const duration = endTime - phraseStart;
  phrases.push({
    startBeat: phraseStart,
    endBeat: endTime,
    noteCount: phraseNotes.length,
    avgVelocity: Math.round(avgVel),
    density: duration > 0 ? phraseNotes.length / duration : 0,
  });

  // Overall metrics
  const totalDuration = clip.duration || 1;
  const overallDensity = clip.notes.length / totalDuration;

  const phraseLengths = phrases.map((p) => p.endBeat - p.startBeat);
  const avgLength = phraseLengths.reduce((s, l) => s + l, 0) / phraseLengths.length;
  const variance = phraseLengths.reduce((s, l) => s + (l - avgLength) ** 2, 0) / phraseLengths.length;

  return {
    phrases,
    overallDensity: Math.round(overallDensity * 100) / 100,
    phraseLengthVariance: Math.round(variance * 100) / 100,
  };
}

/**
 * Humanize MIDI timing and velocity with subtle random offsets.
 * Amount: 0 = no change, 1 = maximum humanization.
 */
export function humanizeTiming(
  notes: MidiNote[],
  amount: number,
  seed: number = 42,
): MidiNote[] {
  const maxTimingOffset = 0.03 * amount; // max 30ms at full amount
  const maxVelocityOffset = 15 * amount;  // max 15 velocity units

  // Simple deterministic pseudo-random
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xFFFFFFFF) * 2 - 1; // -1 to 1
  };

  return notes.map((note) => ({
    ...note,
    startTime: Math.max(0, note.startTime + rand() * maxTimingOffset),
    velocity: Math.max(1, Math.min(127, Math.round(note.velocity + rand() * maxVelocityOffset))),
  }));
}

/**
 * Add anticipation to notes near strong beats.
 * Shifts some notes slightly earlier for a "pushing" feel.
 */
export function addAnticipation(
  notes: MidiNote[],
  amount: number,
  beatDuration: number = 0.5,
): MidiNote[] {
  const anticipationTime = 0.05 * amount; // max 50ms early

  return notes.map((note) => {
    // Check if note is near a strong beat
    const beatPos = note.startTime / beatDuration;
    const distToStrong = Math.abs(Math.round(beatPos) - beatPos);

    if (distToStrong < 0.1) {
      // Near a strong beat — add anticipation
      return {
        ...note,
        startTime: Math.max(0, note.startTime - anticipationTime),
      };
    }
    return note;
  });
}

/**
 * Add velocity dynamics based on beat position.
 * Strong beats get higher velocity, weak beats get lower.
 */
export function addDynamics(
  notes: MidiNote[],
  amount: number,
  beatDuration: number = 0.5,
): MidiNote[] {
  const dynamicRange = 20 * amount;

  return notes.map((note) => {
    const beatPos = note.startTime / beatDuration;
    const isStrongBeat = Math.abs(Math.round(beatPos) - beatPos) < 0.1;
    const velAdj = isStrongBeat ? dynamicRange * 0.5 : -dynamicRange * 0.5;

    return {
      ...note,
      velocity: Math.max(1, Math.min(127, Math.round(note.velocity + velAdj))),
    };
  });
}
