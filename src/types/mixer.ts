export interface EffectInsert {
  id: string;
  type: string;
  params: Record<string, number>;
  enabled: boolean;
  order: number;
}

export interface Send {
  id: string;
  busId: string;
  amount: number;
}

export interface ChannelStrip {
  trackId: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  inserts: EffectInsert[];
  sends: Send[];
}
