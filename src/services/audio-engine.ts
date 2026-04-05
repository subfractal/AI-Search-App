import * as Tone from 'tone';

let audioContextStarted = false;

export async function initAudioContext(): Promise<void> {
  if (audioContextStarted) return;
  await Tone.start();
  audioContextStarted = true;
  console.log('[DAW] Audio context started:', Tone.getContext().state);
}

export function isAudioReady(): boolean {
  return audioContextStarted;
}

export function getAudioContext(): AudioContext {
  return Tone.getContext().rawContext as AudioContext;
}

export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  // Ensure audio context is started before decoding
  await initAudioContext();

  // Resume context if it was suspended (mobile browsers, backgrounded tabs)
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error(`File "${file.name}" is empty`);
  }

  // decodeAudioData can throw or return null on some browsers — wrap defensively
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return buffer;
  } catch (err) {
    // Retry once with a fresh copy (some browsers corrupt the buffer on first decode failure)
    console.warn(`[DAW] Retrying decode for "${file.name}":`, err);
    const copy = await file.arrayBuffer();
    return ctx.decodeAudioData(copy);
  }
}

export async function loadAudioFromUrl(url: string): Promise<AudioBuffer> {
  await initAudioContext();
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
