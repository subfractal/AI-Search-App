export interface WarpMarker {
  id: string;
  sourceTime: number;    // position in original audio (seconds)
  targetTime: number;    // position in warped timeline (seconds)
}

export type WarpMode = 'beats' | 'tones' | 'texture' | 'repitch' | 'off';

export interface WarpConfig {
  enabled: boolean;
  mode: WarpMode;
  originalBpm: number;
  originalBpmConfidence: number;
  markers: WarpMarker[];
  autoWarped: boolean;
}

export const DEFAULT_WARP_CONFIG: WarpConfig = {
  enabled: false,
  mode: 'beats',
  originalBpm: 120,
  originalBpmConfidence: 0,
  markers: [],
  autoWarped: false,
};

export const WARP_MODES: { value: WarpMode; label: string; description: string }[] = [
  { value: 'beats', label: 'Beats', description: 'Best for rhythmic material' },
  { value: 'tones', label: 'Tones', description: 'Best for melodic content' },
  { value: 'texture', label: 'Texture', description: 'Best for ambient/textural sounds' },
  { value: 'repitch', label: 'Re-Pitch', description: 'Classic tape-speed pitch shifting' },
  { value: 'off', label: 'Off', description: 'No time-stretching' },
];
