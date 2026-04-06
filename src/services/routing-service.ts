import * as Tone from 'tone';
import { getTrackNodes } from './track-manager';
import type { BusType, SidechainConfig } from '@/types/routing';

interface BusNode {
  channel: Tone.Channel;
  meter: Tone.Meter;
  type: BusType;
}

interface SidechainNode {
  follower: Tone.Meter;
  gain: Tone.Gain;
  config: SidechainConfig;
}

const busNodes = new Map<string, BusNode>();
const sendNodes = new Map<string, Tone.Gain>();
const sidechainNodes = new Map<string, SidechainNode>();
const sidechainLoops = new Map<string, number>();
const groupAssignments = new Map<string, string>(); // trackId -> groupBusId

// --- Bus management ---

export function createBus(busId: string, type: BusType): void {
  if (busNodes.has(busId)) return;

  const channel = new Tone.Channel(0, 0).toDestination();
  const meter = new Tone.Meter({ smoothing: 0.8 });
  channel.connect(meter);

  busNodes.set(busId, { channel, meter, type });
}

export function disposeBus(busId: string): void {
  const node = busNodes.get(busId);
  if (!node) return;

  node.meter.dispose();
  node.channel.dispose();
  busNodes.delete(busId);
}

export function setBusVolume(busId: string, volume: number): void {
  const node = busNodes.get(busId);
  if (node) node.channel.volume.value = volume;
}

export function setBusPan(busId: string, pan: number): void {
  const node = busNodes.get(busId);
  if (node) node.channel.pan.value = pan;
}

export function setBusMute(busId: string, mute: boolean): void {
  const node = busNodes.get(busId);
  if (node) node.channel.mute = mute;
}

export function setBusSolo(busId: string, solo: boolean): void {
  const node = busNodes.get(busId);
  if (node) node.channel.solo = solo;
}

export function getBusLevel(busId: string): number {
  const node = busNodes.get(busId);
  if (!node) return -Infinity;
  const val = node.meter.getValue();
  return typeof val === 'number' ? val : val[0] ?? -Infinity;
}

export function getBusNode(busId: string): BusNode | undefined {
  return busNodes.get(busId);
}

// --- Send management ---

export function createSend(
  sendId: string,
  sourceTrackId: string,
  busId: string,
  amount: number,
  _preFader: boolean,
): void {
  const sourceNode = getTrackNodes(sourceTrackId);
  const busNode = busNodes.get(busId);
  if (!sourceNode || !busNode) return;

  const gain = new Tone.Gain(amount);
  sourceNode.channel.connect(gain);
  gain.connect(busNode.channel);

  sendNodes.set(sendId, gain);
}

export function updateSendAmount(sendId: string, amount: number): void {
  const gain = sendNodes.get(sendId);
  if (gain) gain.gain.value = amount;
}

export function disposeSend(sendId: string): void {
  const gain = sendNodes.get(sendId);
  if (!gain) return;

  gain.disconnect();
  gain.dispose();
  sendNodes.delete(sendId);
}

// --- Group routing ---

export function assignTrackToGroup(
  trackId: string,
  groupBusId: string,
): void {
  const trackNode = getTrackNodes(trackId);
  const busNode = busNodes.get(groupBusId);
  if (!trackNode || !busNode) return;

  // If already assigned to a different group, remove first
  if (groupAssignments.has(trackId)) {
    removeTrackFromGroup(trackId);
  }

  trackNode.channel.disconnect(Tone.getDestination());
  trackNode.channel.connect(busNode.channel);
  groupAssignments.set(trackId, groupBusId);
}

export function removeTrackFromGroup(trackId: string): void {
  const trackNode = getTrackNodes(trackId);
  const currentGroupId = groupAssignments.get(trackId);
  if (!trackNode || !currentGroupId) return;

  const busNode = busNodes.get(currentGroupId);
  if (busNode) {
    try {
      trackNode.channel.disconnect(busNode.channel);
    } catch {
      // Already disconnected
    }
  }

  trackNode.channel.toDestination();
  groupAssignments.delete(trackId);
}

