/**
 * Preference Learning — tracks user patterns across sessions.
 * Privacy-first: all data stays in localStorage, user can inspect/reset/export.
 */

const STORAGE_KEY = 'dkst-user-preferences';

export interface UserPreferences {
  // Mix preferences
  targetLoudnessLufs: number | null;
  preferredHeadroom: number | null;
  avgTrackCount: number;

  // Frequency preferences
  lowEndBias: number; // -1 (cut) to 1 (boost)
  highEndBias: number;

  // Workflow patterns
  commonEffectChains: Record<string, string[]>; // role -> ["compressor", "eq", "reverb"]
  commonBpm: number[];
  commonKeys: string[];
  commonGenres: string[];

  // Arrangement patterns
  avgSongLengthBars: number;
  preferredSections: string[];

  // Export preferences
  lastExportFormat: string;
  lastSampleRate: number;

  // Suggestion acceptance rate
  suggestionsAccepted: number;
  suggestionsRejected: number;

  // Timestamps
  firstSeen: number;
  lastUpdated: number;
  sessionCount: number;
}

function defaultPreferences(): UserPreferences {
  return {
    targetLoudnessLufs: null,
    preferredHeadroom: null,
    avgTrackCount: 0,
    lowEndBias: 0,
    highEndBias: 0,
    commonEffectChains: {},
    commonBpm: [],
    commonKeys: [],
    commonGenres: [],
    avgSongLengthBars: 0,
    preferredSections: [],
    lastExportFormat: 'wav',
    lastSampleRate: 44100,
    suggestionsAccepted: 0,
    suggestionsRejected: 0,
    firstSeen: Date.now(),
    lastUpdated: Date.now(),
    sessionCount: 0,
  };
}

/**
 * Load preferences from localStorage.
 */
export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...defaultPreferences(), ...JSON.parse(raw) };
    }
  } catch {
    // Corrupted data — reset
  }
  return defaultPreferences();
}

/**
 * Save preferences to localStorage.
 */
export function savePreferences(prefs: UserPreferences): void {
  prefs.lastUpdated = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Record a session's characteristics into preferences.
 */
export function learnFromSession(
  trackCount: number,
  bpm: number,
  key: string,
  genre: string,
  loudnessLufs: number | null,
): void {
  const prefs = loadPreferences();

  prefs.sessionCount++;
  prefs.avgTrackCount = Math.round(
    (prefs.avgTrackCount * (prefs.sessionCount - 1) + trackCount) / prefs.sessionCount
  );

  if (loudnessLufs !== null) {
    prefs.targetLoudnessLufs = prefs.targetLoudnessLufs !== null
      ? (prefs.targetLoudnessLufs + loudnessLufs) / 2
      : loudnessLufs;
  }

  // Track common BPMs (keep last 20)
  prefs.commonBpm = [...prefs.commonBpm, bpm].slice(-20);

  // Track common keys
  if (key && !prefs.commonKeys.includes(key)) {
    prefs.commonKeys = [...prefs.commonKeys, key].slice(-10);
  }

  // Track genres
  if (genre && !prefs.commonGenres.includes(genre)) {
    prefs.commonGenres = [...prefs.commonGenres, genre].slice(-10);
  }

  savePreferences(prefs);
}

/**
 * Record an effect chain pattern.
 */
export function learnEffectChain(role: string, effectTypes: string[]): void {
  const prefs = loadPreferences();
  prefs.commonEffectChains[role] = effectTypes;
  savePreferences(prefs);
}

/**
 * Record suggestion acceptance/rejection.
 */
export function recordSuggestionFeedback(accepted: boolean): void {
  const prefs = loadPreferences();
  if (accepted) {
    prefs.suggestionsAccepted++;
  } else {
    prefs.suggestionsRejected++;
  }
  savePreferences(prefs);
}

/**
 * Get the acceptance rate (0-1).
 */
export function getAcceptanceRate(): number {
  const prefs = loadPreferences();
  const total = prefs.suggestionsAccepted + prefs.suggestionsRejected;
  return total > 0 ? prefs.suggestionsAccepted / total : 0.5;
}

/**
 * Export preferences as JSON string.
 */
export function exportPreferences(): string {
  return JSON.stringify(loadPreferences(), null, 2);
}

/**
 * Reset all preferences.
 */
export function resetPreferences(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get the most common BPM from history.
 */
export function getPreferredBpm(): number | null {
  const prefs = loadPreferences();
  if (prefs.commonBpm.length === 0) return null;
  // Mode (most frequent)
  const freq = new Map<number, number>();
  for (const b of prefs.commonBpm) {
    freq.set(b, (freq.get(b) ?? 0) + 1);
  }
  let best = prefs.commonBpm[0]!;
  let bestCount = 0;
  for (const [bpm, count] of freq) {
    if (count > bestCount) { best = bpm; bestCount = count; }
  }
  return best;
}
