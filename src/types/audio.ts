export type TrackType = 'audio' | 'midi';
export type TransportState = 'playing' | 'recording' | 'paused' | 'stopped';

export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface SessionConfig {
  bpm: number;
  timeSignature: TimeSignature;
  sampleRate: number;
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;
  genre: import('@/types/ai').MixGenre;
}

export interface AudioClip {
  id: string;
  trackId: string;
  name: string;
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
  offset: number;
}

export interface MidiNote {
  pitch: number;
  velocity: number;
  startTime: number;
  duration: number;
}

export interface MidiClip {
  id: string;
  trackId: string;
  name: string;
  notes: MidiNote[];
  startTime: number;
  duration: number;
}

export type Clip = AudioClip | MidiClip;

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  armed: boolean;
  clips: Clip[];
}

export const TRACK_COLORS = [
  '#53c0f0', '#e94560', '#4ade80', '#facc15',
  '#a78bfa', '#fb923c', '#f472b6', '#2dd4bf',
  '#818cf8', '#f87171', '#34d399', '#fbbf24',
];

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  bpm: 120,
  timeSignature: { numerator: 4, denominator: 4 },
  sampleRate: 44100,
  loopStart: 0,
  loopEnd: 16,
  loopEnabled: false,
  genre: 'general',
};

export function isAudioClip(clip: Clip): clip is AudioClip {
  return 'buffer' in clip;
}

export function isMidiClip(clip: Clip): clip is MidiClip {
  return 'notes' in clip;
}