// --- Sidechain compression ---

export function createSidechain(config: SidechainConfig): void {
  const sourceNode = getTrackNodes(config.sourceTrackId);
  const targetNode = getTrackNodes(config.targetTrackId);
  if (!sourceNode || !targetNode) return;

  // Meter on source to track envelope (Follower has no getValue)
  const follower = new Tone.Meter({ smoothing: 0.8 });
  sourceNode.channel.connect(follower);

  // Gain node inserted into target's signal path
  const gain = new Tone.Gain(1);

  // Check if target is assigned to a group
  const currentGroupId = groupAssignments.get(config.targetTrackId);
  const destinationNode = currentGroupId
    ? busNodes.get(currentGroupId)?.channel
    : undefined;

  targetNode.channel.disconnect();
  targetNode.channel.connect(gain);

  if (destinationNode) {
    gain.connect(destinationNode);
  } else {
    gain.toDestination();
  }

  // Reconnect meter
  targetNode.channel.connect(targetNode.meter);

  sidechainNodes.set(config.id, { follower, gain, config });
  startSidechainLoop(config.id);
}

function startSidechainLoop(id: string): void {
  const node = sidechainNodes.get(id);
  if (!node) return;

  const loop = (): void => {
    const scNode = sidechainNodes.get(id);
    if (!scNode) return;

    const { follower, gain, config } = scNode;
    const raw = follower.getValue();
    // Tone.Meter.getValue() returns dB directly
    const dbLevel = typeof raw === 'number' ? raw : raw[0] ?? -Infinity;

    if (config.enabled && dbLevel > config.threshold) {
      const overDb = dbLevel - config.threshold;
      const reductionDb = overDb * (1 - 1 / config.ratio);
      const targetGain = Math.pow(10, -reductionDb / 20);
      const mixed = targetGain * config.amount + (1 - config.amount);
      gain.gain.value = mixed;
    } else {
      // Smoothly return to unity
      gain.gain.value += (1 - gain.gain.value) * 0.1;
    }

    sidechainLoops.set(id, requestAnimationFrame(loop));
  };

  loop();
}

export function updateSidechain(config: SidechainConfig): void {
  const node = sidechainNodes.get(config.id);
  if (!node) return;

  node.config = config;

  // Update follower attack time
  if (node.follower.smoothing !== config.attack) {
    node.follower.smoothing = config.attack || 0.01;
  }
}

export function disposeSidechain(id: string): void {
  // Stop the animation loop
  const loopId = sidechainLoops.get(id);
  if (loopId !== undefined) {
    cancelAnimationFrame(loopId);
    sidechainLoops.delete(id);
  }

  const node = sidechainNodes.get(id);
  if (!node) return;

  const { follower, gain, config } = node;

  // Restore original signal path for target track
  const targetNode = getTrackNodes(config.targetTrackId);
  if (targetNode) {
    try {
      targetNode.channel.disconnect(gain);
    } catch {
      // Already disconnected
    }

    const currentGroupId = groupAssignments.get(config.targetTrackId);
    const destinationNode = currentGroupId
      ? busNodes.get(currentGroupId)?.channel
      : undefined;

    if (destinationNode) {
      targetNode.channel.connect(destinationNode);
    } else {
      targetNode.channel.toDestination();
    }
  }

  follower.dispose();
  gain.dispose();
  sidechainNodes.delete(id);
}

// --- Cleanup ---

export function disposeAllRouting(): void {
  for (const id of sidechainLoops.keys()) {
    const loopId = sidechainLoops.get(id);
    if (loopId !== undefined) cancelAnimationFrame(loopId);
  }
  sidechainLoops.clear();

  for (const node of sidechainNodes.values()) {
    node.follower.dispose();
    node.gain.dispose();
  }
  sidechainNodes.clear();

  for (const gain of sendNodes.values()) {
    gain.disconnect();
    gain.dispose();
  }
  sendNodes.clear();

  for (const node of busNodes.values()) {
    node.meter.dispose();
    node.channel.dispose();
  }
  busNodes.clear();

  groupAssignments.clear();
}
