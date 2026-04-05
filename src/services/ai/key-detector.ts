export interface KeyResult {
  key: string;
  scale: 'major' | 'minor';
  confidence: number;
  fullName: string;
  camelotCode: string;
  allKeys: Array<{ key: string; scale: 'major' | 'minor'; correlation: number }>;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const DISPLAY_NAMES: Record<string, string> = {
  'C': 'C', 'C#': 'Db', 'D': 'D', 'D#': 'Eb', 'E': 'E', 'F': 'F',
  'F#': 'F#', 'G': 'G', 'G#': 'Ab', 'A': 'A', 'A#': 'Bb', 'B': 'B',
};

// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const CAMELOT_MAJOR: Record<string, string> = {
  'C': '8B', 'C#': '3B', 'D': '10B', 'D#': '5B', 'E': '12B', 'F': '7B',
  'F#': '2B', 'G': '9B', 'G#': '4B', 'A': '11B', 'A#': '6B', 'B': '1B',
};

const CAMELOT_MINOR: Record<string, string> = {
  'C': '5A', 'C#': '12A', 'D': '7A', 'D#': '2A', 'E': '9A', 'F': '4A',
  'F#': '11A', 'G': '6A', 'G#': '1A', 'A': '8A', 'A#': '3A', 'B': '10A',
};

export function detectKey(buffer: AudioBuffer): KeyResult {
  const chromagram = computeChromagram(buffer);
  return detectKeyFromChromagram(chromagram);
}

export function detectKeyFromChromagram(chromagram: number[]): KeyResult {
  const allKeys: Array<{ key: string; scale: 'major' | 'minor'; correlation: number }> = [];

  for (let i = 0; i < 12; i++) {
    const noteName = NOTE_NAMES[i]!;
    const majorRotated = rotateProfile(MAJOR_PROFILE, i);
    const minorRotated = rotateProfile(MINOR_PROFILE, i);

    allKeys.push({
      key: noteName,
      scale: 'major',
      correlation: pearsonCorrelation(chromagram, majorRotated),
    });
    allKeys.push({
      key: noteName,
      scale: 'minor',
      correlation: pearsonCorrelation(chromagram, minorRotated),
    });
  }

  allKeys.sort((a, b) => b.correlation - a.correlation);

  const best = allKeys[0]!;
  const displayKey = DISPLAY_NAMES[best.key] ?? best.key;
  const scaleName = best.scale === 'major' ? 'Major' : 'Minor';
  const camelotMap = best.scale === 'major' ? CAMELOT_MAJOR : CAMELOT_MINOR;
  const camelotCode = camelotMap[best.key] ?? '';

  // Confidence: difference between best and second-best correlation
  const second = allKeys[1]!;
  const confidence = Math.min(1, Math.max(0, (best.correlation - second.correlation) * 3));

  return {
    key: displayKey,
    scale: best.scale,
    confidence,
    fullName: `${displayKey} ${scaleName}`,
    camelotCode,
    allKeys,
  };
}

export function computeChromagram(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const fftSize = 4096;
  const hopSize = 2048;
  const chromagram = new Float64Array(12);

  const minFreq = 60;
  const maxFreq = 4000;
  const minBin = Math.ceil(minFreq * fftSize / sampleRate);
  const maxBin = Math.floor(maxFreq * fftSize / sampleRate);

  // Precompute Hanning window
  const window = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / fftSize);
  }

  // Precompute bin-to-pitch-class mapping
  // C0 ~ 16.3516 Hz; 12 * log2(freq / C0) gives semitones from C0, mod 12 = pitch class
  const binPitchClass = new Int8Array(maxBin + 1);
  binPitchClass.fill(-1);
  for (let bin = minBin; bin <= maxBin; bin++) {
    const freq = (bin * sampleRate) / fftSize;
    if (freq > 0) {
      const midiNote = 12 * Math.log2(freq / 16.3516);
      binPitchClass[bin] = Math.round(midiNote) % 12;
    }
  }

  let frameCount = 0;

  for (let offset = 0; offset + fftSize <= data.length; offset += hopSize) {
    const real = new Float64Array(fftSize);
    const imag = new Float64Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
      real[i] = (data[offset + i] ?? 0) * window[i]!;
    }

    fft(real, imag, fftSize);

    for (let bin = minBin; bin <= maxBin; bin++) {
      const pc = binPitchClass[bin] ?? -1;
      if (pc >= 0 && pc < 12) {
        const mag = Math.sqrt(real[bin]! * real[bin]! + imag[bin]! * imag[bin]!);
        chromagram[pc] = (chromagram[pc] ?? 0) + mag;
      }
    }

    frameCount++;
  }

  // Normalize
  const result = Array.from(chromagram);
  if (frameCount > 0) {
    const maxVal = Math.max(...result);
    if (maxVal > 0) {
      for (let i = 0; i < 12; i++) {
        result[i] = result[i]! / maxVal;
      }
    }
  }

  return result;
}

function rotateProfile(profile: number[], shift: number): number[] {
  const rotated: number[] = [];
  for (let i = 0; i < 12; i++) {
    rotated.push(profile[(i - shift + 12) % 12]!);
  }
  return rotated;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]!;
    sumY += y[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;
  return num / denom;
}

/**
 * In-place radix-2 Cooley-Tukey FFT.
 * Arrays must be power-of-2 length.
 */
function fft(real: Float64Array, imag: Float64Array, n: number): void {
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let tmp = real[i]!;
      real[i] = real[j]!;
      real[j] = tmp;
      tmp = imag[i]!;
      imag[i] = imag[j]!;
      imag[j] = tmp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly stages
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angleStep = -2 * Math.PI / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < halfSize; k++) {
        const angle = angleStep * k;
        const twiddleRe = Math.cos(angle);
        const twiddleIm = Math.sin(angle);
        const evenIdx = i + k;
        const oddIdx = i + k + halfSize;
        const tRe = twiddleRe * real[oddIdx]! - twiddleIm * imag[oddIdx]!;
        const tIm = twiddleRe * imag[oddIdx]! + twiddleIm * real[oddIdx]!;
        real[oddIdx] = real[evenIdx]! - tRe;
        imag[oddIdx] = imag[evenIdx]! - tIm;
        real[evenIdx] = real[evenIdx]! + tRe;
        imag[evenIdx] = imag[evenIdx]! + tIm;
      }
    }
  }
}
