/**
 * Arrangement Mapper — suggests song structure (intro/verse/chorus/etc.),
 * energy curves, and section transitions based on genre and analysis.
 */

import type { MixGenre, AudioSection } from '@/types/ai';
import type {
  ArrangementMap,
  ArrangementSuggestion,
  ArrangementSectionType,
} from '@/types/session-scan';

// Genre-specific arrangement templates (bars)
const ARRANGEMENT_TEMPLATES: Record<
  MixGenre,
  Array<{ type: ArrangementSectionType; bars: number; energy: number }>
> = {
  pop: [
    { type: 'intro', bars: 4, energy: 0.3 },
    { type: 'verse', bars: 8, energy: 0.5 },
    { type: 'pre-chorus', bars: 4, energy: 0.65 },
    { type: 'chorus', bars: 8, energy: 0.9 },
    { type: 'verse', bars: 8, energy: 0.55 },
    { type: 'pre-chorus', bars: 4, energy: 0.7 },
    { type: 'chorus', bars: 8, energy: 0.95 },
    { type: 'bridge', bars: 8, energy: 0.4 },
    { type: 'chorus', bars: 8, energy: 1.0 },
    { type: 'outro', bars: 4, energy: 0.2 },
  ],
  edm: [
    { type: 'intro', bars: 8, energy: 0.3 },
    { type: 'build', bars: 8, energy: 0.6 },
    { type: 'drop', bars: 16, energy: 1.0 },
    { type: 'breakdown', bars: 8, energy: 0.25 },
    { type: 'build', bars: 8, energy: 0.7 },
    { type: 'drop', bars: 16, energy: 1.0 },
    { type: 'outro', bars: 8, energy: 0.15 },
  ],
  rock: [
    { type: 'intro', bars: 4, energy: 0.5 },
    { type: 'verse', bars: 8, energy: 0.6 },
    { type: 'chorus', bars: 8, energy: 0.9 },
    { type: 'verse', bars: 8, energy: 0.6 },
    { type: 'chorus', bars: 8, energy: 0.95 },
    { type: 'bridge', bars: 8, energy: 0.5 },
    { type: 'chorus', bars: 8, energy: 1.0 },
    { type: 'outro', bars: 4, energy: 0.3 },
  ],
  'hip-hop': [
    { type: 'intro', bars: 4, energy: 0.4 },
    { type: 'verse', bars: 16, energy: 0.7 },
    { type: 'chorus', bars: 8, energy: 0.9 },
    { type: 'verse', bars: 16, energy: 0.7 },
    { type: 'chorus', bars: 8, energy: 0.9 },
    { type: 'bridge', bars: 8, energy: 0.5 },
    { type: 'chorus', bars: 8, energy: 0.95 },
    { type: 'outro', bars: 4, energy: 0.2 },
  ],
  jazz: [
    { type: 'intro', bars: 4, energy: 0.3 },
    { type: 'verse', bars: 16, energy: 0.5 },
    { type: 'interlude', bars: 8, energy: 0.6 },
    { type: 'verse', bars: 16, energy: 0.55 },
    { type: 'bridge', bars: 8, energy: 0.7 },
    { type: 'outro', bars: 4, energy: 0.2 },
  ],
  classical: [
    { type: 'intro', bars: 8, energy: 0.2 },
    { type: 'verse', bars: 16, energy: 0.5 },
    { type: 'bridge', bars: 8, energy: 0.7 },
    { type: 'verse', bars: 16, energy: 0.6 },
    { type: 'build', bars: 8, energy: 0.85 },
    { type: 'chorus', bars: 8, energy: 1.0 },
    { type: 'outro', bars: 8, energy: 0.15 },
  ],
  general: [
    { type: 'intro', bars: 4, energy: 0.3 },
    { type: 'verse', bars: 8, energy: 0.6 },
    { type: 'chorus', bars: 8, energy: 0.9 },
    { type: 'verse', bars: 8, energy: 0.6 },
    { type: 'chorus', bars: 8, energy: 0.95 },
    { type: 'outro', bars: 4, energy: 0.2 },
  ],
};

const SECTION_DESCRIPTIONS: Record<ArrangementSectionType, string> = {
  intro: 'Set the mood — gradually introduce elements',
  verse: 'Establish the narrative — rhythmic and melodic foundation',
  'pre-chorus': 'Build tension — transition from verse to chorus',
  chorus: 'Peak energy — main hook and melodic payoff',
  bridge: 'Contrast — break from repetition, new harmonic territory',
  breakdown: 'Strip back — reduce elements for contrast',
  drop: 'Maximum impact — full energy release',
  outro: 'Resolve and fade — bring the track to close',
  interlude: 'Instrumental passage — space between sections',
  build: 'Rising energy — escalate toward the next peak',
};

/**
 * Generate an arrangement suggestion map for a given genre.
 */
export function generateArrangementMap(
  genre: MixGenre,
  existingSections?: AudioSection[],
): ArrangementMap {
  const template = ARRANGEMENT_TEMPLATES[genre] ?? ARRANGEMENT_TEMPLATES.general;

  let currentBar = 0;
  const suggestions: ArrangementSuggestion[] = template.map((section) => {
    const suggestion: ArrangementSuggestion = {
      sectionType: section.type,
      startBar: currentBar,
      lengthBars: section.bars,
      energy: section.energy,
      description: SECTION_DESCRIPTIONS[section.type],
    };
    currentBar += section.bars;
    return suggestion;
  });

  // If existing sections are detected, try to align suggestions
  if (existingSections && existingSections.length > 0) {
    // Adjust total length to match existing content
    const existingBars = existingSections.reduce(
      (sum, s) => Math.max(sum, s.end),
      0,
    );
    const templateBars = currentBar;
    if (existingBars > 0 && templateBars > 0) {
      const scale = existingBars / templateBars;
      for (const s of suggestions) {
        s.startBar = Math.round(s.startBar * scale);
        s.lengthBars = Math.max(2, Math.round(s.lengthBars * scale));
      }
    }
  }

  const totalBars = suggestions.reduce(
    (sum, s) => Math.max(sum, s.startBar + s.lengthBars),
    0,
  );

  // Generate smooth energy curve
  const energyCurve: number[] = [];
  for (let bar = 0; bar < totalBars; bar++) {
    const section = suggestions.find(
      (s) => bar >= s.startBar && bar < s.startBar + s.lengthBars,
    );
    energyCurve.push(section?.energy ?? 0);
  }

  return { suggestions, totalBars, genre, energyCurve };
}

/**
 * Get available section types for manual editing.
 */
export function getAvailableSectionTypes(): ArrangementSectionType[] {
  return Object.keys(SECTION_DESCRIPTIONS) as ArrangementSectionType[];
}
