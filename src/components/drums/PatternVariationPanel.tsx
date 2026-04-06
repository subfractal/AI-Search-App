import { useState } from 'react';
import { useInstrumentStore } from '@/stores/instrument-store';
import { generateId } from '@/utils/id';
import type { PatternVariation } from '@/types/instruments';
import type { PatternRole } from '@/types/patterns';
import { PATTERN_ROLES } from '@/types/patterns';

interface PatternVariationPanelProps {
  trackId: string;
}

export default function PatternVariationPanel({ trackId }: PatternVariationPanelProps) {
  const config = useInstrumentStore((s) => s.instruments[trackId]);
  const pattern = config?.drumPattern;

  const [variations, setVariations] = useState<
    Array<PatternVariation & { role: PatternRole }>
  >([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [fillEvery, setFillEvery] = useState(4);

  if (!pattern) {
    return (
      <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
        Assign a drum machine to use pattern variations
      </div>
    );
  }

  const addVariation = (role: PatternRole) => {
    const v: PatternVariation & { role: PatternRole } = {
      id: generateId('pvar'),
      name: `${PATTERN_ROLES.find((r) => r.id === role)?.label ?? role} ${variations.filter((x) => x.role === role).length + 1}`,
      steps: pattern.sounds.map((_, si) =>
        pattern.steps[si]?.map((s) => (role === 'fill' ? Math.random() > 0.5 : s)) ??
        new Array(pattern.stepCount).fill(false),
      ),
      role,
    };
    setVariations((prev) => [...prev, v]);
  };

  const copyCurrentAsVariation = () => {
    const v: PatternVariation & { role: PatternRole } = {
      id: generateId('pvar'),
      name: `Copy ${variations.length + 1}`,
      steps: pattern.sounds.map((_, si) =>
        pattern.steps[si]?.slice() ?? new Array(pattern.stepCount).fill(false),
      ),
      role: 'main',
    };
    setVariations((prev) => [...prev, v]);
  };

  const removeVariation = (idx: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== idx));
    if (activeIdx >= variations.length - 1) setActiveIdx(Math.max(0, activeIdx - 1));
  };

  const activeVar = variations[activeIdx];

  return (
    <div className="flex flex-col gap-2 p-3 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-daw-text font-mono uppercase tracking-wider">
          Pattern Variations
        </span>
        <span className="text-xxs text-daw-text-muted tabular-nums">
          {variations.length} var{variations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Role buttons — add variation by role */}
      <div className="flex gap-1 flex-wrap">
        {PATTERN_ROLES.map((role) => (
          <button
            key={role.id}
            onClick={() => addVariation(role.id)}
            className="px-2 py-0.5 text-xxs text-daw-text bg-daw-surface
                       border border-daw-border/30 hover:border-daw-accent/50
                       transition-colors font-mono uppercase"
            title={`Add ${role.label} variation`}
          >
            + {role.label}
          </button>
        ))}
        <button
          onClick={copyCurrentAsVariation}
          className="px-2 py-0.5 text-xxs text-daw-accent bg-daw-surface
                     border border-daw-accent/30 hover:bg-daw-accent/10
                     transition-colors font-mono uppercase"
          title="Copy current pattern as variation"
        >
          Copy
        </button>
      </div>

      {/* Variation list */}
      {variations.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {variations.map((v, i) => {
            const roleInfo = PATTERN_ROLES.find((r) => r.id === v.role);
            return (
              <button
                key={v.id}
                onClick={() => setActiveIdx(i)}
                className={`flex items-center gap-1 px-2 py-1 text-xxs font-mono
                           border shrink-0 transition-colors
                           ${i === activeIdx
                ? 'border-daw-accent bg-daw-accent/10 text-daw-text'
                : 'border-daw-border/30 text-daw-text-muted hover:border-daw-border'
              }`}
              >
                <span className={`w-1.5 h-1.5 ${roleInfo?.color ?? 'bg-daw-text-muted'}`} />
                {v.name}
                <span
                  onClick={(e) => { e.stopPropagation(); removeVariation(i); }}
                  className="ml-1 text-daw-text-muted hover:text-daw-danger cursor-pointer"
                >
                  x
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active variation step grid */}
      {activeVar && (
        <div className="flex flex-col gap-px flex-1 min-h-0 overflow-y-auto">
          {pattern.sounds.map((sound, soundIdx) => (
            <div key={sound.id} className="flex items-center gap-1">
              <span className="w-14 text-xxs text-daw-text-dim text-left truncate shrink-0">
                {sound.name}
              </span>
              <div className="flex gap-px flex-1">
                {Array.from({ length: pattern.stepCount }, (_, stepIdx) => {
                  const isOn = activeVar.steps[soundIdx]?.[stepIdx] ?? false;
                  const isBarStart = stepIdx % 4 === 0;
                  return (
                    <button
                      key={stepIdx}
                      onClick={() => {
                        setVariations((prev) =>
                          prev.map((v, vi) => {
                            if (vi !== activeIdx) return v;
                            const newSteps = v.steps.map((row) => [...row]);
                            if (newSteps[soundIdx]) {
                              newSteps[soundIdx][stepIdx] = !newSteps[soundIdx][stepIdx];
                            }
                            return { ...v, steps: newSteps };
                          }),
                        );
                      }}
                      className={`h-5 flex-1 transition-all duration-75
                                 ${isOn
                      ? 'bg-daw-accent/70 hover:bg-daw-accent'
                      : isBarStart
                        ? 'bg-daw-surface-alt hover:bg-daw-panel border border-daw-border/20'
                        : 'bg-daw-bg hover:bg-daw-surface border border-daw-border/10'
                    }`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fill rule */}
      <div className="flex items-center gap-2 pt-1 border-t border-daw-border/20">
        <span className="text-xxs text-daw-text-muted font-mono">FILL EVERY</span>
        <select
          value={fillEvery}
          onChange={(e) => setFillEvery(Number(e.target.value))}
          className="bg-daw-surface border border-daw-border/30 text-xxs text-daw-text
                     px-1 py-0.5 font-mono"
        >
          <option value={2}>2 bars</option>
          <option value={4}>4 bars</option>
          <option value={8}>8 bars</option>
          <option value={16}>16 bars</option>
        </select>
        <span className="text-xxs text-daw-text-muted">
          {variations.filter((v) => v.role === 'fill').length} fill(s) available
        </span>
      </div>

      {/* Empty state */}
      {variations.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xxs text-daw-text-muted">
          Add a variation using the role buttons above
        </div>
      )}
    </div>
  );
}
