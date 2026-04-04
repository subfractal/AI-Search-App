import type { WarpConfig, WarpMarker, WarpMode } from '@/types/warp';
import { detectBpm, detectBeats, detectTransients } from '@/services/ai/beat-detector';
import { generateId } from '@/utils/id';

/**
 * Detect the first significant transient in the buffer — the "Origin Strike"
 * or anchor point. This is the temporal zero from which all warping is measured.
 */
export function detectAnchorPoint(buffer: AudioBuffer): number {
  const transients = detectTransients(buffer);
  if (transients.length === 0) return 0;

  // The first strong transient is the anchor/downbeat.
  // If the first transient is very close to 0 (< 50ms), it's likely
  // a genuine downbeat. Otherwise, look for the first transient that
  // follows a quiet gap — indicating the actual musical start.
  const first = transients[0]!;
  if (first < 0.05) return first;

  // Check if there's a louder transient within the first second
  // that might be the true downbeat after a pickup note
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  let bestEnergy = 0;
  let bestTime = first;

  for (const t of transients) {
    if (t > 1.0) break; // only check first second
    const sampleIdx = Math.floor(t * sampleRate);
    const windowEnd = Math.min(sampleIdx + 512, data.length);
    let energy = 0;
    for (let i = sampleIdx; i < windowEnd; i++) {
      energy += data[i]! * data[i]!;
    }
    if (energy > bestEnergy) {
      bestEnergy = energy;
      bestTime = t;
    }
  }

  return bestTime;
}

/**
 * Run beat detection on a buffer and produce a WarpConfig that aligns
 * the detected beats to the session BPM grid.
 */
export function analyzeAndAutoWarp(
  _clipId: string,
  buffer: AudioBuffer,
  sessionBpm: number,
): WarpConfig {
  const { bpm, confidence } = detectBpm(buffer);
  const beats = detectBeats(buffer);
  const anchorTime = detectAnchorPoint(buffer);

  const beatInterval = 60 / sessionBpm;
  const markers: WarpMarker[] = beats.map((beatTime, idx) => ({
    id: generateId('wm'),
    sourceTime: beatTime,
    targetTime: idx * beatInterval,
  }));

  const barCount = Math.max(1, Math.round(beats.length / 4));
  const stretchState = beats.length > 8 ? 'fluid' as const : 'steady' as const;

  return {
    enabled: true,
    mode: 'beats',
    stretchState,
    originalBpm: bpm,
    originalBpmConfidence: confidence,
    anchorTime,
    barCount,
    markers,
    autoWarped: true,
  };
}

/**
 * Calculate the warped duration based on BPM ratio.
 */
export function getWarpedDuration(
  config: WarpConfig,
  originalDuration: number,
  _sessionBpm: number,
): number {
  if (!config.enabled || config.mode === 'off') {
    return originalDuration;
  }

  if (config.markers.length >= 2) {
    const lastMarker = config.markers[config.markers.length - 1]!;
    const firstMarker = config.markers[0]!;
    const sourceSpan = lastMarker.sourceTime - firstMarker.sourceTime;
    const targetSpan = lastMarker.targetTime - firstMarker.targetTime;

    if (sourceSpan > 0) {
      const ratio = targetSpan / sourceSpan;
      return originalDuration * ratio;
    }
  }

  // Fallback: use BPM ratio
  if (config.originalBpm > 0) {
    const ratio = config.originalBpm / _sessionBpm;
    return originalDuration * ratio;
  }

  return originalDuration;
}

/**
 * Given a target time (warped timeline), return the corresponding
 * source time in the original audio. Linearly interpolates between
 * warp markers.
 */
