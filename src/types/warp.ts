export interface WarpMarker {
  id: string;
  sourceTime: number;    // position in original audio (seconds)
  targetTime: number;    // position in warped timeline (seconds)
}

export type WarpMode = 'beats' | 'tones' | 'texture' | 'repitch' | 'off';

// Stretching state: steady (constant BPM) vs fluid (live/fluctuating tempo)
export type StretchState = 'steady' | 'fluid';

export interface WarpConfig {
  enabled: boolean;
  mode: WarpMode;
  stretchState: StretchState;
  originalBpm: number;
  originalBpmConfidence: number;
  anchorTime: number;          // "Origin Strike" — first downbeat in source audio (seconds)
  barCount: number;            // how many bars the clip spans
  markers: WarpMarker[];
  autoWarped: boolean;
}

export const DEFAULT_WARP_CONFIG: WarpConfig = {
  enabled: false,
  mode: 'beats',
  stretchState: 'steady',
  originalBpm: 120,
  originalBpmConfidence: 0,
  anchorTime: 0,
  barCount: 4,
  markers: [],
  autoWarped: false,
};

export const WARP_MODES: { value: WarpMode; label: string; description: string; engine: string }[] = [
  {
    value: 'beats',
    label: 'Beats',
    description: 'Transient preservation — keeps hits intact, stretches decay between them',
    engine: 'Transient Preservation',
  },
  {
    value: 'tones',
    label: 'Tones',
    description: 'Granular synthesis — breaks audio into grains, repeats or skips for pitch-independent stretch',
    engine: 'Granular Synthesis',
  },
  {
    value: 'texture',
    label: 'Texture',
    description: 'Spectral analysis — shifts frequency content without losing harmonic weight',
    engine: 'Spectral Analysis',
  },
  {
    value: 'repitch',
    label: 'Re-Pitch',
    description: 'Analog varispeed — pitch and speed coupled like a tape machine',
    engine: 'Analog Varispeed',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'No time-stretching applied',
    engine: 'Bypass',
  },
];
