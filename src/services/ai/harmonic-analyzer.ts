/**
 * Harmonic Analyzer — session-aware harmonic topography analysis.
 * Analyzes all MIDI clips to build chord progression, tension curve,
 * and suggest next chords.
 */

import type { Track } from '@/types/audio';
import { isMidiClip } from '@/types/audio';
import type { MidiNote } from '@/types/audio';
import type { DetectedChord, HarmonicTopography } from '@/types/harmony';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord templates: intervals from root (in semitones)
const CHORD_TEMPLATES: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

// Consonance scores for intervals (0-1, higher = more consonant)
const INTERVAL_CONSONANCE: Record<number, number> = {
  0: 1.0,   // unison
  1: 0.1,   // minor 2nd
  2: 0.3,   // major 2nd
  3: 0.6,   // minor 3rd
  4: 0.7,   // major 3rd
  5: 0.8,   // perfect 4th
  6: 0.2,   // tritone
  7: 0.9,   // perfect 5th
  8: 0.6,   // minor 6th
  9: 0.5,   // major 6th
  10: 0.3,  // minor 7th
  11: 0.4,  // major 7th
};

// Common chord progressions (used for contextual suggestions)
// Currently referenced by suggestNextChords heuristic

/**
 * Detect chord from a set of simultaneous MIDI notes.
 */
export function detectChordFromNotes(notes: number[]): DetectedChord | null {
  if (notes.length < 2) return null;

  // Get pitch classes (0-11)
  const pitchClasses = [...new Set(notes.map((n) => n % 12))].sort((a, b) => a - b);

  let bestMatch: { root: string; quality: string; score: number } | null = null;

  // Try each pitch class as root
  for (let root = 0; root < 12; root++) {
    // Compute intervals relative to this root
    const intervals = pitchClasses.map((pc) => (pc - root + 12) % 12);

    for (const [quality, template] of Object.entries(CHORD_TEMPLATES)) {
      // Count matching intervals
      let matches = 0;
      for (const interval of template) {
        if (intervals.includes(interval)) matches++;
      }
      const score = matches / template.length;

      if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { root: NOTE_NAMES[root]!, quality, score };
      }
    }
  }

  if (!bestMatch) return null;

  return {
    root: bestMatch.root,
    quality: bestMatch.quality as DetectedChord['quality'],
    startBeat: 0,
    endBeat: 0,
    notes,
  };
}

/**
 * Detect chord progression from MIDI notes over time.
 */
function detectChordProgression(
  allNotes: MidiNote[],
  bpm: number,
  beatsPerChord: number = 4,
): DetectedChord[] {
  if (allNotes.length === 0) return [];

  const beatDuration = 60 / bpm;
  const maxTime = Math.max(...allNotes.map((n) => n.startTime + n.duration));
  const totalBeats = Math.ceil(maxTime / beatDuration);
  const chords: DetectedChord[] = [];

  for (let beat = 0; beat < totalBeats; beat += beatsPerChord) {
    const startTime = beat * beatDuration;
    const endTime = (beat + beatsPerChord) * beatDuration;

    // Collect notes active during this time window
    const activeNotes = allNotes
      .filter((n) => n.startTime < endTime && n.startTime + n.duration > startTime)
      .map((n) => n.pitch);

    if (activeNotes.length < 2) continue;

    const chord = detectChordFromNotes(activeNotes);
    if (chord) {
      chord.startBeat = beat;
      chord.endBeat = beat + beatsPerChord;
      chords.push(chord);
    }
  }

  return chords;
}

/**
 * Compute tension curve from chord progression.
 * Returns array of tension values (0-1) per chord position.
 */