export function getSourceTime(config: WarpConfig, targetTime: number): number {
  const { markers } = config;
  if (!config.enabled || config.mode === 'off' || markers.length === 0) {
    return targetTime;
  }

  const sorted = [...markers].sort((a, b) => a.targetTime - b.targetTime);

  // Before first marker — extrapolate
  if (targetTime <= sorted[0]!.targetTime) {
    if (sorted.length === 1) return sorted[0]!.sourceTime;
    const m0 = sorted[0]!;
    const m1 = sorted[1]!;
    const rate =
      (m1.sourceTime - m0.sourceTime) / (m1.targetTime - m0.targetTime);
    return m0.sourceTime + (targetTime - m0.targetTime) * rate;
  }

  // After last marker — extrapolate
  const last = sorted[sorted.length - 1]!;
  if (targetTime >= last.targetTime) {
    if (sorted.length === 1) return last.sourceTime;
    const prev = sorted[sorted.length - 2]!;
    const rate =
      (last.sourceTime - prev.sourceTime) / (last.targetTime - prev.targetTime);
    return last.sourceTime + (targetTime - last.targetTime) * rate;
  }

  // Between markers — interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (targetTime >= a.targetTime && targetTime <= b.targetTime) {
      const t =
        (targetTime - a.targetTime) / (b.targetTime - a.targetTime);
      return a.sourceTime + t * (b.sourceTime - a.sourceTime);
    }
  }

  return targetTime;
}

/**
 * Given a source time (original audio), return the corresponding
 * target time in the warped timeline.
 */
export function getTimeMapping(config: WarpConfig, time: number): number {
  const { markers } = config;
  if (!config.enabled || config.mode === 'off' || markers.length === 0) {
    return time;
  }

  const sorted = [...markers].sort((a, b) => a.sourceTime - b.sourceTime);

  // Before first marker
  if (time <= sorted[0]!.sourceTime) {
    if (sorted.length === 1) return sorted[0]!.targetTime;
    const m0 = sorted[0]!;
    const m1 = sorted[1]!;
    const rate =
      (m1.targetTime - m0.targetTime) / (m1.sourceTime - m0.sourceTime);
    return m0.targetTime + (time - m0.sourceTime) * rate;
  }

  // After last marker
  const last = sorted[sorted.length - 1]!;
  if (time >= last.sourceTime) {
    if (sorted.length === 1) return last.targetTime;
    const prev = sorted[sorted.length - 2]!;
    const rate =
      (last.targetTime - prev.targetTime) / (last.sourceTime - prev.sourceTime);
    return last.targetTime + (time - last.sourceTime) * rate;
  }

  // Between markers
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (time >= a.sourceTime && time <= b.sourceTime) {
      const t = (time - a.sourceTime) / (b.sourceTime - a.sourceTime);
      return a.targetTime + t * (b.targetTime - a.targetTime);
    }
  }

  return time;
}

// ---------------------------------------------------------------------------
// Time-stretching DSP
// ---------------------------------------------------------------------------

function hanningWindow(size: number): Float32Array {
  const win = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return win;
}

/**
 * Linear-interpolation resampling — used for "repitch" mode.
 * Ratio > 1 = slower/longer, ratio < 1 = faster/shorter.
 */
function resampleLinear(input: Float32Array, ratio: number): Float32Array {
  const outLen = Math.max(1, Math.round(input.length * ratio));
  const output = new Float32Array(outLen);

  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const s0 = input[idx] ?? 0;
    const s1 = input[Math.min(idx + 1, input.length - 1)] ?? 0;
    output[i] = s0 + frac * (s1 - s0);
  }

  return output;
}

/**
 * Simplified WSOLA (Waveform Similarity Overlap-Add) stretching.
 * Ratio > 1 = longer output, ratio < 1 = shorter output.
 */
