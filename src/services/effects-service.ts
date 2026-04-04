import * as Tone from 'tone';
import { getTrackNodes } from './track-manager';
import type {
  EffectConfig,
  EffectType,
  EffectParams,
  ReverbParams,
  DelayParams,
  EQ3Params,
  CompressorParams,
  ChorusParams,
  DistortionParams,
  PhaserParams,
  FilterParams,
} from '@/types/effects';

interface EffectEntry {
  id: string;
  node: Tone.ToneAudioNode;
  enabled: boolean;
}

const trackEffectChains = new Map<string, EffectEntry[]>();

function createEffectNode(
  type: EffectType,
  params: EffectParams,
): Tone.ToneAudioNode {
  switch (type) {
    case 'reverb': {
      const p = params as ReverbParams;
      return new Tone.Reverb({ decay: p.decay, preDelay: p.preDelay, wet: p.wet });
    }
    case 'delay': {
      const p = params as DelayParams;
      return new Tone.FeedbackDelay({
        delayTime: p.delayTime,
        feedback: p.feedback,
        wet: p.wet,
      });
    }
    case 'eq': {
      const p = params as EQ3Params;
      return new Tone.EQ3({
        low: p.low,
        mid: p.mid,
        high: p.high,
        lowFrequency: p.lowFrequency,
        highFrequency: p.highFrequency,
      });
    }
    case 'compressor': {
      const p = params as CompressorParams;
      return new Tone.Compressor({
        threshold: p.threshold,
        ratio: p.ratio,
        attack: p.attack,
        release: p.release,
        knee: p.knee,
      });
    }
    case 'chorus': {
      const p = params as ChorusParams;
      return new Tone.Chorus({
        frequency: p.frequency,
        delayTime: p.delayTime,
        depth: p.depth,
        wet: p.wet,
      });
    }
    case 'distortion': {
      const p = params as DistortionParams;
      return new Tone.Distortion({ distortion: p.distortion, wet: p.wet });
    }
    case 'phaser': {
      const p = params as PhaserParams;
      return new Tone.Phaser({
        frequency: p.frequency,
        octaves: p.octaves,
        baseFrequency: p.baseFrequency,
        wet: p.wet,
      });
    }
    case 'filter': {
      const p = params as FilterParams;
      return new Tone.Filter({
        frequency: p.frequency,
        type: p.type,
        Q: p.Q,
        rolloff: p.rolloff,
      });
    }
  }
}

function reconnectChain(trackId: string): void {
  const trackNode = getTrackNodes(trackId);
  if (!trackNode) return;

  const entries = trackEffectChains.get(trackId) ?? [];

  // Disconnect all players from everything
  for (const player of trackNode.players.values()) {
    player.disconnect();
  }

  // Disconnect all effect nodes
  for (const entry of entries) {
    entry.node.disconnect();
  }

  // Build chain: players → [effects...] → channel
  const activeNodes = entries
    .filter((e) => e.enabled)
    .map((e) => e.node);

  if (activeNodes.length === 0) {
    // Direct connection: players → channel
    for (const player of trackNode.players.values()) {
      player.connect(trackNode.channel);
    }
  } else {
    // Connect players → first effect
    for (const player of trackNode.players.values()) {
      player.connect(activeNodes[0]!);
    }

    // Chain effects together
    for (let i = 0; i < activeNodes.length - 1; i++) {
      activeNodes[i]!.connect(activeNodes[i + 1]!);
    }

    // Last effect → channel
    activeNodes[activeNodes.length - 1]!.connect(trackNode.channel);
  }
}

export function addEffect(trackId: string, config: EffectConfig): void {
  const node = createEffectNode(config.type, config.params);

  if (!trackEffectChains.has(trackId)) {
    trackEffectChains.set(trackId, []);
  }

  const entries = trackEffectChains.get(trackId)!;
  entries.push({ id: config.id, node, enabled: config.enabled });

  reconnectChain(trackId);
}

export function removeEffect(trackId: string, effectId: string): void {
  const entries = trackEffectChains.get(trackId);
  if (!entries) return;

  const index = entries.findIndex((e) => e.id === effectId);
  if (index === -1) return;

  const entry = entries[index]!;
  entry.node.disconnect();
  entry.node.dispose();
  entries.splice(index, 1);

  reconnectChain(trackId);
}

export function updateEffectParams(
  trackId: string,
  effectId: string,
  params: Record<string, number | string>,
): void {
  const entries = trackEffectChains.get(trackId);
  if (!entries) return;

  const entry = entries.find((e) => e.id === effectId);
  if (!entry) return;

  const node = entry.node as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(params)) {
    const prop = node[key];
    if (prop instanceof Tone.Param || prop instanceof Tone.Signal) {
      prop.value = value as number;
    } else if (key in node) {
      node[key] = value;
    }
  }
}

export function toggleEffect(
  trackId: string,
  effectId: string,
  enabled: boolean,
): void {
  const entries = trackEffectChains.get(trackId);
  if (!entries) return;

  const entry = entries.find((e) => e.id === effectId);
  if (!entry) return;

  entry.enabled = enabled;
  reconnectChain(trackId);
}

export function reorderEffects(
  trackId: string,
  effectIds: string[],
): void {
  const entries = trackEffectChains.get(trackId);
  if (!entries) return;

  const reordered: EffectEntry[] = [];
  for (const id of effectIds) {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      reordered.push(entry);
    }
  }

  trackEffectChains.set(trackId, reordered);
  reconnectChain(trackId);
}

export function disposeTrackEffects(trackId: string): void {
  const entries = trackEffectChains.get(trackId);
  if (!entries) return;

  for (const entry of entries) {
    entry.node.disconnect();
    entry.node.dispose();
  }

  trackEffectChains.delete(trackId);
}

export function getTrackEffectEntries(
  trackId: string,
): EffectEntry[] | undefined {
  return trackEffectChains.get(trackId);
}
