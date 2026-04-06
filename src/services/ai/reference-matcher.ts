/**
 * Reference Matcher — compares your mix to a reference track,
 * generates explainable deltas with specific suggestions.
 */

import type { AudioSection } from '@/types/ai';
import type {
  ReferenceMatchResult,
  ReferenceDelta,
  EnrichedReferenceResult,
  SectionReferenceComparison,
} from '@/types/session-scan';
import { sliceBuffer } from './analysis-engine';

interface SpectralSnapshot {
  rms: number;
  peak: number;
  spectral: number[];
  dynamicRange: number;
  stereoWidth: number;
}

/**
 * Analyze audio buffer for reference comparison.
 */
function analyzeBuffer(buffer: AudioBuffer): SpectralSnapshot {
  const data = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : data;
  const length = data.length;

  // RMS & Peak
  let sumSq = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const v = Math.abs(data[i]!);
    sumSq += data[i]! * data[i]!;
    if (v > peak) peak = v;
  }
  const rms = Math.sqrt(sumSq / length);

  // Dynamic range (approximate from short-term RMS)
  const frameSize = 4096;
  let minRms = Infinity;
  let maxRms = 0;
  for (let i = 0; i < length - frameSize; i += frameSize) {
    let frameSum = 0;
    for (let j = 0; j < frameSize; j++) {
      frameSum += data[i + j]! * data[i + j]!;
    }
    const frameRms = Math.sqrt(frameSum / frameSize);
    if (frameRms > 0.001) {
      minRms = Math.min(minRms, frameRms);
      maxRms = Math.max(maxRms, frameRms);
    }
  }
  const dynamicRange = maxRms > 0 && minRms > 0
    ? 20 * Math.log10(maxRms / minRms)
    : 0;

  // Spectral balance (5 bands via DFT)
  const fftSize = 4096;
  const spectral = [0, 0, 0, 0, 0]; // sub, low, mid, high-mid, high
  const bandEdges = [60, 250, 2000, 6000, 20000];
  let frames = 0;

  for (let offset = 0; offset < length - fftSize; offset += fftSize * 2) {
    const re = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      re[i] = data[offset + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    for (let k = 1; k < fftSize / 2; k++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        sumRe += re[n]! * Math.cos(angle);
        sumIm -= re[n]! * Math.sin(angle);
      }
      const mag = Math.sqrt(sumRe * sumRe + sumIm * sumIm);
      const freq = (k * buffer.sampleRate) / fftSize;

      if (freq < bandEdges[0]!) spectral[0] = (spectral[0] ?? 0) + mag;
      else if (freq < bandEdges[1]!) spectral[1] = (spectral[1] ?? 0) + mag;
      else if (freq < bandEdges[2]!) spectral[2] = (spectral[2] ?? 0) + mag;
      else if (freq < bandEdges[3]!) spectral[3] = (spectral[3] ?? 0) + mag;
      else spectral[4] = (spectral[4] ?? 0) + mag;
    }
    frames++;
  }

  if (frames > 0) {
    for (let i = 0; i < 5; i++) spectral[i] = (spectral[i] ?? 0) / frames;
  }

  // Stereo width (correlation-based)
  let stereoWidth = 0;
  if (buffer.numberOfChannels > 1) {
    let sumLR = 0;
    let sumL2 = 0;
    let sumR2 = 0;
    for (let i = 0; i < length; i++) {
      sumLR += data[i]! * right[i]!;
      sumL2 += data[i]! * data[i]!;
      sumR2 += right[i]! * right[i]!;
    }
    const corr = sumLR / Math.sqrt(sumL2 * sumR2 || 1);
    stereoWidth = 1 - corr; // 0 = mono, 1 = wide
  }

  return {
    rms: 20 * Math.log10(Math.max(rms, 1e-10)),
    peak: 20 * Math.log10(Math.max(peak, 1e-10)),
    spectral,
    dynamicRange,
    stereoWidth,
  };
}

function severity(delta: number, thresholds: [number, number]): 'low' | 'medium' | 'high' {
  const abs = Math.abs(delta);
  if (abs > thresholds[1]) return 'high';
  if (abs > thresholds[0]) return 'medium';
  return 'low';
}

/**
 * Compare mix buffer to reference buffer and generate explainable deltas.
 */
