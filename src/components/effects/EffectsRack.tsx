import { useCallback } from 'react';
import { useEffectsStore } from '@/stores/effects-store';
import Knob from '@/components/ui/Knob';
import type { EffectType, EffectConfig, EffectParamDef } from '@/types/effects';
import { EFFECT_LABELS, EFFECT_KNOB_DEFS, EFFECT_PRESETS } from '@/types/effects';

interface EffectsRackProps {
  trackId: string;
  trackName: string;
}

const EFFECT_TYPES: EffectType[] = [
  'reverb', 'delay', 'eq', 'compressor',
  'chorus', 'distortion', 'phaser', 'filter',
];

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

      // Check if it's a preset
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
      if (index > 0) {
        reorderEffects(trackId, index, index - 1);
      }
    },
    [trackId, reorderEffects],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < effects.length - 1) {
        reorderEffects(trackId, index, index + 1);
      }
    },
    [trackId, effects.length, reorderEffects],
  );

  return (
    <div className="flex flex-col gap-2 bg-daw-surface rounded p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-daw-text">
          Effects
          <span className="text-daw-text-dim ml-1.5 font-normal">
            {trackName}
          </span>
        </h3>
        <select
          className="bg-daw-panel text-daw-text text-xs border border-daw-border
                     rounded px-1.5 py-0.5 outline-none cursor-pointer"
          onChange={handleAddEffect}
          defaultValue=""
        >
          <option value="" disabled>
            + Add
          </option>
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

      {effects.length === 0 ? (
        <p className="text-daw-text-muted text-xs py-4 text-center">
          No effects — click + to add
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
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
              onUpdate={(params) =>
                updateEffect(trackId, effect.id, params)
              }
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
            />
          ))}
        </div>
      )}
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

function EffectCard({
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

  return (
    <div
      className={`flex items-center gap-2 bg-daw-panel rounded px-2 py-1.5
                   border border-daw-border ${
                     !effect.enabled ? 'opacity-50' : ''
                   }`}
    >
      {/* Enable/disable dot */}
      <button
        onClick={onToggle}
        className="flex-shrink-0"
        title={effect.enabled ? 'Disable' : 'Enable'}
      >
        <span
          className={`block w-2.5 h-2.5 rounded-full ${
            effect.enabled ? 'bg-daw-accent' : 'bg-gray-600'
          }`}
        />
      </button>

      {/* Effect name */}
      <span className="text-xs text-daw-text font-medium w-16 flex-shrink-0">
        {EFFECT_LABELS[effect.type]}
      </span>

      {/* Knobs */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {knobDefs.map((def: EffectParamDef) => (
          <Knob
            key={def.key}
            value={params[def.key] as number}
            min={def.min}
            max={def.max}
            label={def.label}
            size={24}
            onChange={(val) => onUpdate({ [def.key]: val })}
          />
        ))}
      </div>

      {/* Reorder buttons */}
      <div className="flex flex-col gap-0 flex-shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-daw-text-muted hover:text-daw-text disabled:opacity-30
                     text-xxs leading-none px-0.5"
          title="Move up"
        >
          &#9650;
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-daw-text-muted hover:text-daw-text disabled:opacity-30
                     text-xxs leading-none px-0.5"
          title="Move down"
        >
          &#9660;
        </button>
      </div>

      {/* Delete button */}
      <button
        onClick={onRemove}
        className="text-daw-text-muted hover:text-red-400 text-xs
                   flex-shrink-0 px-0.5"
        title="Remove effect"
      >
        &#10005;
      </button>
    </div>
  );
}
