/**
 * Arrangement Map Panel — shows suggested song structure,
 * energy curves, and section layout for the current genre.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { generateArrangementMap } from '@/services/ai/arrangement-mapper';
import type { ArrangementMap, ArrangementSuggestion } from '@/types/session-scan';

const SECTION_COLORS: Record<string, string> = {
  intro: '#53c0f0',
  verse: '#4ade80',
  'pre-chorus': '#facc15',
  chorus: '#E63946',
  bridge: '#a78bfa',
  breakdown: '#818cf8',
  drop: '#f87171',
  outro: '#6b7280',
  interlude: '#2dd4bf',
  build: '#fb923c',
};

export default function ArrangementMapPanel() {
  const genre = useSessionStore((s) => s.config.genre);
  const [map, setMap] = useState<ArrangementMap | null>(null);

  const handleGenerate = () => {
    const result = generateArrangementMap(genre);
    setMap(result);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleGenerate}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-[#E63946]/20 text-[#E63946] hover:bg-[#E63946]/30 transition-all"
      >
        Generate Arrangement
      </button>

      {map && (
        <div className="space-y-2">
          <div className="text-[8px] text-daw-text-muted">
            {map.totalBars} bars · {map.genre}
          </div>

          {/* Section timeline */}
          <div className="flex gap-px h-6 bg-daw-bg/40">
            {map.suggestions.map((s, i) => (
              <div
                key={i}
                className="relative overflow-hidden"
                style={{
                  flex: s.lengthBars,
                  backgroundColor: `${SECTION_COLORS[s.sectionType] ?? '#6b7280'}30`,
                  borderBottom: `2px solid ${SECTION_COLORS[s.sectionType] ?? '#6b7280'}`,
                }}
                title={`${s.sectionType}: ${s.lengthBars} bars — ${s.description}`}
              >
                <span className="text-[7px] text-daw-text-dim absolute inset-0 flex items-center justify-center truncate px-0.5">
                  {s.sectionType}
                </span>
              </div>
            ))}
          </div>

          {/* Energy curve */}
          <div className="bg-daw-bg/40 p-1">
            <div className="text-[7px] text-daw-text-muted mb-0.5">Energy</div>
            <div className="flex items-end gap-px h-6">
              {map.energyCurve.map((e, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{
                    height: `${e * 100}%`,
                    backgroundColor: e > 0.8 ? '#E63946' : e > 0.5 ? '#fb923c' : '#4ade80',
                    opacity: 0.6,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Section list */}
          <div className="space-y-0.5">
            {map.suggestions.map((s, i) => (
              <SectionRow key={i} section={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionRow({ section }: { section: ArrangementSuggestion }) {
  const color = SECTION_COLORS[section.sectionType] ?? '#6b7280';
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-2 h-2 shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-daw-text-dim font-mono w-16">{section.sectionType}</span>
      <span className="text-[8px] text-daw-text-muted">
        Bar {section.startBar} · {section.lengthBars}b
      </span>
      <div className="flex-1" />
      <div className="w-8 h-1.5 bg-daw-bg/60 overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${section.energy * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