export function matchReference(
  mixBuffer: AudioBuffer,
  referenceBuffer: AudioBuffer,
): ReferenceMatchResult {
  const mix = analyzeBuffer(mixBuffer);
  const ref = analyzeBuffer(referenceBuffer);

  const deltas: ReferenceDelta[] = [];

  // Loudness comparison
  const rmsDelta = mix.rms - ref.rms;
  deltas.push({
    parameter: 'Overall Loudness (RMS)',
    category: 'loudness',
    current: Math.round(mix.rms * 10) / 10,
    reference: Math.round(ref.rms * 10) / 10,
    delta: Math.round(rmsDelta * 10) / 10,
    unit: 'dB',
    severity: severity(rmsDelta, [2, 4]),
    suggestion: rmsDelta > 2
      ? 'Your mix is louder — consider reducing the master level'
      : rmsDelta < -2
        ? 'Your mix is quieter — consider increasing overall gain or reducing dynamics'
        : 'Loudness is well-matched',
  });

  // Peak headroom
  const peakDelta = mix.peak - ref.peak;
  deltas.push({
    parameter: 'Peak Level',
    category: 'loudness',
    current: Math.round(mix.peak * 10) / 10,
    reference: Math.round(ref.peak * 10) / 10,
    delta: Math.round(peakDelta * 10) / 10,
    unit: 'dBFS',
    severity: severity(peakDelta, [1.5, 3]),
    suggestion: mix.peak > -1
      ? 'Peaks are very close to 0 dBFS — add a limiter or reduce gain'
      : 'Peak levels are within range',
  });

  // Dynamic range
  const drDelta = mix.dynamicRange - ref.dynamicRange;
  deltas.push({
    parameter: 'Dynamic Range',
    category: 'dynamics',
    current: Math.round(mix.dynamicRange * 10) / 10,
    reference: Math.round(ref.dynamicRange * 10) / 10,
    delta: Math.round(drDelta * 10) / 10,
    unit: 'dB',
    severity: severity(drDelta, [3, 6]),
    suggestion: drDelta > 3
      ? 'Mix has more dynamic range — apply gentle bus compression to tighten'
      : drDelta < -3
        ? 'Mix is more compressed — consider easing compression for more life'
        : 'Dynamics are comparable',
  });

  // Stereo width
  const swDelta = mix.stereoWidth - ref.stereoWidth;
  deltas.push({
    parameter: 'Stereo Width',
    category: 'stereo',
    current: Math.round(mix.stereoWidth * 100),
    reference: Math.round(ref.stereoWidth * 100),
    delta: Math.round(swDelta * 100),
    unit: '%',
    severity: severity(swDelta, [0.1, 0.25]),
    suggestion: swDelta > 0.15
      ? 'Mix is wider — may lose mono compatibility; check with a stereo imager'
      : swDelta < -0.15
        ? 'Mix is narrower — try widening reverbs/delays or panning instruments further'
        : 'Stereo image is similar',
  });

  // Spectral balance per band
  const bandNames = ['Sub (<60Hz)', 'Low (60–250Hz)', 'Mid (250Hz–2kHz)', 'Hi-Mid (2–6kHz)', 'High (6kHz+)'];
  for (let i = 0; i < 5; i++) {
    const mixBand = mix.spectral[i] ?? 0;
    const refBand = ref.spectral[i] ?? 0;
    const refNonZero = refBand > 0 ? refBand : 1;
    const ratio = mixBand / refNonZero;
    const bandDeltaDb = 20 * Math.log10(Math.max(ratio, 1e-10));

    deltas.push({
      parameter: bandNames[i]!,
      category: 'spectral',
      current: Math.round(bandDeltaDb * 10) / 10,
      reference: 0,
      delta: Math.round(bandDeltaDb * 10) / 10,
      unit: 'dB (relative)',
      severity: severity(bandDeltaDb, [2, 5]),
      suggestion: bandDeltaDb > 3
        ? `${bandNames[i]} is boosted — consider cutting with EQ`
        : bandDeltaDb < -3
          ? `${bandNames[i]} is lacking — consider boosting or adding elements in this range`
          : `${bandNames[i]} is well-matched`,
    });
  }

  // Overall similarity (inverse of total weighted delta)
  const totalDelta = deltas.reduce(
    (sum, d) => sum + Math.abs(d.delta) * (d.category === 'loudness' ? 2 : 1),
    0,
  );
  const overallSimilarity = Math.max(0, Math.min(100, 100 - totalDelta * 2));

  return {
    deltas,
    overallSimilarity: Math.round(overallSimilarity),
    referenceAnalysis: { rms: ref.rms, peak: ref.peak, spectral: ref.spectral },
    mixAnalysis: { rms: mix.rms, peak: mix.peak, spectral: mix.spectral },
  };
}

/**
 * Compare mix buffer to reference buffer on a per-section basis.
 * Sections are mapped proportionally when durations differ.
 */
