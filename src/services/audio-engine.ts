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

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error(`File "${file.name}" is empty`);
  }

  // ── KEY FIX: Decode on a FRESH AudioContext ──
  // The main Tone.js context may be suspended/closed on mobile and
  // ctx.resume() can hang when called outside a trusted user gesture.
  // A brand-new AudioContext starts in "running" state on desktop and
  // "suspended" on mobile, but decodeAudioData is purely CPU-side and
  // does NOT require the context to be running. This completely
  // sidesteps the resume() hang.
  const DECODE_TIMEOUT_MS = 10000;

  async function decodeOnFreshContext(buf: ArrayBuffer): Promise<AudioBuffer> {
    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
      const decoded = await Promise.race<AudioBuffer>([
        tempCtx.decodeAudioData(buf),
        new Promise<AudioBuffer>((_, reject) =>
          setTimeout(() => reject(new Error(
            `Could not load audio file — decoding timed out after ${DECODE_TIMEOUT_MS / 1000}s. Please try a different format or try again.`
          )), DECODE_TIMEOUT_MS)
        ),
      ]);
      return decoded;
    } finally {
      // Discard the temporary context to free resources
      try { tempCtx.close(); } catch { /* ignore */ }
    }
  }

  // First attempt
  try {
    return await decodeOnFreshContext(arrayBuffer.slice(0));
  } catch (err) {
    console.warn(`[DAW] First decode attempt failed for "${file.name}":`, err);
  }

  // Retry once with a fresh ArrayBuffer copy
  try {
    const copy = await file.arrayBuffer();
    return await decodeOnFreshContext(copy);
  } catch (retryErr) {
    throw new Error(
      `Could not load "${file.name}" — please try a different format or try again. ` +
      `(${retryErr instanceof Error ? retryErr.message : String(retryErr)})`
    );
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
