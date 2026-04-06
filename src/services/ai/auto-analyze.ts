import { detectKeyAsync } from './key-detector';
import { detectBpmAsync } from './beat-detector';
import { importProgress } from '@/stores/import-progress-store';
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

  importProgress.update('analyzing-bpm', 50);
  await new Promise<void>((r) => setTimeout(r, 0));

  try {
    bpm = await detectBpmAsync(buffer);
  } catch {
    bpm = null;
  }

  importProgress.update('analyzing-key', 75);
  await new Promise<void>((r) => setTimeout(r, 0));

  try {
    key = await detectKeyAsync(buffer);
  } catch {
    key = null;
  }

  importProgress.update('done', 100);

  return { bpm, key };
}
