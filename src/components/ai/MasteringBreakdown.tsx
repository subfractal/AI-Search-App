import { useState } from 'react';
import { useAIStore } from '@/stores/ai-store';
import Knob from '@/components/ui/Knob';
import { EFFECT_KNOB_DEFS } from '@/types/effects';
import type { MasteringDecision } from '@/types/ai';
import type { EffectType } from '@/types/effects';

const SECTION_COLORS: Record<string, string> = {
  intro: '#6366f1',
  verse: '#3b82f6',
  chorus: '#E63946',
  bridge: '#f59e0b',
  buildup: '#f97316',
  drop: '#ef4444',
  outro: '#8b5cf6',
  full: '#6b7280',
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function DecisionRow({ decision }: { decision: MasteringDecision }) {
  const [expanded, setExpanded] = useState(false);
  const toggleDecision = useAIStore((s) => s.toggleMasteringDecision);
  const updateParams = useAIStore((s) => s.updateMasteringDecisionParams);
  const removeDecision = useAIStore((s) => s.removeMasteringDecision);

  const knobDefs = decision.effectType
    ? EFFECT_KNOB_DEFS[decision.effectType as EffectType] ?? []
    : [];

  return (
    <div className={`border border-daw-border/30 ${decision.enabled ? 'bg-daw-surface/40' : 'bg-daw-surface/10 opacity-50'}`}>
      <div className="flex items-center gap-1 px-1.5 py-1">
        {/* Enable/disable toggle */}
        <button
          onClick={() => toggleDecision(decision.id)}
          className={`w-3 h-3 rounded-sm border flex-shrink-0 ${
            decision.enabled
              ? 'bg-[#E63946] border-[#E63946]/60'
              : 'bg-transparent border-daw-border'
          }`}
          title={decision.enabled ? 'Disable' : 'Enable'}
        />

        {/* Track name */}
        <span className="text-[8px] font-mono text-daw-text-muted/70 w-14 truncate flex-shrink-0">
          {decision.trackName}
        </span>

        {/* Effect badge */}
        {decision.effectType && (
          <span className="text-[7px] font-mono px-1 py-0 bg-daw-surface-light/20 text-daw-accent/80 border border-daw-border/20 flex-shrink-0">
            {decision.effectType.toUpperCase()}
          </span>
        )}

        {/* Section label */}
        {decision.section && (
          <span
            className="text-[7px] px-1 py-0 font-mono flex-shrink-0"
            style={{ color: SECTION_COLORS[decision.section] ?? '#6b7280' }}
          >
            {decision.section}
          </span>
        )}

        {/* Description */}
        <span className="text-[8px] text-daw-text-muted/60 truncate flex-1 min-w-0">
          {decision.description}
        </span>

        {/* Expand button (only for effects with params) */}
        {knobDefs.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[8px] text-daw-text-muted/40 hover:text-daw-text-muted px-0.5 flex-shrink-0"
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}

        {/* Remove button */}
        <button
          onClick={() => removeDecision(decision.id)}
          className="text-[8px] text-daw-text-muted/30 hover:text-[#E63946] px-0.5 flex-shrink-0"
          title="Remove"
        >
          ×
        </button>
      </div>

      {/* Expanded param knobs */}
      {expanded && knobDefs.length > 0 && (
        <div className="px-1.5 pb-1.5 flex flex-wrap gap-2 border-t border-daw-border/20 pt-1">
          {knobDefs.map((def) => (
            <div key={def.key} className="flex flex-col items-center">
              <Knob
                value={decision.params[def.key] ?? def.min}
                min={def.min}
                max={def.max}
                size={28}
                showValue
                label={def.label}
                onChange={(v) => updateParams(decision.id, { [def.key]: v })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StageGroup({ stageName, decisions }: { stageName: string; decisions: MasteringDecision[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const appliedCount = decisions.filter((d) => d.enabled).length;

  return (
    <div className="border border-daw-border/20">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-1.5 py-1 bg-daw-surface/30 hover:bg-daw-surface/50 text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] text-daw-text-muted/40">{collapsed ? '▸' : '▾'}</span>
          <span className="text-[9px] font-mono font-bold text-daw-text uppercase tracking-wide">
            {stageName}
          </span>
        </div>
        <span className="text-[8px] font-mono text-daw-text-muted/50">
          {appliedCount}/{decisions.length}
        </span>
      </button>
      {!collapsed && (
        <div className="space-y-px">
          {decisions.map((d) => (
            <DecisionRow key={d.id} decision={d} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MasteringBreakdown() {
  const result = useAIStore((s) => s.masteringResult);
  const decisions = useAIStore((s) => s.masteringDecisions);
  const abActive = useAIStore((s) => s.masteringABActive);
  const setAB = useAIStore((s) => s.setMasteringABActive);
  const revert = useAIStore((s) => s.revertMastering);

  if (!result) return null;

  // Group decisions by stage
  const stageOrder = ['Gain Staging', 'EQ Balance', 'Compression', 'Limiting'];
  const byStage = stageOrder
    .map((name) => ({
      name,
      decisions: decisions.filter((d) => d.stage === name),
    }))
    .filter((g) => g.decisions.length > 0);

  return (
    <div className="space-y-1.5">
      {/* A/B Toggle */}
      <div className="flex items-center gap-1 daw-inset p-1">
        <button
          onClick={() => setAB(false)}
          className={`flex-1 text-[9px] font-mono font-bold py-1 text-center transition-colors ${
            !abActive
              ? 'bg-[#F77F00]/20 text-[#F77F00] border border-[#F77F00]/40'
              : 'text-daw-text-muted/40 hover:text-daw-text-muted/60 border border-transparent'
          }`}
        >
          A — DRY
        </button>
        <button
          onClick={() => setAB(true)}
          className={`flex-1 text-[9px] font-mono font-bold py-1 text-center transition-colors ${
            abActive
              ? 'bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/40'
              : 'text-daw-text-muted/40 hover:text-daw-text-muted/60 border border-transparent'
          }`}
        >
          B — MASTER
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-[8px] font-mono text-daw-text-muted/60 px-0.5">
        <span className="uppercase">{result.genre}</span>
        <span>
          {result.finalLufs > -Infinity ? `${result.finalLufs.toFixed(1)} LUFS` : '—'}
          {' / '}
          {result.finalTruePeak > -Infinity ? `${result.finalTruePeak.toFixed(1)} dBTP` : '—'}
        </span>
      </div>

      {/* Sections bar */}
      {result.sections.length > 1 && (
        <div className="daw-inset p-1">
          <div className="text-[7px] font-mono text-daw-text-muted/40 mb-0.5 uppercase tracking-wider">
            Sections
          </div>
          <div className="flex h-4 gap-px overflow-hidden">
            {result.sections.map((section, i) => {
              const totalDur = result.sections.reduce((s, sec) => s + (sec.end - sec.start), 0);
              const widthPct = ((section.end - section.start) / totalDur) * 100;
              return (
                <div
                  key={i}
                  className="flex items-center justify-center overflow-hidden"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: `${SECTION_COLORS[section.label] ?? '#6b7280'}30`,
                    borderBottom: `2px solid ${SECTION_COLORS[section.label] ?? '#6b7280'}`,
                  }}
                  title={`${section.label}: ${formatTime(section.start)}–${formatTime(section.end)}`}
                >
                  <span
                    className="text-[6px] font-mono uppercase truncate px-0.5"
                    style={{ color: SECTION_COLORS[section.label] ?? '#6b7280' }}
                  >
                    {section.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Decision breakdown by stage */}
      {decisions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[7px] font-mono text-daw-text-muted/40 uppercase tracking-wider px-0.5">
            Decisions ({decisions.length})
          </div>
          {byStage.map((group) => (
            <StageGroup key={group.name} stageName={group.name} decisions={group.decisions} />
          ))}
        </div>
      )}

      {/* Stage summary (for stages with no decisions) */}
      {result.stages.filter((s) => s.name === 'Loudness Check').map((stage) => (
        <div key={stage.name} className="flex justify-between text-[8px] px-0.5">
          <span className="text-daw-text-muted/50 font-mono">{stage.name}</span>
          <span className="text-daw-text-muted/40 text-[7px] truncate ml-1 max-w-[140px]">
            {stage.description}
          </span>
        </div>
      ))}

      {/* Revert All */}
      <button
        onClick={revert}
        className="w-full text-[9px] font-mono py-1 text-daw-text-muted/50 hover:text-[#E63946] hover:bg-[#E63946]/10 border border-daw-border/20 transition-colors"
      >
        REVERT ALL
      </button>
    </div>
  );
}
