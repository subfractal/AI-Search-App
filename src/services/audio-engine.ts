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

const SUPPORTED_FORMATS = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/x-m4a'];
const WARN_FILE_SIZE = 200 * 1024 * 1024;

export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  // File format guard
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    throw new Error(`Unsupported format: ${file.type || file.name}. Supported: WAV, MP3, OGG, FLAC, AAC, M4A`);
  }

  // File size guard
  if (file.size > WARN_FILE_SIZE) {
    console.warn(`[DAW] Warning: File "${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — very large files may take time to decode`);
  }

  // Ensure audio context is started before decoding
  await initAudioContext();

  // Resume context if it was suspended (mobile browsers, backgrounded tabs)
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    try {
      ctx.resume(); // fire-and-forget; decodeAudioData works on suspended context
    } catch (err) {
      console.warn('[DAW] Failed to resume audio context (user gesture may be required):', err);
      // Continue anyway — will fail at decode if truly blocked
    }
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
    try {
      return await ctx.decodeAudioData(copy);
    } catch (retryErr) {
      throw new Error(`Failed to decode "${file.name}" — file may be corrupted or in an unsupported format. Error: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
    }
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
