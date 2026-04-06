import type { AudioClip, MidiClip, Clip } from '@/types/audio';
import { isAudioClip } from '@/types/audio';
import { generateId } from '@/utils/id';

/**
 * Split a clip at the given time (relative to clip start).
 * Returns two new clips: [left, right].
 */
export function splitClip(clip: Clip, splitTime: number): [Clip, Clip] {
  if (splitTime <= 0 || splitTime >= clip.duration) {
    throw new Error(
      `splitTime must be between 0 and clip duration (${clip.duration})`
    );
  }

  if (isAudioClip(clip)) {
    const left: AudioClip = {
      ...clip,
      id: generateId('clip'),
      duration: splitTime,
    };
    const right: AudioClip = {
      ...clip,
      id: generateId('clip'),
      name: `${clip.name} (R)`,
      startTime: clip.startTime + splitTime,
      offset: clip.offset + splitTime,
      duration: clip.duration - splitTime,
    };
    return [left, right];
  }

  // MidiClip
  const midi = clip as MidiClip;
  const leftNotes = midi.notes.filter(
    (n) => n.startTime < splitTime
  ).map((n) => ({
    ...n,
    duration: Math.min(n.duration, splitTime - n.startTime),
  }));
  const rightNotes = midi.notes.filter(
    (n) => n.startTime + n.duration > splitTime
  ).map((n) => ({
    ...n,
    startTime: Math.max(0, n.startTime - splitTime),
    duration: n.startTime < splitTime
      ? n.duration - (splitTime - n.startTime)
      : n.duration,
  }));

  const left: MidiClip = {
    ...midi,
    id: generateId('clip'),
    duration: splitTime,
    notes: leftNotes,
  };
  const right: MidiClip = {
    ...midi,
    id: generateId('clip'),
    name: `${midi.name} (R)`,
    startTime: midi.startTime + splitTime,
    duration: midi.duration - splitTime,
    notes: rightNotes,
  };
  return [left, right];
}

/**
 * Deep clone a clip with a new ID, placed immediately after the original.
 */
export function duplicateClip(clip: Clip): Clip {
  if (isAudioClip(clip)) {
    const dup: AudioClip = {
      ...clip,
      id: generateId('clip'),
      name: `${clip.name} (copy)`,
      startTime: clip.startTime + clip.duration,
    };
    return dup;
  }

  const midi = clip as MidiClip;
  const dup: MidiClip = {
    ...midi,
    id: generateId('clip'),
    name: `${midi.name} (copy)`,
    startTime: midi.startTime + midi.duration,
    notes: midi.notes.map((n) => ({ ...n })),
  };
  return dup;
}

/**
 * Resize a clip to a new duration.
 * Audio clips cannot exceed buffer length minus offset.
 * MIDI clips drop notes that fall outside the new duration.
 */
export function resizeClip(clip: Clip, newDuration: number): Clip {
  if (newDuration <= 0) {
    throw new Error('Duration must be positive');
  }

  if (isAudioClip(clip)) {
    const maxDuration = clip.buffer.duration - clip.offset;
    const clamped = Math.min(newDuration, maxDuration);
    return { ...clip, duration: clamped };
  }

  const midi = clip as MidiClip;
  const filtered = midi.notes
    .filter((n) => n.startTime < newDuration)
    .map((n) => ({
      ...n,
      duration: Math.min(n.duration, newDuration - n.startTime),
    }));
  return { ...midi, duration: newDuration, notes: filtered };
}

/**
 * Move a clip to a new start time.
 */
export function moveClip(clip: Clip, newStartTime: number): Clip {
  return { ...clip, startTime: Math.max(0, newStartTime) };
}

/**
 * Trim the start of an audio clip by adjusting the buffer offset.
 * startTime advances and duration shrinks accordingly.
 */
export function trimClipStart(
  clip: AudioClip,
  newOffset: number,
): AudioClip {
  if (newOffset < 0 || newOffset >= clip.buffer.duration) {
    throw new Error('Offset out of range');
  }
  const delta = newOffset - clip.offset;
  return {
    ...clip,
    offset: newOffset,
    startTime: clip.startTime + delta,
    duration: Math.max(0, clip.duration - delta),
  };
}

/**
 * Create a new clip with reversed audio samples.
 */
export function reverseClip(clip: AudioClip): AudioClip {
  const { buffer } = clip;
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const reversed = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = reversed.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[src.length - 1 - i]!;
    }
  }

  return {
    ...clip,
    id: generateId('clip'),
    name: `${clip.name} (rev)`,
    buffer: reversed,
    offset: 0,
  };
}

/**
 * Normalize an audio clip to 0 dB by scaling all samples
 * relative to the peak amplitude.
 */
export function normalizeClip(clip: AudioClip): AudioClip {
  const { buffer } = clip;
  const ctx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const normalized = ctx.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  // Find peak across all channels
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]!);
      if (abs > peak) peak = abs;
    }
  }

  if (peak === 0) {
    return clip; // silence — nothing to normalize
  }

  const gain = 1 / peak;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = normalized.getChannelData(ch);
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[i]! * gain;
    }
  }

  return {
    ...clip,
    id: generateId('clip'),
    name: `${clip.name} (norm)`,
    buffer: normalized,
  };
}

/**
 * Quantize MIDI note start times to the nearest grid position.
 * @param gridSize - Grid size in seconds (e.g. 0.125 for 16th notes at 120 BPM)
 */
export function quantizeNotes(
  clip: MidiClip,
  gridSize: number,
): MidiClip {
  if (gridSize <= 0) {
    throw new Error('Grid size must be positive');
  }

  const quantized = clip.notes.map((note) => {
    const snapped = Math.round(note.startTime / gridSize) * gridSize;
    return { ...note, startTime: snapped };
  });

  return { ...clip, notes: quantized };
}
