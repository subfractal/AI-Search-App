import { detectKey } from './key-detector';
import { detectBpm } from './beat-detector';
import type { KeyResult } from './key-detector';
import type { BpmResult } from './beat-detector';

export interface AutoAnalysisResult {
  bpm: BpmResult | null;
  key: KeyResult | null;
}

export async function autoAnalyzeClip(
  buffer: AudioBuffer,
): Promise<AutoAnalysisResult> {
  let bpm: BpmResult | null = null;
  let key: KeyResult | null = null;

  try {
    bpm = detectBpm(buffer);
  } catch {
    bpm = null;
  }

  try {
    key = detectKey(buffer);
  } catch {
    key = null;
  }

  return { bpm, key };
}
