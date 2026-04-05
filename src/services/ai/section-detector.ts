/**
 * Section Detector — identifies song structure from audio analysis.
 *
 * Uses energy envelope from region analysis to heuristically label
 * sections: intro, verse, chorus, bridge, buildup, drop, outro.
 */

import { analyzeTrackRegions } from './analysis-engine';
import { isAudioClip } from '@/types/audio';
import type { Track } from '@/types/audio';
import type { AudioSection } from '@/types/ai';
import type { RegionAnalysis } from '@/types/ai';

const REGION_SIZE = 5; // seconds per analysis chunk

function normalizeEnergy(regions: RegionAnalysis[]): number[] {
  if (regions.length === 0) return [];
  const rmsValues = regions.map((r) => r.level.rms);
  const min = Math.min(...rmsValues);
  const max = Math.max(...rmsValues);
  const range = max - min;
  if (range < 0.001) return rmsValues.map(() => 0.5);
  return rmsValues.map((v) => (v - min) / range);
}

function labelByEnergy(
  energy: number,
  index: number,
  total: number,
  prevEnergy: number,
  _nextEnergy: number,
): { label: string; characteristics: string[] } {
  const position = index / Math.max(1, total - 1);
  const rising = energy - prevEnergy > 0.15;
  const falling = prevEnergy - energy > 0.15;

  // First 10% of track with low energy → intro
  if (position < 0.1 && energy < 0.35) {
    return { label: 'intro', characteristics: ['low-energy', 'opening'] };
  }

  // Last 10% of track with falling/low energy → outro
  if (position > 0.9 && energy < 0.4) {
    return { label: 'outro', characteristics: ['low-energy', 'closing'] };
  }

  // High energy sustained → chorus or drop
  if (energy > 0.7) {
    if (rising) {
      return { label: 'drop', characteristics: ['high-energy', 'impact'] };
    }
    return { label: 'chorus', characteristics: ['high-energy', 'sustained'] };
  }

  // Rising energy → buildup
  if (rising && energy > 0.4) {
    return { label: 'buildup', characteristics: ['rising-energy', 'building'] };
  }

  // Dip after high energy → bridge
  if (falling && energy < 0.5 && prevEnergy > 0.6) {
    return { label: 'bridge', characteristics: ['mid-energy', 'contrast'] };
  }

  // Default mid-energy → verse
  if (energy < 0.5) {
    return { label: 'verse', characteristics: ['mid-energy', 'steady'] };
  }

  return { label: 'verse', characteristics: ['mid-energy'] };
}

function mergeAdjacentSections(sections: AudioSection[]): AudioSection[] {
  if (sections.length <= 1) return sections;

  const merged: AudioSection[] = [sections[0]!];
  for (let i = 1; i < sections.length; i++) {
    const prev = merged[merged.length - 1]!;
    const curr = sections[i]!;
    if (prev.label === curr.label) {
      // Merge: extend end, average energy, combine characteristics
      prev.end = curr.end;
      prev.energy = (prev.energy + curr.energy) / 2;
      const chars = new Set([...prev.characteristics, ...curr.characteristics]);
      prev.characteristics = [...chars];
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

export function detectSections(tracks: Track[], sampleRate: number): AudioSection[] {
  // Find the longest audio clip to use as the primary analysis source
  let bestBuffer: AudioBuffer | null = null;
  let bestDuration = 0;

  for (const track of tracks) {
    if (track.mute) continue;
    for (const clip of track.clips) {
      if (isAudioClip(clip) && clip.duration > bestDuration) {
        bestBuffer = clip.buffer;
        bestDuration = clip.duration;
      }
    }
  }

  if (!bestBuffer || bestDuration < 5) {
    // Too short for section detection — return single section
    return bestDuration > 0
      ? [{ label: 'full', start: 0, end: bestDuration, energy: 0.5, characteristics: ['short'] }]
      : [];
  }

  const regions = analyzeTrackRegions('analysis', bestBuffer, sampleRate, REGION_SIZE);
  if (regions.length === 0) return [];

  const energies = normalizeEnergy(regions);
  const rawSections: AudioSection[] = [];

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]!;
    const energy = energies[i]!;
    const prev = i > 0 ? energies[i - 1]! : energy;
    const next = i < energies.length - 1 ? energies[i + 1]! : energy;

    const { label, characteristics } = labelByEnergy(energy, i, regions.length, prev, next);

    rawSections.push({
      label,
      start: region.region.start,
      end: region.region.end,
      energy,
      characteristics,
    });
  }

  return mergeAdjacentSections(rawSections);
}
