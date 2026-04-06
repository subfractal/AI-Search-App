/**
 * Skill Detector — infers user skill level from behavior patterns
 * and determines feature visibility.
 */

import type { SkillLevel } from '@/stores/ui-context-store';

// Features and their minimum skill level to be visible
const FEATURE_GATES: Record<string, SkillLevel> = {
  // Always visible (beginner)
  volume: 'beginner',
  pan: 'beginner',
  mute: 'beginner',
  solo: 'beginner',
  transport: 'beginner',
  import: 'beginner',
  export: 'beginner',
  basicEffects: 'beginner',

  // Intermediate
  eq: 'intermediate',
  compressor: 'intermediate',
  automation: 'intermediate',
  composition: 'intermediate',
  variation: 'intermediate',
  pianoRoll: 'intermediate',
  warp: 'intermediate',
  instruments: 'intermediate',
  recording: 'intermediate',
  commandBar: 'intermediate',

  // Advanced
  routing: 'advanced',
  sidechain: 'advanced',
  mastering: 'advanced',
  multibandComp: 'advanced',
  spectralMatrix: 'advanced',
  reharmonize: 'advanced',
  gainStaging: 'advanced',
  phaseDetection: 'advanced',
  cpuManagement: 'advanced',
  voiceCommands: 'advanced',
};

const SKILL_ORDER: Record<SkillLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/**
 * Get all features visible at the given skill level.
 */
export function getVisibleFeatures(level: SkillLevel): Set<string> {
  const levelNum = SKILL_ORDER[level];
  const visible = new Set<string>();

  for (const [feature, minLevel] of Object.entries(FEATURE_GATES)) {
    if (SKILL_ORDER[minLevel] <= levelNum) {
      visible.add(feature);
    }
  }

  return visible;
}

/**
 * Check if a specific feature should be visible at the given skill level.
 */
export function isFeatureVisible(feature: string, level: SkillLevel): boolean {
  const minLevel = FEATURE_GATES[feature];
  if (!minLevel) return true; // Unknown features are always visible
  return SKILL_ORDER[level] >= SKILL_ORDER[minLevel];
}

/**
 * Get effect types appropriate for the skill level.
 */
export function getVisibleEffectTypes(level: SkillLevel): string[] {
  const beginner = ['reverb', 'delay', 'eq', 'compressor', 'chorus', 'distortion'];
  const intermediate = [...beginner, 'phaser', 'filter', 'gate', 'flanger', 'tremolo',
    'saturator', 'limiter'];
  const advanced = [...intermediate, 'pitchShift', 'deesser', 'multibandComp',
    'stereoImager', 'frequencyShifter', 'ringMod', 'exciter', 'utility'];

  switch (level) {
    case 'beginner': return beginner;
    case 'intermediate': return intermediate;
    case 'advanced': return advanced;
  }
}
