import { create } from 'zustand';
import { detectKeyAsync } from '@/services/ai/key-detector';
import type { KeyResult } from '@/services/ai/key-detector';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const DISPLAY_NAMES: Record<string, string> = {
  'C': 'C', 'C#': 'Db', 'D': 'D', 'D#': 'Eb', 'E': 'E', 'F': 'F',
  'F#': 'F#', 'G': 'G', 'G#': 'Ab', 'A': 'A', 'A#': 'Bb', 'B': 'B',
};

const CAMELOT_MAJOR: Record<string, string> = {
  'C': '8B', 'C#': '3B', 'D': '10B', 'D#': '5B', 'E': '12B', 'F': '7B',
  'F#': '2B', 'G': '9B', 'G#': '4B', 'A': '11B', 'A#': '6B', 'B': '1B',
};

const CAMELOT_MINOR: Record<string, string> = {
  'C': '5A', 'C#': '12A', 'D': '7A', 'D#': '2A', 'E': '9A', 'F': '4A',
  'F#': '11A', 'G': '6A', 'G#': '1A', 'A': '8A', 'A#': '3A', 'B': '10A',
};

interface KeyStore {
  keys: Record<string, KeyResult>;
  detecting: Record<string, boolean>;

  detectKey: (clipId: string, buffer: AudioBuffer) => void;
  setKey: (clipId: string, key: string, scale: 'major' | 'minor') => void;
  removeKey: (clipId: string) => void;
}

function findInternalNote(displayKey: string): string | undefined {
  for (const [internal, display] of Object.entries(DISPLAY_NAMES)) {
    if (display === displayKey) return internal;
  }
  return undefined;
}

export const useKeyStore = create<KeyStore>((set, get) => ({
  keys: {},
  detecting: {},

  detectKey: (clipId, buffer) => {
    if (get().detecting[clipId]) return;

    set((state) => ({
      detecting: { ...state.detecting, [clipId]: true },
    }));

    // Run detection asynchronously with chunked yields to avoid blocking the UI
    detectKeyAsync(buffer).then((result) => {
      set((state) => ({
        keys: { ...state.keys, [clipId]: result },
        detecting: { ...state.detecting, [clipId]: false },
      }));
    }).catch(() => {
      set((state) => ({
        detecting: { ...state.detecting, [clipId]: false },
      }));
    });
  },

  setKey: (clipId, key, scale) => {
    const internalKey = findInternalNote(key) ?? key;
    const noteIndex = NOTE_NAMES.indexOf(internalKey as typeof NOTE_NAMES[number]);
    if (noteIndex === -1) return;

    const displayKey = DISPLAY_NAMES[internalKey] ?? internalKey;
    const scaleName = scale === 'major' ? 'Major' : 'Minor';
    const camelotMap = scale === 'major' ? CAMELOT_MAJOR : CAMELOT_MINOR;
    const camelotCode = camelotMap[internalKey] ?? '';

    const result: KeyResult = {
      key: displayKey,
      scale,
      confidence: 1,
      fullName: `${displayKey} ${scaleName}`,
      camelotCode,
      allKeys: [],
    };

    set((state) => ({
      keys: { ...state.keys, [clipId]: result },
    }));
  },

  removeKey: (clipId) => {
    set((state) => {
      const keys = { ...state.keys };
      const detecting = { ...state.detecting };
      delete keys[clipId];
      delete detecting[clipId];
      return { keys, detecting };
    });
  },
}));
