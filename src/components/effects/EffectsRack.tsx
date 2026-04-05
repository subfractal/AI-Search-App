import { useCallback, memo } from 'react';
import { useEffectsStore } from '@/stores/effects-store';
import Knob from '@/components/ui/Knob';
import type { EffectType, EffectConfig, EffectParamDef } from '@/types/effects';
import { EFFECT_LABELS, EFFECT_KNOB_DEFS, EFFECT_PRESETS } from '@/types/effects';

interface EffectsRackProps {
  trackId: string;
  trackName: string;
}

const EFFECT_TYPES: EffectType[] = [
  'eq', 'compressor', 'filter', 'pitchShift',
  'reverb', 'delay', 'chorus', 'distortion', 'phaser',
];

const CATEGORY_ICONS: Record<string, string> = {
  eq: '~',
  compressor: '>',
  filter: 'F',
  pitchShift: 'P',
  reverb: 'R',
  delay: 'D',
  chorus: 'C',
  distortion: 'X',
  phaser: 'O',
};

// Industrial monochrome + Signal Red accent palette
const CATEGORY_COLORS: Record<string, string> = {
  eq: 'bg-[#E63946]/15 text-[#E63946]',
  compressor: 'bg-[#E63946]/15 text-[#E63946]',
  filter: 'bg-daw-text-muted/10 text-daw-text-dim',
  pitchShift: 'bg-daw-text-muted/10 text-daw-text-dim',
  reverb: 'bg-[#F77F00]/15 text-[#F77F00]',
  delay: 'bg-[#F77F00]/15 text-[#F77F00]',
  chorus: 'bg-daw-text-muted/10 text-daw-text-dim',
  distortion: 'bg-[#E63946]/20 text-[#E63946]',
  phaser: 'bg-daw-text-muted/10 text-daw-text-dim',
};

export default function EffectsRack({ trackId, trackName }: EffectsRackProps) {
  const effects = useEffectsStore(
    (s) => s.trackEffects[trackId] ?? [],
  );
  const addEffect = useEffectsStore((s) => s.addEffect);
  const removeEffect = useEffectsStore((s) => s.removeEffect);
  const updateEffect = useEffectsStore((s) => s.updateEffect);
  const toggleEffect = useEffectsStore((s) => s.toggleEffect);
  const reorderEffects = useEffectsStore((s) => s.reorderEffects);

  const handleAddEffect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (!value) return;

      const preset = EFFECT_PRESETS.find((p) => p.name === value);
      if (preset) {
        addEffect(trackId, preset.type, { ...preset.params });
      } else {
        addEffect(trackId, value as EffectType);
      }

      e.target.value = '';
    },
    [trackId, addEffect],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0) reorderEffects(trackId, index, index - 1);
    },
    [trackId, reorderEffects],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < effects.length - 1) reorderEffects(trackId, index, index + 1);
    },
    [trackId, effects.length, reorderEffects],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b
                      border-daw-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono uppercase tracking-[3px] text-[#E63946]/80">DKT-FX-RACK</span>
          <span className="text-xs text-daw-text-muted">{trackName}</span>
          {effects.length > 0 && (
            <span className="text-xxs bg-daw-accent/15 text-daw-accent px-1.5
                             py-px font-medium">
              {effects.length}
            </span>
          )}
        </div>
        <select
          className="bg-daw-panel text-daw-text text-xs border border-daw-border/40
                     px-2 py-1 outline-none cursor-pointer
                     hover:border-daw-accent/40 transition-colors"
          onChange={handleAddEffect}
          defaultValue=""
        >
          <option value="" disabled>+ Add Effect</option>
          <optgroup label="Effects">
            {EFFECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EFFECT_LABELS[type]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Presets">
            {EFFECT_PRESETS.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Effects chain */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {effects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
            <span className="text-daw-text-muted/30 text-xl">FX</span>
            <span className="text-xxs text-daw-text-muted text-center">
              No effects on this track. Use the dropdown above to add EQ,
              compressor, pitch shift, reverb, and more.
            </span>
          </div>
        ) : (
          <div className="flex gap-1 p-2 h-full min-w-min">
            {effects.map((effect, index) => (
              <EffectCard
                key={effect.id}
                effect={effect}
                index={index}
                isFirst={index === 0}
                isLast={index === effects.length - 1}
                trackId={trackId}
                onToggle={() => toggleEffect(trackId, effect.id)}
                onRemove={() => removeEffect(trackId, effect.id)}
                onUpdate={(params) => updateEffect(trackId, effect.id, params)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EffectCardProps {
  effect: EffectConfig;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  trackId: string;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (params: Record<string, number | string>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const EffectCard = memo(function EffectCard({
  effect,
  isFirst,
  isLast,
  onToggle,
  onRemove,
  onUpdate,
  onMoveUp,
  onMoveDown,
}: EffectCardProps) {
  const knobDefs = EFFECT_KNOB_DEFS[effect.type];
  const params = effect.params as unknown as Record<string, number | string>;
  const colorClass = CATEGORY_COLORS[effect.type] ?? 'bg-daw-accent/15 text-daw-accent';
  const icon = CATEGORY_ICONS[effect.type] ?? '?';

  return (
    <div
      className={`flex flex-col gap-1.5 bg-daw-panel px-2.5 py-2
                   border border-daw-border/30 min-w-[100px] w-[120px]
                   transition-all ${!effect.enabled ? 'opacity-40 grayscale' : ''}`}
    >
      {/* Header: icon + name + controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggle}
          title={effect.enabled ? 'Bypass' : 'Enable'}
          className={`w-5 h-5 flex items-center justify-center
                     text-[9px] font-bold shrink-0 transition-all ${colorClass}`}
        >
          {icon}
        </button>
        <span className="text-xxs text-daw-text font-medium flex-1 truncate">
          {EFFECT_LABELS[effect.type]}
        </span>
        <button
          onClick={onRemove}
          className="text-daw-text-muted/40 hover:text-red-400 text-xs
                     shrink-0 transition-colors"
          title="Remove"
        >
          &#10005;
        </button>
      </div>

      {/* Knobs grid */}
      <div className="grid grid-cols-2 gap-x-1 gap-y-1.5 place-items-center">
        {knobDefs.map((def: EffectParamDef) => (
          <Knob
            key={def.key}
            value={params[def.key] as number}
            min={def.min}
            max={def.max}
            label={def.label}
            size={22}
            showValue
            onChange={(val) => onUpdate({ [def.key]: val })}
          />
        ))}
      </div>

      {/* Reorder */}
      <div className="flex justify-center gap-1 mt-auto">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-daw-text-muted/50 hover:text-daw-text disabled:opacity-20
                     text-xxs px-1 transition-colors"
          title="Move left"
        >
          &#9664;
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-daw-text-muted/50 hover:text-daw-text disabled:opacity-20
                     text-xxs px-1 transition-colors"
          title="Move right"
        >
          &#9654;
        </button>
      </div>
    </div>
  );
});
