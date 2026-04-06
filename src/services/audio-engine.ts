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

  // Ensure we have a usable AudioContext
  let ctx = getAudioContext();

  // If context is closed (mobile Safari/Chrome after inactivity), create a new one
  if (ctx.state === 'closed') {
    console.warn('[DAW] AudioContext was closed — creating a new one');
    const newCtx = new AudioContext();
    Tone.setContext(new Tone.Context(newCtx));
    audioContextStarted = true;
    ctx = newCtx;
  }

  // Resume if suspended (mobile browsers, backgrounded tabs)
  if (ctx.state === 'suspended') {
    try {
      ctx.resume(); // fire-and-forget; decodeAudioData works on suspended context
    } catch (err) {
      console.warn('[DAW] Failed to resume audio context:', err);
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error(`File "${file.name}" is empty`);
  }

  // Hard timeout wrapper — never let decodeAudioData hang forever
  const DECODE_TIMEOUT_MS = 15000;
  function decodeWithTimeout(buf: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise<AudioBuffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(
          `Decoding "${file.name}" timed out after ${DECODE_TIMEOUT_MS / 1000}s — please try again`
        ));
      }, DECODE_TIMEOUT_MS);

      ctx.decodeAudioData(buf).then(
        (decoded) => { clearTimeout(timer); resolve(decoded); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }

  // decodeAudioData can throw or return null on some browsers — wrap defensively
  try {
    return await decodeWithTimeout(arrayBuffer.slice(0));
  } catch (err) {
    // Retry once with a fresh copy (some browsers corrupt the buffer on first decode failure)
    console.warn(`[DAW] Retrying decode for "${file.name}":`, err);

    // On retry, also try resuming context again (user gesture may now be available)
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }

    const copy = await file.arrayBuffer();
    try {
      return await decodeWithTimeout(copy);
    } catch (retryErr) {
      throw new Error(
        `Failed to decode "${file.name}" — ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`
      );
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
