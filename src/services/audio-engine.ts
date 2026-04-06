import * as Tone from 'tone';

let audioContextStarted = false;
const onReadyCallbacks: Array<() => void> = [];

export async function initAudioContext(): Promise<void> {
  if (audioContextStarted) return;
  await Tone.start();
  audioContextStarted = true;
  console.log('[DAW] Audio context started:', Tone.getContext().state);
  // Flush any callbacks waiting for audio to be ready
  while (onReadyCallbacks.length > 0) {
    const cb = onReadyCallbacks.shift()!;
    try { cb(); } catch (e) { console.warn('[DAW] onReady callback error:', e); }
  }
}

/** Register a callback to run once when audio context is ready. */
export function onAudioReady(cb: () => void): void {
  if (audioContextStarted) {
    cb();
  } else {
    onReadyCallbacks.push(cb);
  }
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

  const rawBuffer = await file.arrayBuffer();
  if (rawBuffer.byteLength === 0) {
    throw new Error(`File "${file.name}" is empty`);
  }

  // ── MP3 ID3 tag stripping ──
  // MP3 files often have ID3v2 headers (metadata, album art) that can
  // confuse some browser decoders. Strip the ID3v2 header if present.
  const arrayBuffer = stripId3Header(rawBuffer);

  // ── Adaptive timeout based on file size ──
  // WAV decoding is fast (~1-2s). MP3/FLAC decoding is CPU-intensive
  // and can take 15-25s for large files (16MB+). Scale timeout accordingly.
  const fileSizeMB = file.size / (1024 * 1024);
  const DECODE_TIMEOUT_MS = Math.max(15000, Math.min(60000, Math.round(fileSizeMB * 2000)));
  console.log(`[DAW] Decoding "${file.name}" (${fileSizeMB.toFixed(1)}MB) — timeout ${DECODE_TIMEOUT_MS / 1000}s`);

  // ── KEY FIX: Decode on a FRESH AudioContext ──
  // The main Tone.js context may be suspended/closed on mobile and
  // ctx.resume() can hang when called outside a trusted user gesture.
  // A brand-new AudioContext starts in "running" state on desktop and
  // "suspended" on mobile, but decodeAudioData is purely CPU-side and
  // does NOT require the context to be running. This completely
  // sidesteps the resume() hang.
  async function decodeOnFreshContext(buf: ArrayBuffer): Promise<AudioBuffer> {
    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
      const decoded = await Promise.race<AudioBuffer>([
        tempCtx.decodeAudioData(buf),
        new Promise<AudioBuffer>((_, reject) =>
          setTimeout(() => reject(new Error(
            `Decoding timed out after ${DECODE_TIMEOUT_MS / 1000}s — file may be too large or in an unsupported format`
          )), DECODE_TIMEOUT_MS)
        ),
      ]);
      return decoded;
    } finally {
      try { tempCtx.close(); } catch { /* ignore */ }
    }
  }

  // First attempt — .slice(0) because decodeAudioData transfers buffer ownership
  try {
    return await decodeOnFreshContext(arrayBuffer.slice(0));
  } catch (err) {
    console.warn(`[DAW] First decode attempt failed for "${file.name}":`, err);
  }

  // Retry with a completely fresh ArrayBuffer from the File object
  // (not a reference to the original — re-read from the File)
  try {
    const freshRead = await file.arrayBuffer();
    const freshBuf = stripId3Header(freshRead);
    return await decodeOnFreshContext(freshBuf.slice(0));
  } catch (retryErr) {
    throw new Error(
      `Could not load "${file.name}" — please try a different format or try again. ` +
      `(${retryErr instanceof Error ? retryErr.message : String(retryErr)})`
    );
  }
}

/**
 * Strip ID3v2 header from MP3 data if present.
 * ID3v2 tags at the start of an MP3 can confuse some browser decoders.
 * Returns the buffer starting at the first audio frame.
 */
function stripId3Header(buffer: ArrayBuffer): ArrayBuffer {
  const view = new Uint8Array(buffer);

  // ID3v2 header: starts with "ID3" (0x49, 0x44, 0x33)
  if (view.length > 10 && view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33) {
    // ID3v2 size is stored in bytes 6-9 as syncsafe integers (7 bits per byte)
    const size =
      ((view[6]! & 0x7F) << 21) |
      ((view[7]! & 0x7F) << 14) |
      ((view[8]! & 0x7F) << 7) |
      (view[9]! & 0x7F);
    const headerSize = 10 + size; // 10-byte header + tag body

    if (headerSize < buffer.byteLength) {
      console.log(`[DAW] Stripped ${headerSize} byte ID3v2 header`);
      return buffer.slice(headerSize);
    }
  }

  return buffer;
}

export async function loadAudioFromUrl(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  // Use a fresh AudioContext for decoding — same approach as loadAudioFile
  const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    return await tempCtx.decodeAudioData(arrayBuffer);
  } finally {
    try { tempCtx.close(); } catch { /* ignore */ }
  }
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
