export interface BpmResult {
  bpm: number;
  confidence: number;
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

function detectOnsets(data: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.01);
  const hopSize = Math.floor(windowSize / 2);
  const energies: number[] = [];

  for (let i = 0; i < data.length - windowSize; i += hopSize) {
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
