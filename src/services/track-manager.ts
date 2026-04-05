import * as Tone from 'tone';
import { createChannel, createPlayer, disposeNode } from './audio-engine';
import { reconnectTrackEffects } from './effects-service';
import { createWarpedBuffer } from './warp-service';
import { useWarpStore } from '@/stores/warp-store';
import { useTransportStore } from '@/stores/transport-store';
import type { AudioClip } from '@/types/audio';

interface TrackAudioNode {
  channel: Tone.Channel;
  players: Map<string, Tone.Player>;
  meter: Tone.Meter;
}

const trackNodes = new Map<string, TrackAudioNode>();

export function createTrackNodes(trackId: string): TrackAudioNode {
  const channel = createChannel();
  const meter = new Tone.Meter({ smoothing: 0.8 });
  channel.connect(meter);

  const node: TrackAudioNode = { channel, players: new Map(), meter };
  trackNodes.set(trackId, node);
  return node;
}

export function getTrackNodes(trackId: string): TrackAudioNode | undefined {
  return trackNodes.get(trackId);
}

/** Ensure track audio nodes exist — creates them lazily if missing */
export function ensureTrackNodes(trackId: string): TrackAudioNode {
  const existing = trackNodes.get(trackId);
  if (existing) return existing;
  return createTrackNodes(trackId);
}

export function getTrackLevel(trackId: string): number {
  const node = trackNodes.get(trackId);
  if (!node) return -Infinity;
  const val = node.meter.getValue();
  return typeof val === 'number' ? val : val[0] ?? -Infinity;
}

export function setTrackVolume(trackId: string, volume: number): void {
  const node = trackNodes.get(trackId);
  if (node) node.channel.volume.value = volume;
}

export function setTrackPan(trackId: string, pan: number): void {
  const node = trackNodes.get(trackId);
  if (node) node.channel.pan.value = pan;
}

export function setTrackMute(trackId: string, mute: boolean): void {
  const node = trackNodes.get(trackId);
  if (node) node.channel.mute = mute;
}

export function setTrackSolo(trackId: string, solo: boolean): void {
  const node = trackNodes.get(trackId);
  if (node) node.channel.solo = solo;
}

export function addClipPlayer(clip: AudioClip): void {
  const node = trackNodes.get(clip.trackId);
  if (!node) return;

  // Apply warp time-stretching if configured for this clip
  let buffer = clip.buffer;
  const warpConfig = useWarpStore.getState().configs[clip.id];
  if (warpConfig?.enabled && warpConfig.mode !== 'off') {
    try {
      const sessionBpm = useTransportStore.getState().bpm;
      buffer = createWarpedBuffer(buffer, warpConfig, sessionBpm);
    } catch {
      // Warp failed — use original buffer
    }
  }

  const player = createPlayer(buffer);
  player.connect(node.channel);
  player.sync().start(clip.startTime, clip.offset, clip.duration);
  node.players.set(clip.id, player);

  // Re-route through effects chain if effects exist on this track
  reconnectTrackEffects(clip.trackId);
}

export function removeClipPlayer(trackId: string, clipId: string): void {
  const node = trackNodes.get(trackId);
  if (!node) return;

  const player = node.players.get(clipId);
  if (player) {
    disposeNode(player);
    node.players.delete(clipId);
  }
}

export function deleteTrackNodes(trackId: string): void {
  const node = trackNodes.get(trackId);
  if (!node) return;

  for (const player of node.players.values()) {
    disposeNode(player);
  }
  disposeNode(node.meter);
  disposeNode(node.channel);
  trackNodes.delete(trackId);
}
