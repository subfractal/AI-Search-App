import { detectKey } from './key-detector';
import { detectBpm } from './beat-detector';
import type { KeyResult } from './key-detector';
import type { BpmResult } from './beat-detector';

export interface AutoAnalysisResult {
  bpm: BpmResult | null;
  key: KeyResult | null;
}

// Yield to the main thread between heavy operations
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

  // Yield to let the UI breathe between expensive operations
  await yieldToMain();

  try {
    key = detectKey(buffer);
  } catch {
    key = null;
  }

  return { bpm, key };
}
