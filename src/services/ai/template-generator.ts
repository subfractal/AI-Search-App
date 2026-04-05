/**
 * Adaptive Template Generator — creates reusable project templates
 * from analyzed session data (track roles, routing, effects, config).
 */

import { useSessionStore } from '@/stores/session-store';
import { useEffectsStore } from '@/stores/effects-store';
import { generateId } from '@/utils/id';
import type {
  AdaptiveTemplate,
  TemplateTrackDef,
  TemplateBusDef,
  TemplateEffectDef,
  SessionScanResult,
} from '@/types/session-scan';

const ROLE_COLORS: Record<string, string> = {
  drums: '#E63946',
  bass: '#F77F00',
  vocal: '#4ade80',
  lead: '#a78bfa',
  pad: '#818cf8',
  chords: '#facc15',
  arp: '#2dd4bf',
  percussion: '#fb923c',
  fx: '#f472b6',
  general: '#53c0f0',
};

const DEFAULT_BUS_STRUCTURE: TemplateBusDef[] = [
  { name: 'Drum Bus', type: 'group', receivesFrom: ['drums', 'percussion'] },
  { name: 'Music Bus', type: 'group', receivesFrom: ['bass', 'lead', 'pad', 'chords', 'arp'] },
  { name: 'Vocal Bus', type: 'group', receivesFrom: ['vocal'] },
  { name: 'FX Return', type: 'return', receivesFrom: ['fx'] },
  { name: 'Reverb Send', type: 'return', receivesFrom: [] },
  { name: 'Delay Send', type: 'return', receivesFrom: [] },
];

const ROLE_EFFECT_SUGGESTIONS: Record<string, TemplateEffectDef[]> = {
  drums: [
    { trackRole: 'drums', effectType: 'compressor', params: { threshold: -18, ratio: 4, attack: 0.005, release: 0.1 }, reason: 'Control transients and add punch' },
    { trackRole: 'drums', effectType: 'eq', params: { low: 2, mid: 0, high: 1, lowFrequency: 100, highFrequency: 8000 }, reason: 'Shape drum tone' },
  ],
  bass: [
    { trackRole: 'bass', effectType: 'compressor', params: { threshold: -15, ratio: 3, attack: 0.01, release: 0.15 }, reason: 'Even out bass dynamics' },
    { trackRole: 'bass', effectType: 'eq', params: { low: 1, mid: -1, high: -2, lowFrequency: 80, highFrequency: 2500 }, reason: 'Clean up low end' },
  ],
  vocal: [
    { trackRole: 'vocal', effectType: 'compressor', params: { threshold: -20, ratio: 3, attack: 0.008, release: 0.12 }, reason: 'Smooth vocal dynamics' },
    { trackRole: 'vocal', effectType: 'eq', params: { low: -3, mid: 1, high: 2, lowFrequency: 200, highFrequency: 5000 }, reason: 'Vocal presence and clarity' },
    { trackRole: 'vocal', effectType: 'deesser', params: { frequency: 6000, threshold: -20 }, reason: 'Reduce sibilance' },
  ],
  lead: [
    { trackRole: 'lead', effectType: 'reverb', params: { decay: 1.5, wet: 0.2, preDelay: 0.02 }, reason: 'Add space and depth' },
  ],
  pad: [
    { trackRole: 'pad', effectType: 'reverb', params: { decay: 3.0, wet: 0.35, preDelay: 0.04 }, reason: 'Lush spatial effect' },
    { trackRole: 'pad', effectType: 'eq', params: { low: -2, mid: 0, high: 1, lowFrequency: 300, highFrequency: 4000 }, reason: 'Avoid low-end mud' },
  ],
};

/**
 * Generate an adaptive template from a session scan result.
 */
export function generateTemplate(
  scan: SessionScanResult,
  name?: string,
): AdaptiveTemplate {
  const session = useSessionStore.getState();
  const effects = useEffectsStore.getState();

  // Build track stack from scan results
  const trackStack: TemplateTrackDef[] = scan.trackRoles.map((tr) => {
    const track = session.tracks.find((t) => t.id === tr.trackId);
    return {
      name: track?.name ?? `${tr.role} Track`,
      type: track?.type === 'midi' ? 'midi' : 'audio',
      role: tr.role,
      color: ROLE_COLORS[tr.role] ?? '#53c0f0',
      volume: track?.volume ?? -6,
      pan: track?.pan ?? 0,
    };
  });

  // Determine bus structure based on roles present
  const presentRoles = new Set(scan.trackRoles.map((tr) => tr.role));
  const busStructure = DEFAULT_BUS_STRUCTURE.filter((bus) =>
    bus.receivesFrom.length === 0 ||
    bus.receivesFrom.some((role) => presentRoles.has(role)),
  );

  // Collect effect suggestions for each role
  const suggestedEffects: TemplateEffectDef[] = [];
  for (const role of presentRoles) {
    const roleSuggestions = ROLE_EFFECT_SUGGESTIONS[role];
    if (roleSuggestions) {
      suggestedEffects.push(...roleSuggestions);
    }
  }

  // Include actual effects from the current session
  for (const track of session.tracks) {
    const trackEffects = effects.trackEffects[track.id] ?? [];
    const role = scan.trackRoles.find((tr) => tr.trackId === track.id)?.role ?? 'general';
    for (const fx of trackEffects) {
      if (!fx.enabled) continue;
      const alreadySuggested = suggestedEffects.some(
        (s) => s.trackRole === role && s.effectType === fx.type,
      );
      if (!alreadySuggested) {
        suggestedEffects.push({
          trackRole: role,
          effectType: fx.type,
          params: fx.params as unknown as Record<string, number>,
          reason: `Captured from session (${track.name})`,
        });
      }
    }
  }

  return {
    id: generateId('tmpl'),
    name: name ?? `Template from ${session.config.genre} session`,
    genre: session.config.genre,
    bpm: scan.tempo.bpm,
    key: `${scan.key.key} ${scan.key.scale}`,
    trackStack,
    busStructure,
    suggestedEffects,
    createdFrom: 'session-scan',
    createdAt: Date.now(),
  };
}

/**
 * Apply an adaptive template to the current session —
 * creates tracks with roles, colors, and suggested effects.
 */
export function applyTemplate(template: AdaptiveTemplate): void {
  const session = useSessionStore.getState();
  const effectsStore = useEffectsStore.getState();

  // Set config
  session.setConfig({ bpm: template.bpm, genre: template.genre as import('@/types/ai').MixGenre });

  // Create tracks
  for (const def of template.trackStack) {
    const trackId = def.type === 'midi'
      ? session.addMidiTrack(def.name)
      : session.addAudioTrack(def.name);
    session.updateTrack(trackId, {
      color: def.color,
      volume: def.volume,
      pan: def.pan,
      role: def.role,
    });

    // Apply suggested effects for this role
    const roleFx = template.suggestedEffects.filter(
      (fx) => fx.trackRole === def.role,
    );
    for (const fx of roleFx.slice(0, 3)) {
      effectsStore.addEffect(
        trackId,
        fx.effectType as import('@/types/effects').EffectType,
        fx.params as unknown as import('@/types/effects').EffectParams,
      );
    }
  }

  // Create bus tracks
  for (const bus of template.busStructure) {
    if (bus.type === 'group') {
      session.addGroupTrack(bus.name);
    } else {
      session.addReturnTrack(bus.name);
    }
  }
}