export function matchReferencePerSection(
  mixBuffer: AudioBuffer,
  referenceBuffer: AudioBuffer,
  sections: AudioSection[],
): EnrichedReferenceResult {
  // Full-song comparison first
  const fullResult = matchReference(mixBuffer, referenceBuffer);

  if (sections.length === 0) {
    return { ...fullResult, sections: [], perSectionSimilarity: [] };
  }

  const mixDuration = mixBuffer.length / mixBuffer.sampleRate;
  const refDuration = referenceBuffer.length / referenceBuffer.sampleRate;
  const timeRatio = refDuration / mixDuration;

  const sectionComparisons: SectionReferenceComparison[] = [];
  const perSectionSimilarity: number[] = [];

  for (const section of sections) {
    const mixSlice = sliceBuffer(mixBuffer, section.start, section.end);

    // Map section times proportionally to reference
    const refStart = section.start * timeRatio;
    const refEnd = Math.min(section.end * timeRatio, refDuration);
    const refSlice = sliceBuffer(referenceBuffer, refStart, refEnd);

    const mixSnap = analyzeBuffer(mixSlice);
    const refSnap = analyzeBuffer(refSlice);

    // Build section-level deltas
    const deltas: ReferenceDelta[] = [];

    // RMS
    const rmsDelta = mixSnap.rms - refSnap.rms;
    deltas.push({
      parameter: 'Loudness (RMS)',
      category: 'loudness',
      current: Math.round(mixSnap.rms * 10) / 10,
      reference: Math.round(refSnap.rms * 10) / 10,
      delta: Math.round(rmsDelta * 10) / 10,
      unit: 'dB',
      severity: severity(rmsDelta, [2, 4]),
      suggestion: rmsDelta > 2
        ? 'Section is louder than reference'
        : rmsDelta < -2
          ? 'Section is quieter than reference'
          : 'Loudness matched',
    });

    // Dynamic range
    const drDelta = mixSnap.dynamicRange - refSnap.dynamicRange;
    deltas.push({
      parameter: 'Dynamic Range',
      category: 'dynamics',
      current: Math.round(mixSnap.dynamicRange * 10) / 10,
      reference: Math.round(refSnap.dynamicRange * 10) / 10,
      delta: Math.round(drDelta * 10) / 10,
      unit: 'dB',
      severity: severity(drDelta, [3, 6]),
      suggestion: drDelta > 3
        ? 'More dynamic — consider compression'
        : drDelta < -3
          ? 'More compressed — ease compression'
          : 'Dynamics comparable',
    });

    // Stereo width
    const swDelta = mixSnap.stereoWidth - refSnap.stereoWidth;
    deltas.push({
      parameter: 'Stereo Width',
      category: 'stereo',
      current: Math.round(mixSnap.stereoWidth * 100),
      reference: Math.round(refSnap.stereoWidth * 100),
      delta: Math.round(swDelta * 100),
      unit: '%',
      severity: severity(swDelta, [0.1, 0.25]),
      suggestion: swDelta > 0.15
        ? 'Wider than reference'
        : swDelta < -0.15
          ? 'Narrower than reference'
          : 'Similar width',
    });

    // Spectral bands
    const bandNames = ['Sub', 'Low', 'Mid', 'Hi-Mid', 'High'];
    for (let i = 0; i < 5; i++) {
      const mixBand = mixSnap.spectral[i] ?? 0;
      const refBand = refSnap.spectral[i] ?? 0;
      const ratio = mixBand / (refBand > 0 ? refBand : 1);
      const bandDelta = 20 * Math.log10(Math.max(ratio, 1e-10));
      deltas.push({
        parameter: bandNames[i]!,
        category: 'spectral',
        current: Math.round(bandDelta * 10) / 10,
        reference: 0,
        delta: Math.round(bandDelta * 10) / 10,
        unit: 'dB',
        severity: severity(bandDelta, [2, 5]),
        suggestion: bandDelta > 3
          ? `${bandNames[i]} boosted`
          : bandDelta < -3
            ? `${bandNames[i]} lacking`
            : `${bandNames[i]} matched`,
      });
    }

    const totalDelta = deltas.reduce(
      (s, d) => s + Math.abs(d.delta) * (d.category === 'loudness' ? 2 : 1),
      0,
    );
    const sim = Math.max(0, Math.min(100, Math.round(100 - totalDelta * 2)));

    sectionComparisons.push({
      sectionLabel: section.label,
      sectionStart: section.start,
      sectionEnd: section.end,
      deltas,
      similarity: sim,
    });
    perSectionSimilarity.push(sim);
  }

  return {
    ...fullResult,
    sections: sectionComparisons,
    perSectionSimilarity,
  };
}
