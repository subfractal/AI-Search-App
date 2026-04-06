import type { Clip } from '@/types/audio';
import type { MixGenre } from '@/types/ai';
import type { InstrumentConfig } from '@/types/instruments';
import type { EffectConfig } from '@/types/effects';

// --- Track role expansion ---
export type TrackRole = 'audio' | 'midi' | 'group' | 'folder' | 'return' | 'master';
export type SequencerMode = 'arrangement' | 'launcher';

// --- Project metadata ---
export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  bpm: number;
  genre: MixGenre;
  templateId?: string;
}

// --- Launcher / session clip model ---
export interface LauncherSlot {
  sceneIndex: number;
  clip: Clip | null;
  playing: boolean;
  queued: boolean;
}

export interface TrackSequencerState {
  activeSequencer: SequencerMode;
  arrangementSuppressedByLauncher: boolean;
  launcherSlots: LauncherSlot[];
}

// --- Folder / Group / Stack track configs ---
export interface FolderTrackConfig {
  collapsed: boolean;
  childTrackIds: string[];
  summingEnabled: boolean;
}

export interface GroupTrackConfig {
  childTrackIds: string[];
  busId: string;
}

// --- Saved project assets ---
export interface SavedClipAsset {
  id: string;
  name: string;
  clip: Clip;
  tags: string[];
  createdByAI: boolean;
  sourceTrackId?: string;
  genre?: string;
  tempoHint?: number;
  keyHint?: string;
  lengthBars?: number;
  createdAt: number;
}

export interface SavedTrackPreset {
  id: string;
  name: string;
  trackType: TrackRole;
  instrumentConfig?: InstrumentConfig;
  effectConfigs?: EffectConfig[];
  mixerDefaults?: { volume: number; pan: number };
  tags: string[];
  createdAt: number;
}
