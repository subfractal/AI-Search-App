/**
 * AI Sample Synthesis — generates audio samples from text descriptions.
 * Scaffold: uses procedural synthesis (noise shaping + envelopes)
 * as a local placeholder. Can be extended to use external APIs.
 */

import type { MixGenre } from '@/types/ai';

export interface SynthesisRequest {
  description: string;
  genre: MixGenre;
  mood: 'bright' | 'dark' | 'neutral' | 'aggressive' | 'warm';
  lengthSeconds: number;
  brightness: number; // 0–1
  sampleRate: number;
}

export interface SynthesisResult {
  buffer: AudioBuffer;
  description: string;
  durationSeconds: number;
  method: 'procedural' | 'api';
}

/**
 * Generate a simple ADSR envelope.
 */
function makeEnvelope(
  length: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
): Float32Array {
  const env = new Float32Array(length);
  const attackEnd = Math.floor(length * attack);
  const decayEnd = attackEnd + Math.floor(length * decay);
  const releaseStart = length - Math.floor(length * release);

  for (let i = 0; i < length; i++) {
    if (i < attackEnd) {
      env[i] = i / attackEnd;
    } else if (i < decayEnd) {
      const t = (i - attackEnd) / (decayEnd - attackEnd);
      env[i] = 1 - t * (1 - sustain);
    } else if (i < releaseStart) {
      env[i] = sustain;
    } else {
      const t = (i - releaseStart) / (length - releaseStart);
      env[i] = sustain * (1 - t);
    }
  }
  return env;
}

/**
 * Simple noise-based synthesis with filtering and enveloping.
 * This is a placeholder — produces shaped noise suitable for
 * percussion, textures, and ambient sounds.
 */
export function synthesizeSample(request: SynthesisRequest): SynthesisResult {
  const { lengthSeconds, sampleRate, brightness, mood } = request;
  const length = Math.floor(lengthSeconds * sampleRate);
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  // Generate base noise
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  // Apply simple lowpass filter (brightness control)
  const cutoff = 200 + brightness * 18000; // 200Hz – 18200Hz
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  for (let i = 1; i < length; i++) {
    data[i] = data[i - 1]! + alpha * (data[i]! - data[i - 1]!);
  }

  // Mood-based adjustments
  if (mood === 'dark' || mood === 'warm') {
    // Extra lowpass
    const alpha2 = dt / (1 / (2 * Math.PI * 800) + dt);
    for (let i = 1; i < length; i++) {
      data[i] = data[i - 1]! + alpha2 * (data[i]! - data[i - 1]!);
    }
  }
  if (mood === 'aggressive') {
    // Soft clipping for grit
    for (let i = 0; i < length; i++) {
      data[i] = Math.tanh(data[i]! * 3);
    }
  }

  // Apply ADSR envelope
  const isPercussive = request.description.match(
    /kick|snare|hat|clap|perc|hit|impact|drum/i
  );
  const env = isPercussive
    ? makeEnvelope(length, 0.01, 0.15, 0.1, 0.3)
    : makeEnvelope(length, 0.1, 0.2, 0.5, 0.3);

  for (let i = 0; i < length; i++) {
    data[i] = data[i]! * env[i]!;
  }

  // Normalize to -3dBFS
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const abs = Math.abs(data[i]!);
    if (abs > peak) peak = abs;
  }
  const targetPeak = Math.pow(10, -3 / 20); // -3dBFS
  if (peak > 0) {
    const gain = targetPeak / peak;
    for (let i = 0; i < length; i++) {
      data[i] = data[i]! * gain;
    }
  }

  return {
    buffer,
    description: `Synthesized: ${request.description} (${mood}, brightness=${brightness.toFixed(1)})`,
    durationSeconds: lengthSeconds,
    method: 'procedural',
  };
}
