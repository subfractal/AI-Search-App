// Pattern types for drum machine variations, fills, and arrangement
import type { PatternVariation } from '@/types/instruments';

export type PatternRole = 'main' | 'fill' | 'intro' | 'outro' | 'breakdown' | 'buildup';

export interface PatternSlot {
  id: string;
  role: PatternRole;
  variation: PatternVariation;
  probability: number; // 0-1, chance of triggering on each cycle
  barLength: number;   // length in bars (1, 2, 4)
}

export interface PatternChain {
  id: string;
  name: string;
  slots: PatternSlot[];
  loopMode: 'cycle' | 'one-shot' | 'random';
}

export interface FillRule {
  triggerEveryNBars: number; // e.g. 4 = fill every 4 bars
  fillSlotId: string;       // which PatternSlot to use as fill
  enabled: boolean;
}

export interface DrumArrangement {
  trackId: string;
  chains: PatternChain[];
  activeChainId: string | null;
  fillRules: FillRule[];
}

export const PATTERN_ROLES: { id: PatternRole; label: string; color: string }[] = [
  { id: 'main', label: 'Main', color: 'bg-daw-accent' },
  { id: 'fill', label: 'Fill', color: 'bg-amber-500' },
  { id: 'intro', label: 'Intro', color: 'bg-emerald-500' },
  { id: 'outro', label: 'Outro', color: 'bg-rose-500' },
  { id: 'breakdown', label: 'Break', color: 'bg-violet-500' },
  { id: 'buildup', label: 'Build', color: 'bg-cyan-500' },
];
