export interface BpmResult {
  bpm: number;
  confidence: number;
}

/**
 * Async version of detectBpm that yields to the main thread during onset detection.
 */
export async function detectBpmAsync(buffer: AudioBuffer): Promise<BpmResult> {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  const onsets = await detectOnsetsAsync(data, sampleRate);

  if (onsets.length < 4) {
    return { bpm: 120, confidence: 0 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i]! - onsets[i - 1]!);
  }

  const histogram = new Map<number, number>();
  for (const interval of intervals) {
    const bpm = 60 / interval;
    if (bpm >= 60 && bpm <= 200) {
      const quantized = Math.round(bpm);
      histogram.set(quantized, (histogram.get(quantized) ?? 0) + 1);
    }
  }

  let bestBpm = 120;
  let bestCount = 0;
  for (const [bpm, count] of histogram) {
    if (count > bestCount) {
      bestBpm = bpm;
      bestCount = count;
    }
  }

  return { bpm: bestBpm, confidence: Math.min(1, bestCount / intervals.length) };
}

export function detectBpm(buffer: AudioBuffer): BpmResult {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  const onsets = detectOnsets(data, sampleRate);

  if (onsets.length < 4) {
    return { bpm: 120, confidence: 0 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i]! - onsets[i - 1]!);
  }

  const histogram = new Map<number, number>();
  for (const interval of intervals) {
    const bpm = 60 / interval;
    if (bpm >= 60 && bpm <= 200) {
      const quantized = Math.round(bpm);
      histogram.set(quantized, (histogram.get(quantized) ?? 0) + 1);
    }
  }

  let bestBpm = 120;
  let bestCount = 0;
  for (const [bpm, count] of histogram) {
    if (count > bestCount) {
      bestBpm = bpm;
      bestCount = count;
    }
  }

  const confidence = Math.min(1, bestCount / intervals.length);

  return { bpm: bestBpm, confidence };
}

export function detectBeats(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  return detectOnsets(data, buffer.sampleRate);
}

async function detectOnsetsAsync(data: Float32Array, sampleRate: number): Promise<number[]> {
  const maxSamples = Math.min(data.length, sampleRate * 10);
  const windowSize = Math.floor(sampleRate * 0.01);
  const hopSize = Math.floor(windowSize / 2);
  const energies: number[] = [];
  const YIELD_EVERY = 500;

  for (let i = 0; i < maxSamples - windowSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += data[i + j]! * data[i + j]!;
    }
    energies.push(energy / windowSize);

    if (energies.length % YIELD_EVERY === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  const onsets: number[] = [];
  const lookback = 10;
  const threshold = 1.5;
  const minIntervalSamples = Math.floor(sampleRate * 0.1 / hopSize);
  let lastOnset = -minIntervalSamples;

  for (let i = lookback; i < energies.length; i++) {
    let avgEnergy = 0;
    for (let j = i - lookback; j < i; j++) {
      avgEnergy += energies[j]!;
    }
    avgEnergy /= lookback;

    if (energies[i]! > avgEnergy * threshold && i - lastOnset >= minIntervalSamples) {
      onsets.push((i * hopSize) / sampleRate);
      lastOnset = i;
    }
  }

  return onsets;
}

function detectOnsets(data: Float32Array, sampleRate: number): number[] {
  // Cap analysis to first 30 seconds — sufficient for BPM detection
  const maxSamples = Math.min(data.length, sampleRate * 30);
  const windowSize = Math.floor(sampleRate * 0.01);
  const hopSize = Math.floor(windowSize / 2);
  const energies: number[] = [];

  for (let i = 0; i < maxSamples - windowSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += data[i + j]! * data[i + j]!;
    }
    energies.push(energy / windowSize);
  }

  const onsets: number[] = [];
  const lookback = 10;
  const threshold = 1.5;
  const minIntervalSamples = Math.floor(sampleRate * 0.1 / hopSize);

  let lastOnset = -minIntervalSamples;

  for (let i = lookback; i < energies.length; i++) {
    let avgEnergy = 0;
    for (let j = i - lookback; j < i; j++) {
      avgEnergy += energies[j]!;
    }
    avgEnergy /= lookback;

    if (
      energies[i]! > avgEnergy * threshold &&
      i - lastOnset >= minIntervalSamples
    ) {
      onsets.push((i * hopSize) / sampleRate);
      lastOnset = i;
    }
  }

  return onsets;
}

export function detectTransients(buffer: AudioBuffer): number[] {
  return detectOnsets(buffer.getChannelData(0), buffer.sampleRate);
}
