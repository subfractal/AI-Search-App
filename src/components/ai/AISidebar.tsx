import { useAIStore } from '@/stores/ai-store';
import { useSessionStore } from '@/stores/session-store';
import {
  runAnalysis,
  acceptSuggestion,
  rejectSuggestion,
} from '@/services/ai/suggestion-engine';
import { toggleMonitoring } from '@/services/ai/realtime-monitor';
import { analyzeGainStaging, applyGainStaging } from '@/services/ai/gain-staging';
import { STREAMING_TARGETS, GENRE_PROFILES } from '@/services/ai/genre-profiles';
import { generateComposition, generateVariation } from '@/services/ai/composer-engine';
import { runMasteringPipeline } from '@/services/ai/mastering-service';
import { FACTORY_TEMPLATES, loadTemplate } from '@/services/templates/template-loader';
import type { AISuggestion, MixGenre, GeneratorModel, SuggestionApplyMode } from '@/types/ai';
import { COPRODUCER_MODES, MUSICAL_ROLES } from '@/types/ai';
import { isMidiClip } from '@/types/audio';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const APPLY_MODES: { value: SuggestionApplyMode; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'realtime-preview', label: 'Preview' },
  { value: 'offline-commit', label: 'Offline' },
  { value: 'safe-auto', label: 'Safe Auto' },
];

const GENERATOR_MODELS: GeneratorModel[] = ['markov', 'lstm', 'vae', 'gan', 'evolutionary', 'diffusion'];

const MODEL_DESCRIPTIONS: Record<GeneratorModel, string> = {
  markov: 'Learns from existing clips — continuation & variation',
  lstm: 'Sequential phrase continuity — smooth melodic lines',
  vae: 'Interpolative exploration — blends between ideas',
  gan: 'Bold patterning — strong chord-tone emphasis',
  evolutionary: 'Mutation & refinement — evolves patterns over time',
  diffusion: 'Exploratory — wide leaps and unexpected intervals',
};

