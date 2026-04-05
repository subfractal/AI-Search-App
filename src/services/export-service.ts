import * as Tone from 'tone';
import type { Track } from '@/types/audio';
import { isAudioClip } from '@/types/audio';

/**
 * Bounce (offline-render) the entire session to an AudioBuffer.
 */
export async function bounceSession(
  tracks: Track[],
  duration: number,
  sampleRate: number = 44100,
): Promise<AudioBuffer> {
  const toneBuffer = await Tone.Offline(({ transport }) => {
    transport.bpm.value = Tone.getTransport().bpm.value;

    for (const track of tracks) {
      if (track.mute) continue;

      const channel = new Tone.Channel(track.volume, track.pan).toDestination();

      for (const clip of track.clips) {
        if (!isAudioClip(clip)) continue;

        const toneBuffer = new Tone.ToneAudioBuffer(clip.buffer);
        const player = new Tone.Player(toneBuffer);
        player.connect(channel);
        player.sync().start(clip.startTime, clip.offset, clip.duration);
      }
    }

    transport.start(0);
  }, duration, 2, sampleRate);
  return toneBuffer.get() as AudioBuffer;
}

/**
 * Convert an AudioBuffer to a 16-bit PCM WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = buffer.length;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Gather channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  // Interleave and write 16-bit PCM samples
  let offset = headerSize;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channels[ch]![i]!;
      // Clamp to [-1, 1] and convert to 16-bit integer
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0
        ? Math.max(-32768, Math.round(clamped * 32768))
        : Math.min(32767, Math.round(clamped * 32767));
      view.setInt16(offset, int16, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Trigger a browser download of a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Bounce the full session to WAV and download.
 */
export async function exportSession(
  tracks: Track[],
  duration: number,
  filename?: string,
): Promise<void> {
  const buffer = await bounceSession(tracks, duration);
  const wav = audioBufferToWav(buffer);
  const name = filename ?? `mix-export-${Date.now()}.wav`;
  downloadBlob(wav, name);
}

/**
 * Export a single track as a stem (WAV download).
 */
export async function exportStem(
  track: Track,
  duration: number,
  filename?: string,
): Promise<void> {
  const buffer = await bounceSession([track], duration);
  const wav = audioBufferToWav(buffer);
  const name = filename ?? `${track.name}-stem-${Date.now()}.wav`;
  downloadBlob(wav, name);
}
