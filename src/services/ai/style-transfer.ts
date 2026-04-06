/**
 * Style Transfer / Reharmonization — transforms MIDI clips into
 * different harmonic styles using rule-based chord substitutions.
 */

import type { MidiClip, MidiNote } from '@/types/audio';
import type { ReharmonizationStyle, StyleProfile } from '@/types/harmony';
import { detectChordFromNotes } from './harmonic-analyzer';

const STYLE_PROFILES: Record<ReharmonizationStyle, StyleProfile> = {
  'neo-soul': {
    name: 'Neo-Soul',
    chordExtensions: [9, 11, 13],
    voicingSpread: 12,
    rhythmQuantize: 0.5,
    velocityCurve: 'dynamic',
    swingAmount: 0.15,
    substitutions: {
      major: ['maj9', 'maj7#11'],
      minor: ['min9', 'min11'],
      '7': ['9', '13'],
    },
  },
  jazz: {
    name: 'Jazz',
    chordExtensions: [7, 9, 11, 13],
    voicingSpread: 14,
    rhythmQuantize: 0.25,
    velocityCurve: 'dynamic',
    swingAmount: 0.2,
    substitutions: {
      major: ['maj7', 'maj9', '6/9'],
      minor: ['min7', 'min9', 'min11'],
      '7': ['9', '13', 'alt'],
    },
  },
  'lo-fi': {
    name: 'Lo-Fi',
    chordExtensions: [7, 9],
    voicingSpread: 8,
    rhythmQuantize: 0.5,
    velocityCurve: 'soft',
    swingAmount: 0.1,
    substitutions: {
      major: ['maj7'],
      minor: ['min7', 'min9'],
      '7': ['9'],
    },
  },
  classical: {
    name: 'Classical',
    chordExtensions: [],
    voicingSpread: 16,
    rhythmQuantize: 1.0,
    velocityCurve: 'dynamic',
    swingAmount: 0,
    substitutions: {
      major: ['major'],
      minor: ['minor'],
      '7': ['7'],
    },
  },
  edm: {
    name: 'EDM',
    chordExtensions: [7],
    voicingSpread: 24,
    rhythmQuantize: 0.25,
    velocityCurve: 'flat',
    swingAmount: 0,
    substitutions: {
      major: ['major', 'sus4'],
      minor: ['minor', 'sus2'],
      '7': ['major'],
    },
  },
  blues: {
    name: 'Blues',
    chordExtensions: [7, 9],
    voicingSpread: 10,
    rhythmQuantize: 0.5,
    velocityCurve: 'dynamic',
    swingAmount: 0.25,
    substitutions: {
      major: ['7', '9'],
      minor: ['min7', '7'],
      '7': ['9', '13'],
    },
  },
  gospel: {
    name: 'Gospel',
    chordExtensions: [7, 9, 11],
    voicingSpread: 14,
    rhythmQuantize: 0.5,
    velocityCurve: 'dynamic',
    swingAmount: 0.1,
    substitutions: {
      major: ['maj7', 'maj9', 'add9'],
      minor: ['min7', 'min9', 'min11'],
      '7': ['9', '11', '13'],
    },
  },
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Add extension notes to a chord voicing based on style profile.
 */
function addExtensions(
  rootPitch: number,
  _quality: string,
  profile: StyleProfile,
  seed: number,
): number[] {
  const extensions: number[] = [];
  for (const ext of profile.chordExtensions) {
    // Use seed for deterministic but varied extension selection
    if ((seed + ext) % 3 !== 0) continue;
    extensions.push(rootPitch + ext);
  }
  return extensions;
}

/**
 * Apply velocity curve to notes.
 */
function applyVelocityCurve(
  velocity: number,
  curve: 'flat' | 'dynamic' | 'soft',
): number {
  switch (curve) {
    case 'flat':
      return 80;
    case 'soft':
      return Math.min(velocity, 70);
    case 'dynamic':
      return velocity;
  }
}

/**
 * Apply swing to note timing.
 */
function applySwing(startTime: number, swingAmount: number, beatDuration: number): number {
  if (swingAmount === 0) return startTime;
  const beatPos = startTime / beatDuration;
  const isOffBeat = Math.round(beatPos * 2) % 2 === 1;
  if (isOffBeat) {
    return startTime + swingAmount * beatDuration * 0.5;
  }
  return startTime;
}

/**
 * Reharmonize a MIDI clip in a target style.
 * Applies chord substitutions, extensions, velocity curves, and swing.
 */
export function reharmonize(
  clip: MidiClip,
  style: ReharmonizationStyle,
): MidiClip {
  const profile = STYLE_PROFILES[style];
  if (!profile) return clip;

  const beatDuration = 0.5; // approximate beat duration in seconds
  const newNotes: MidiNote[] = [];

  // Group notes by approximate start time (chord windows)
  const windows = new Map<number, MidiNote[]>();
  for (const note of clip.notes) {
    const windowKey = Math.round(note.startTime / beatDuration) * beatDuration;
    const group = windows.get(windowKey) ?? [];
    group.push(note);
    windows.set(windowKey, group);
  }

  let chordIdx = 0;
  for (const [windowTime, notes] of windows) {
    // Detect current chord
    const pitches = notes.map((n) => n.pitch);
    const chord = detectChordFromNotes(pitches);

    if (chord && notes.length >= 3) {
      // Apply style-specific reharmonization
      const rootIdx = NOTE_NAMES.indexOf(chord.root);
      if (rootIdx >= 0) {
        const rootPitch = notes.reduce((min, n) => Math.min(min, n.pitch), 127);

        // Add extension notes
        const extensions = addExtensions(rootPitch, chord.quality, profile, chordIdx);
        for (const extPitch of extensions) {
          if (extPitch > 20 && extPitch < 108) {
            newNotes.push({
              pitch: extPitch,
              velocity: applyVelocityCurve(60, profile.velocityCurve),
              startTime: applySwing(windowTime, profile.swingAmount, beatDuration),
              duration: notes[0]!.duration,
            });
          }
        }
      }
    }

    // Keep original notes with velocity and swing adjustments
    for (const note of notes) {
      newNotes.push({
        pitch: note.pitch,
        velocity: applyVelocityCurve(note.velocity, profile.velocityCurve),
        startTime: applySwing(note.startTime, profile.swingAmount, beatDuration),
        duration: note.duration,
      });
    }

    chordIdx++;
  }

  return {
    ...clip,
    notes: newNotes,
  };
}

/**
 * Get available reharmonization styles.
 */
export function getAvailableStyles(): Array<{ id: ReharmonizationStyle; name: string }> {
  return Object.entries(STYLE_PROFILES).map(([id, profile]) => ({
    id: id as ReharmonizationStyle,
    name: profile.name,
  }));
}
