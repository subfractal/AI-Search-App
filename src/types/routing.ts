export type BusType = 'return' | 'group' | 'master';

export interface Bus {
  id: string;
  name: string;
  type: BusType;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  color: string;
}

export interface SendConfig {
  id: string;
  sourceTrackId: string;
  busId: string;
  amount: number;    // 0-1, send level
  preFader: boolean; // pre-fader or post-fader send
  enabled: boolean;
}

export interface SidechainConfig {
  id: string;
  targetTrackId: string;    // track being compressed
  sourceTrackId: string;    // track triggering the compression (e.g., kick)
  threshold: number;        // -60 to 0 dB
  ratio: number;            // 1 to 20
  attack: number;           // 0 to 1 seconds
  release: number;          // 0 to 1 seconds
  amount: number;           // 0-1 mix
  enabled: boolean;
}

export interface GroupAssignment {
  trackId: string;
  groupBusId: string;
}

export const DEFAULT_BUS: Omit<Bus, 'id' | 'name' | 'type'> = {
  volume: 0,
  pan: 0,
  mute: false,
  solo: false,
  color: '#888888',
};

export const BUS_COLORS = [
  '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3',
  '#54a0ff', '#5f27cd', '#01a3a4', '#10ac84',
];