function computeTensionCurve(chords: DetectedChord[]): number[] {
  return chords.map((chord) => {
    if (chord.notes.length < 2) return 0;

    // Compute average consonance of all intervals in the chord
    let totalConsonance = 0;
    let pairs = 0;
    const pcs = chord.notes.map((n) => n % 12);

    for (let i = 0; i < pcs.length; i++) {
      for (let j = i + 1; j < pcs.length; j++) {
        const interval = Math.abs(pcs[i]! - pcs[j]!) % 12;
        const minInterval = Math.min(interval, 12 - interval);
        totalConsonance += INTERVAL_CONSONANCE[minInterval] ?? 0.5;
        pairs++;
      }
    }

    const avgConsonance = pairs > 0 ? totalConsonance / pairs : 0.5;
    // Tension is inverse of consonance
    return Math.round((1 - avgConsonance) * 100) / 100;
  });
}

/**
 * Suggest next chords based on the current progression and key.
 */
function suggestNextChords(
  chords: DetectedChord[],
  _scale: 'major' | 'minor',
): string[] {
  if (chords.length === 0) return ['C major', 'F major', 'G major'];

  const lastChord = chords[chords.length - 1]!;
  const suggestions: string[] = [];

  // Based on common progressions
  // Simple heuristic: suggest resolution chords
  if (lastChord.quality === '7' || lastChord.quality === 'dim') {
    suggestions.push(`${lastChord.root} major`); // resolve to tonic
  }

  // Add common next chords
  const rootIdx = NOTE_NAMES.indexOf(lastChord.root);
  if (rootIdx >= 0) {
    // IV
    suggestions.push(`${NOTE_NAMES[(rootIdx + 5) % 12]} major`);
    // V
    suggestions.push(`${NOTE_NAMES[(rootIdx + 7) % 12]} major`);
    // vi (relative minor)
    suggestions.push(`${NOTE_NAMES[(rootIdx + 9) % 12]} minor`);
  }

  return [...new Set(suggestions)].slice(0, 4);
}

/**
 * Analyze harmonic topography of the entire session.
 * Aggregates all MIDI notes across all tracks.
 */
export function analyzeHarmonicTopography(
  tracks: Track[],
  bpm: number,
): HarmonicTopography {
  // Collect all MIDI notes from all tracks
  const allNotes: MidiNote[] = [];

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (isMidiClip(clip)) {
        allNotes.push(...clip.notes);
      }
    }
  }

  if (allNotes.length === 0) {
    return {
      key: 'C',
      scale: 'major',
      chordProgression: [],
      tensionCurve: [],
      scaleConsistency: 0,
      suggestedNextChords: ['C major', 'F major', 'G major', 'A minor'],
    };
  }

  // Detect chord progression
  const chords = detectChordProgression(allNotes, bpm);

  // Compute tension curve
  const tensionCurve = computeTensionCurve(chords);

  // Determine key from pitch class histogram
  const pitchHist = new Array(12).fill(0);
  for (const note of allNotes) {
    pitchHist[note.pitch % 12] += note.duration;
  }
  const maxPC = pitchHist.indexOf(Math.max(...pitchHist));
  const key = NOTE_NAMES[maxPC] ?? 'C';

  // Estimate major vs minor based on 3rd interval usage
  const minorThird = pitchHist[(maxPC + 3) % 12] ?? 0;
  const majorThird = pitchHist[(maxPC + 4) % 12] ?? 0;
  const scale: 'major' | 'minor' = minorThird > majorThird ? 'minor' : 'major';

  // Scale consistency: how many notes fall within the scale
  const scaleIntervals = scale === 'major'
    ? [0, 2, 4, 5, 7, 9, 11]
    : [0, 2, 3, 5, 7, 8, 10];
  let inScale = 0;
  let totalWeight = 0;
  for (let i = 0; i < 12; i++) {
    const interval = (i - maxPC + 12) % 12;
    totalWeight += pitchHist[i]!;
    if (scaleIntervals.includes(interval)) {
      inScale += pitchHist[i]!;
    }
  }
  const scaleConsistency = totalWeight > 0 ? inScale / totalWeight : 0;

  return {
    key,
    scale,
    chordProgression: chords,
    tensionCurve,
    scaleConsistency: Math.round(scaleConsistency * 100) / 100,
    suggestedNextChords: suggestNextChords(chords, scale),
  };
}