function wsolaStretch(
  input: Float32Array,
  ratio: number,
  windowSize: number,
  hopSize: number,
): Float32Array {
  if (input.length === 0) return new Float32Array(0);

  const outLen = Math.max(1, Math.round(input.length * ratio));
  const output = new Float32Array(outLen);
  const window = hanningWindow(windowSize);

  const analysisHop = hopSize;
  const synthesisHop = Math.max(1, Math.round(hopSize * ratio));
  const numFrames = Math.floor((input.length - windowSize) / analysisHop);

  if (numFrames <= 0) {
    // Input too short for windowed processing — fall back to resampling
    return resampleLinear(input, ratio);
  }

  for (let frame = 0; frame < numFrames; frame++) {
    const analysisStart = frame * analysisHop;
    const synthesisStart = frame * synthesisHop;

    for (let j = 0; j < windowSize; j++) {
      const outIdx = synthesisStart + j;
      if (outIdx >= outLen) break;

      const srcIdx = analysisStart + j;
      const sample = srcIdx < input.length ? (input[srcIdx] ?? 0) : 0;
      const win = window[j] ?? 0;
      output[outIdx] = (output[outIdx] ?? 0) + sample * win;
    }
  }

  return output;
}

function getWindowSizeForMode(mode: WarpMode): number {
  switch (mode) {
    case 'beats':
      return 2048;
    case 'tones':
      return 4096;
    case 'texture':
      return 8192;
    default:
      return 2048;
  }
}

function stretchSegment(
  inputSamples: Float32Array,
  ratio: number,
  mode: WarpMode,
  _sampleRate: number,
): Float32Array {
  if (ratio === 1) return inputSamples;

  if (mode === 'repitch') {
    return resampleLinear(inputSamples, ratio);
  }

  const windowSize = getWindowSizeForMode(mode);
  const hopSize = Math.floor(windowSize / 4);
  return wsolaStretch(inputSamples, ratio, windowSize, hopSize);
}

/**
 * Create a new AudioBuffer with time-stretching applied per the warp config.
 */
export function createWarpedBuffer(
  buffer: AudioBuffer,
  config: WarpConfig,
  sessionBpm: number,
): AudioBuffer {
  if (!config.enabled || config.mode === 'off') {
    return buffer;
  }

  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const warpedDuration = getWarpedDuration(config, buffer.duration, sessionBpm);
  const warpedLength = Math.max(1, Math.round(warpedDuration * sampleRate));

  // Gather sorted markers; add implicit start/end anchors
  const sorted = [...config.markers].sort(
    (a, b) => a.sourceTime - b.sourceTime,
  );

  // Build segment boundaries in samples
  interface Segment {
    srcStart: number;
    srcEnd: number;
    tgtStart: number;
    tgtEnd: number;
  }

  const segments: Segment[] = [];

  const anchors = [
    { sourceTime: 0, targetTime: 0 },
    ...sorted,
    {
      sourceTime: buffer.duration,
      targetTime: warpedDuration,
    },
  ];

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    segments.push({
      srcStart: Math.round(a.sourceTime * sampleRate),
      srcEnd: Math.round(b.sourceTime * sampleRate),
      tgtStart: Math.round(a.targetTime * sampleRate),
      tgtEnd: Math.round(b.targetTime * sampleRate),
    });
  }

  const ctx = new OfflineAudioContext(numChannels, warpedLength, sampleRate);
  const outBuffer = ctx.createBuffer(numChannels, warpedLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    const outChannel = outBuffer.getChannelData(ch);

    for (const seg of segments) {
      const srcLen = seg.srcEnd - seg.srcStart;
      const tgtLen = seg.tgtEnd - seg.tgtStart;

      if (srcLen <= 0 || tgtLen <= 0) continue;

      const ratio = tgtLen / srcLen;
      const input = channelData.slice(seg.srcStart, seg.srcEnd);
      const stretched = stretchSegment(input, ratio, config.mode, sampleRate);

      // Copy stretched samples to output at tgtStart
      const copyLen = Math.min(stretched.length, warpedLength - seg.tgtStart);
      for (let j = 0; j < copyLen; j++) {
        const idx = seg.tgtStart + j;
        if (idx < warpedLength) {
          outChannel[idx] = stretched[j] ?? 0;
        }
      }
    }
  }

  return outBuffer;
}
