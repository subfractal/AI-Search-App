import * as Tone from 'tone';

let audioContextStarted = false;

export async function initAudioContext(): Promise<void> {
  if (audioContextStarted) return;
  await Tone.start();
  audioContextStarted = true;
}

export function getAudioContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext;
}

export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

export async function loadAudioFromUrl(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

export function createPlayer(buffer: AudioBuffer): Tone.Player {
  const toneBuffer = new Tone.ToneAudioBuffer(buffer);
  return new Tone.Player(toneBuffer);
}

export function createChannel(
  volume: number = 0,
  pan: number = 0,
): Tone.Channel {
  return new Tone.Channel(volume, pan).toDestination();
}

export function disposeNode(node: Tone.ToneAudioNode): void {
  node.dispose();
}