export default function AISidebar() {
  const enabled = useAIStore((s) => s.enabled);
  const setEnabled = useAIStore((s) => s.setEnabled);
  const suggestions = useAIStore((s) => s.suggestions);
  const activityLog = useAIStore((s) => s.activityLog);
  const analyzing = useAIStore((s) => s.analyzing);
  const lastAnalysis = useAIStore((s) => s.lastAnalysis);
  const clippingAlerts = useAIStore((s) => s.clippingAlerts);
  const monitorEnabled = useAIStore((s) => s.monitorEnabled);
  const applyMode = useAIStore((s) => s.applyMode);
  const setApplyMode = useAIStore((s) => s.setApplyMode);
  const maxAutoVolumeDeltaDb = useAIStore((s) => s.maxAutoVolumeDeltaDb);
  const setMaxAutoVolumeDeltaDb = useAIStore((s) => s.setMaxAutoVolumeDeltaDb);
  const lockedTrackIds = useAIStore((s) => s.lockedTrackIds);
  const toggleTrackLock = useAIStore((s) => s.toggleTrackLock);
  const composer = useAIStore((s) => s.composer);
  const setComposer = useAIStore((s) => s.setComposer);
  const savedComposerPresets = useAIStore((s) => s.savedComposerPresets);
  const saveComposerPreset = useAIStore((s) => s.saveComposerPreset);
  const loadComposerPreset = useAIStore((s) => s.loadComposerPreset);
  const resetAppliedSignatures = useAIStore((s) => s.resetAppliedSignatures);
  const masteringInProgress = useAIStore((s) => s.masteringInProgress);
  const masteringResult = useAIStore((s) => s.masteringResult);

  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const config = useSessionStore((s) => s.config);
  const setConfig = useSessionStore((s) => s.setConfig);

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const appliedSuggestions = suggestions.filter((s) => s.status === 'applied');
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) ?? null;
  const selectedLocked = !!selectedTrackId && lockedTrackIds.includes(selectedTrackId);

  return (
    <div className="h-full flex flex-col bg-daw-ai-bg">
      {/* Header — AI KONSTRUKT ENGINE */}
      <div className="shrink-0 border-b border-daw-border/20">
        <div className="flex items-center justify-between px-2.5 h-8">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 bg-[#E63946]
                            ${analyzing ? 'daw-analyzing' : ''}
                            ${enabled ? '' : 'opacity-40'}`} />
            <span className="text-[10px] font-semibold tracking-wider uppercase text-[#E63946]">AI Konstrukt Engine</span>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`text-xxs px-1.5 py-px transition-all ${enabled ? 'bg-[#E63946]/20 text-[#E63946]' : 'bg-daw-bg text-daw-text-muted'}`}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Coproducer Mode Selector */}
        {enabled && (
          <div className="flex px-1 pb-1.5 gap-0.5">
            {COPRODUCER_MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setComposer({ coproducerMode: mode.id })}
                title={mode.description}
                className={`flex-1 text-[8px] py-1 font-medium uppercase tracking-wide transition-all
                           ${composer.coproducerMode === mode.id
                             ? 'bg-[#E63946]/20 text-[#E63946] border border-[#E63946]/30'
                             : 'bg-daw-bg/40 text-daw-text-muted hover:text-daw-text-dim border border-transparent'}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {enabled ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-2.5 py-2">
            <button
              onClick={() => runAnalysis()}
              disabled={analyzing || tracks.length === 0}
              className={`w-full text-xxs py-1.5 font-medium text-white
                         disabled:opacity-30 disabled:cursor-not-allowed transition-all
                         ${analyzing
                           ? 'bg-daw-ai-suggestion/50 animate-blink-signal'
                           : 'bg-daw-ai-suggestion/70 hover:bg-daw-ai-suggestion'}`}
            >
              {analyzing ? (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                  </svg>
                  Analyzing...
                </span>
              ) : 'Analyze Mix'}
            </button>
            <button
              onClick={() => resetAppliedSignatures()}
              className="w-full mt-1 text-xxs py-1 font-medium bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim"
            >
              Reset AI Memory
            </button>
          </div>

          <Section title="DKT-AI-POLICY">
            <div className="flex items-center justify-between">
              <span className="text-xxs text-daw-text-muted">Mode</span>
              <select
                value={applyMode}
                onChange={(e) => setApplyMode(e.target.value as SuggestionApplyMode)}
                className="text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
              >
                {APPLY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xxs text-daw-text-muted">Max auto dB</span>
              <input
                type="number"
                min="1"
                max="12"
                value={maxAutoVolumeDeltaDb}
                onChange={(e) => setMaxAutoVolumeDeltaDb(Number(e.target.value))}
                className="w-12 text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
              />
            </div>
            {selectedTrack && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xxs text-daw-text-muted truncate">{selectedTrack.name}</span>
                <button
                  onClick={() => toggleTrackLock(selectedTrack.id)}
                  className={`text-[9px] px-2 py-0.5 ${selectedLocked ? 'bg-amber-500/20 text-amber-400' : 'bg-daw-bg text-daw-text-muted'}`}
                >
                  {selectedLocked ? 'Unlock AI' : 'Lock AI'}
                </button>
              </div>
            )}
          </Section>

          <Section title="DKT-GENRE-MON">
            <div className="flex items-center justify-between">
              <span className="text-xxs text-daw-text-muted">Genre</span>
              <select
                value={config.genre}
                onChange={(e) => setConfig({ genre: e.target.value as MixGenre })}
                className="text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
              >
                {Object.entries(GENRE_PROFILES).map(([key, p]) => (
                  <option key={key} value={key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="text-[8px] text-daw-text-muted/50 mt-0.5">{GENRE_PROFILES[config.genre].description}</div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xxs text-daw-text-muted">Live Monitor</span>
              <button
                onClick={() => {
                  toggleMonitoring();
                  useAIStore.getState().setMonitorEnabled(!monitorEnabled);
                }}
                className={`text-[9px] px-2 py-0.5 ${monitorEnabled ? 'bg-green-500/20 text-green-400' : 'bg-daw-bg text-daw-text-muted'}`}
              >
                {monitorEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {clippingAlerts.length > 0 && (
              <div className="mt-1 text-[9px] text-red-400">Clipping: {clippingAlerts.map((id) => tracks.find((t) => t.id === id)?.name ?? id).join(', ')}</div>
            )}
          </Section>

          <Section title="DKT-AI-COMPOSER">
            <div className="grid grid-cols-2 gap-1">
              <div>
                <select
                  value={composer.model}
                  onChange={(e) => setComposer({ model: e.target.value as GeneratorModel })}
                  className="w-full text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
                >
                  {GENERATOR_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <span className="text-[7px] text-daw-text-muted/40">Model</span>
              </div>
              <div>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={composer.bars}
                  onChange={(e) => setComposer({ bars: Number(e.target.value) })}
                  className="w-full text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
                />
                <span className="text-[7px] text-daw-text-muted/40">Bars (4 beats each)</span>
              </div>
            </div>
            <div className="text-[7px] text-daw-ai-accent/40 mt-0.5">
              {MODEL_DESCRIPTIONS[composer.model]}
            </div>

            {/* Musical Role Selector */}
            <div className="mt-1.5">
              <span className="text-[7px] text-daw-text-muted/40">Role</span>
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {MUSICAL_ROLES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setComposer({ role: r.id })}
                    className={`text-[8px] px-1.5 py-0.5 transition-all
                               ${composer.role === r.id
                                 ? 'bg-daw-ai-accent/25 text-daw-ai-accent border border-daw-ai-accent/30'
                                 : 'bg-daw-bg/30 text-daw-text-muted hover:text-daw-text-dim border border-transparent'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 mt-1">
              <div>
                <input
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={composer.density}
                  onChange={(e) => setComposer({ density: Number(e.target.value) })}
                  className="w-full text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
                />
                <span className="text-[7px] text-daw-text-muted/40">Density (sparse→dense)</span>
              </div>
              <div>
                <input
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={composer.temperature}
                  onChange={(e) => setComposer({ temperature: Number(e.target.value) })}
                  className="w-full text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
                />
                <span className="text-[7px] text-daw-text-muted/40">Temperature (safe→wild)</span>
              </div>
            </div>
            <button
              onClick={() => {
                const result = generateComposition();
                if (result) {
                  useAIStore.getState().logActivity({
                    id: `log-${Date.now()}`,
                    description: `Generated ${result.noteCount} notes with ${result.model} into ${result.bars} bars`,
                    trackId: result.trackId,
                    timestamp: Date.now(),
                    undoable: false,
                  });
                }
              }}
              className="w-full mt-1.5 text-xxs py-1 font-medium bg-daw-ai-accent/20 text-daw-ai-accent hover:bg-daw-ai-accent/30"
            >
              Generate MIDI Idea
            </button>
            {(() => {
              const selTrack = tracks.find((t) => t.id === selectedTrackId);
              const midiClip = selTrack?.clips.find(isMidiClip);
              if (!midiClip) return null;
              return (
                <button
                  onClick={() => {
                    const variation = generateVariation(midiClip, composer.temperature, composer.seed);
                    useSessionStore.getState().addClipToTrack(selTrack!.id, variation);
                    useAIStore.getState().logActivity({
                      id: `log-${Date.now()}`,
                      description: `Generated Markov variation of "${midiClip.name}" (${variation.notes.length} notes)`,
                      trackId: selTrack!.id,
                      timestamp: Date.now(),
                      undoable: false,
                    });
                  }}
                  className="w-full mt-1 text-xxs py-1 font-medium bg-daw-ai-accent/10 text-daw-ai-accent/70 hover:bg-daw-ai-accent/20"
                >
                  Variation of Selected Clip
                </button>
              );
            })()}

            {/* Composer Presets */}
            <div className="mt-2 pt-1.5 border-t border-daw-border/10">
              <div className="flex items-center gap-1">
                <span className="text-[8px] text-daw-text-muted/50 uppercase tracking-wide">Presets</span>
                <button
                  onClick={() => {
                    const name = `Preset ${savedComposerPresets.length + 1}`;
                    saveComposerPreset(name);
                  }}
                  className="text-[8px] px-1.5 py-px bg-daw-bg/40 text-daw-text-muted hover:text-daw-ai-accent"
                >
                  Save
                </button>
              </div>
              {savedComposerPresets.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {savedComposerPresets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => loadComposerPreset(p.id)}
                      className="text-[8px] px-1.5 py-0.5 bg-daw-bg/30 text-daw-text-muted hover:text-daw-ai-accent"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Template Quick Load */}
            <div className="mt-1.5">
              <span className="text-[8px] text-daw-text-muted/50 uppercase tracking-wide">Quick Template</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    loadTemplate(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full mt-0.5 text-[9px] bg-daw-bg border border-daw-border/30 px-1 py-0.5 text-daw-text-dim"
                defaultValue=""
              >
                <option value="">Load template...</option>
                {FACTORY_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </Section>

          {lastAnalysis && (
            <Section title="DKT-MIX-ANALYSIS">
              <StatRow label="Peak" value={`${lastAnalysis.overallLevel.peak.toFixed(1)} dB`} warn={lastAnalysis.overallLevel.clipping} />
              <StatRow label="RMS" value={`${lastAnalysis.overallLevel.rms.toFixed(1)} dB`} />
              <StatRow label="DR" value={`${lastAnalysis.overallLevel.dynamicRange.toFixed(1)} dB`} />
              <StatRow label="Width" value={`${(lastAnalysis.stereoWidth * 100).toFixed(0)}%`} />
              {lastAnalysis.overallLoudness && (
                <>
                  <div className="mt-1.5 border-t border-daw-border/10 pt-1.5">
                    <LufsRow label="Integrated" value={lastAnalysis.overallLoudness.integrated} />
                    <StatRow label="True Peak" value={`${lastAnalysis.overallLoudness.truePeak.toFixed(1)} dBTP`} warn={lastAnalysis.overallLoudness.truePeak > -1} />
                  </div>
                  <div className="mt-1">
                    {STREAMING_TARGETS.slice(0, 3).map((platform) => {
                      const ok = lastAnalysis.overallLoudness!.truePeak <= platform.maxTruePeak;
                      return <StatRow key={platform.name} label={platform.name} value={`${platform.integratedLufs} LUFS`} warn={!ok} />;
                    })}
                  </div>
                </>
              )}
              {/* Issue summary badges */}
              {(() => {
                const maskCount = lastAnalysis.maskingPairs?.length ?? 0;
                const phaseCount = lastAnalysis.phaseCorrelations?.filter((p) => p.correlation < 0.3).length ?? 0;
                const clipCount = clippingAlerts.length;
                if (maskCount + phaseCount + clipCount === 0) return null;
                return (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {clipCount > 0 && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-red-500/15 text-red-400">
                        Clipping: {clipCount}
                      </span>
                    )}
                    {maskCount > 0 && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400">
                        Masking: {maskCount}
                      </span>
                    )}
                    {phaseCount > 0 && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400">
                        Phase: {phaseCount}
                      </span>
                    )}
                  </div>
                );
              })()}

              {lastAnalysis.tracks.length >= 2 && (
                <button
                  onClick={() => {
                    const result = analyzeGainStaging(lastAnalysis.tracks);
                    applyGainStaging(result);
                    useAIStore.getState().logActivity({
                      id: `log-${Date.now()}`,
                      description: `Auto gain staged ${result.tracks.length} tracks`,
                      trackId: null,
                      timestamp: Date.now(),
                      undoable: true,
                    });
                  }}
                  className="w-full mt-1.5 text-xxs py-1 font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                >
                  Auto Gain Stage
                </button>
              )}
              <button
                onClick={() => runMasteringPipeline(config.genre)}
                disabled={masteringInProgress || tracks.length === 0}
                className="w-full mt-1.5 text-xxs py-1 font-medium bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {masteringInProgress ? 'Mastering...' : 'Mix & Master'}
              </button>
              {masteringResult && (
                <div className="mt-1.5 space-y-0.5">
                  {masteringResult.stages.map((stage) => (
                    <div key={stage.name} className="flex justify-between text-xxs">
                      <span className={stage.applied ? 'text-green-400' : 'text-daw-text-muted'}>{stage.name}</span>
                      <span className="text-daw-text-muted/60 text-[8px] truncate ml-1 max-w-[120px]">{stage.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {pendingSuggestions.length > 0 && (
            <Section title={`Suggestions (${pendingSuggestions.length})`}>
              <div className="space-y-1.5 mt-1.5">
                {pendingSuggestions.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    onAccept={() => acceptSuggestion(s.id)}
                    onReject={() => rejectSuggestion(s.id)}
                  />
                ))}
              </div>
            </Section>
          )}

          {appliedSuggestions.length > 0 && (
            <Section title={`Auto-Applied (${appliedSuggestions.length})`}>
              {appliedSuggestions.map((s) => (
                <div key={s.id} className="text-xxs text-daw-text-muted py-0.5">{s.title}</div>
              ))}
            </Section>
          )}

          {activityLog.length > 0 && (
            <Section title="DKT-LOG">
              {activityLog.slice(0, 15).map((entry) => (
                <div key={entry.id} className="text-xxs font-mono text-[#E63946]/70 py-0.5 leading-tight">
                  &gt; {entry.description}
                </div>
              ))}
            </Section>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-4">
          <span className="text-xxs text-daw-text-muted text-center leading-relaxed">
            AI Co-Producer is paused.
            <br />
            Enable to get mix analysis and suggestions.
          </span>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-2 border-b border-daw-border/10">
      <span className="daw-section-label">{title}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function StatRow({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between text-xxs">
      <span className="text-daw-text-muted">{label}</span>
      <span className={warn ? 'text-red-400' : 'text-daw-text-dim'}>{value}</span>
    </div>
  );
}

function LufsRow({ label, value }: { label: string; value: number }) {
  let color = 'text-daw-text-dim';
  if (value >= -16 && value <= -14) color = 'text-daw-text-dim';
  else if ((value >= -20 && value < -16) || (value > -14 && value <= -11)) color = 'text-[#F77F00]';
  else if (value > -11 || value < -20) color = 'text-[#E63946]';

  return (
    <div className="flex justify-between text-xxs">
      <span className="text-daw-text-muted">{label}</span>
      <span className={color}>{value > -Infinity ? `${value.toFixed(1)} LUFS` : '- -'}</span>
    </div>
  );
}

function describeAction(suggestion: AISuggestion): string | null {
  const action = suggestion.action as { type: string; value?: number; effectType?: string; actions?: unknown[] } | null;
  if (!action) return null;
  switch (action.type) {
    case 'setVolume': return `Volume ${action.value?.toFixed(1)} dB`;
    case 'setPan': return `Pan ${(action.value ?? 0).toFixed(2)}`;
    case 'addEffect': return `Add ${action.effectType ?? 'effect'}`;
    case 'batch': return `Apply ${action.actions?.length ?? 0} changes`;
    default: return null;
  }
}

function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: AISuggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  const actionLabel = describeAction(suggestion);
  const confPct = Math.round(suggestion.confidence * 100);
  const confColor = confPct >= 90 ? '#D1D1D1' : confPct >= 70 ? '#F77F00' : '#E63946';
  return (
    <div className="bg-daw-bg/40 p-2 border border-daw-border/15 hover:border-daw-ai-accent/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xxs font-medium text-daw-text">{suggestion.title}</div>
          <div className="text-xxs text-daw-text-muted mt-0.5">{suggestion.description}</div>
          {suggestion.regionStart !== undefined && suggestion.regionEnd !== undefined && (
            <div className="text-[8px] text-daw-ai-accent/50 mt-0.5">
              Region: {formatTime(suggestion.regionStart)}–{formatTime(suggestion.regionEnd)}
            </div>
          )}
        </div>
        {/* Confidence meter */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className="text-[8px] font-mono font-medium" style={{ color: confColor }}>{confPct}%</span>
          <div className="w-5 h-1 bg-daw-bg/80 overflow-hidden">
            <div className="h-full" style={{ width: `${confPct}%`, backgroundColor: confColor }} />
          </div>
        </div>
      </div>

      {suggestion.rationale && (
        <div className="mt-1 text-[9px] text-daw-text-muted/80">
          Why: {suggestion.rationale}
        </div>
      )}

      {suggestion.evidence && suggestion.evidence.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {suggestion.evidence.slice(0, 3).map((e) => (
            <span key={`${suggestion.id}-${e.label}`} className="text-[8px] px-1 py-px bg-daw-panel text-daw-text-muted">
              {e.label}: {String(e.value)}
            </span>
          ))}
        </div>
      )}

      {suggestion.constraints && suggestion.constraints.length > 0 && (
        <div className="mt-1 text-[8px] text-amber-400/80">
          Bounds: {suggestion.constraints.map((c) => `${c.label} ${c.value}`).join(' • ')}
        </div>
      )}

      <div className="mt-1 text-[8px] text-daw-ai-accent/70">
        Mode: {suggestion.applyMode ?? 'manual'} {suggestion.realtimeSafe ? '• RT safe' : '• offline/heavy'} {suggestion.reversible ? '• reversible' : ''}
      </div>

      {actionLabel && (
        <div className="mt-1 text-[9px] text-daw-ai-accent/70 italic">{actionLabel}</div>
      )}

      <div className="flex gap-1 mt-1.5">
        <button
          onClick={onAccept}
          className="flex-1 text-xxs py-0.5font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30"
        >
          Apply
        </button>
        <button
          onClick={onReject}
          className="flex-1 text-xxs py-0.5font-medium bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
