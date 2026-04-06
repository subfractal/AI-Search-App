import type { ProjectTemplate } from '@/types/templates';
import { useSessionStore } from '@/stores/session-store';
import { useRoutingStore } from '@/stores/routing-store';
import { useInstrumentStore } from '@/stores/instrument-store';
import { useEffectsStore } from '@/stores/effects-store';
import { useAIStore } from '@/stores/ai-store';

export const FACTORY_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl-songwriting',
    name: 'Songwriting Starter',
    category: 'project',
    description: 'Piano + vocal + drums + bass for songwriting',
    genre: 'pop',
    tracks: [
      { name: 'MIDI01 Piano', type: 'midi', volume: -3, pan: 0 },
      { name: 'Audio01 Vocal', type: 'audio', volume: 0, pan: 0 },
      { name: 'MIDI02 Drums', type: 'midi', volume: -2, pan: 0 },
      { name: 'MIDI03 Bass', type: 'midi', volume: -4, pan: 0 },
    ],
    routingDefaults: [
      { type: 'return', name: 'Reverb' },
      { type: 'return', name: 'Delay' },
    ],
  },
  {
    id: 'tpl-electronic',
    name: 'Electronic Clip-Launch',
    category: 'project',
    description: 'Synth layers + drum machine + return buses for electronic production',
    genre: 'edm',
    tracks: [
      { name: 'MIDI01 Lead', type: 'midi', volume: -4, pan: 0 },
      { name: 'MIDI02 Pad', type: 'midi', volume: -6, pan: -0.2 },
      { name: 'MIDI03 Bass', type: 'midi', volume: -3, pan: 0 },
      { name: 'MIDI04 Drums', type: 'midi', volume: -2, pan: 0 },
      { name: 'Audio01 FX', type: 'audio', volume: -8, pan: 0.3 },
    ],
    routingDefaults: [
      { type: 'return', name: 'Reverb' },
      { type: 'return', name: 'Delay' },
      { type: 'group', name: 'Synths' },
    ],
    aiDefaults: { model: 'vae', temperature: 0.6, density: 0.5 },
  },
  {
    id: 'tpl-beatmaking',
    name: 'Beatmaking',
    category: 'project',
    description: 'Drum machine + bass synth + sampler for beat production',
    genre: 'hip-hop',
    tracks: [
      { name: 'MIDI01 Drums', type: 'midi', volume: -2, pan: 0 },
      { name: 'MIDI02 808 Bass', type: 'midi', volume: -3, pan: 0 },
      { name: 'Audio01 Sample', type: 'audio', volume: -4, pan: 0 },
      { name: 'MIDI03 Melody', type: 'midi', volume: -5, pan: 0.1 },
    ],
    routingDefaults: [
      { type: 'return', name: 'Reverb' },
      { type: 'group', name: 'Drums' },
    ],
    aiDefaults: { model: 'markov', temperature: 0.4, density: 0.7 },
  },
  {
    id: 'tpl-mixing',
    name: 'Mixing Session',
    category: 'project',
    description: '8 audio tracks with group buses for mixing imported stems',
    genre: 'general',
    tracks: [
      { name: 'Audio01 Kick', type: 'audio', volume: 0, pan: 0 },
      { name: 'Audio02 Snare', type: 'audio', volume: 0, pan: 0 },
      { name: 'Audio03 Hats', type: 'audio', volume: -3, pan: 0.3 },
      { name: 'Audio04 Bass', type: 'audio', volume: 0, pan: 0 },
      { name: 'Audio05 Keys', type: 'audio', volume: -2, pan: -0.2 },
      { name: 'Audio06 Guitar', type: 'audio', volume: -2, pan: 0.2 },
      { name: 'Audio07 Vocal', type: 'audio', volume: 0, pan: 0 },
      { name: 'Audio08 FX', type: 'audio', volume: -6, pan: 0 },
    ],
    routingDefaults: [
      { type: 'group', name: 'Drums' },
      { type: 'group', name: 'Music' },
      { type: 'group', name: 'Vocals' },
      { type: 'return', name: 'Reverb' },
      { type: 'return', name: 'Delay' },
    ],
  },
  {
    id: 'tpl-film',
    name: 'Film/Game Sketch',
    category: 'project',
    description: 'Strings + pads + percussion for cinematic sketching',
    genre: 'classical',
    tracks: [
      { name: 'MIDI01 Strings', type: 'midi', volume: -3, pan: -0.3 },
      { name: 'MIDI02 Pad', type: 'midi', volume: -6, pan: 0.2 },
      { name: 'MIDI03 Perc', type: 'midi', volume: -4, pan: 0 },
      { name: 'Audio01 Ambient', type: 'audio', volume: -10, pan: 0 },
    ],
    routingDefaults: [
      { type: 'return', name: 'Hall Reverb' },
      { type: 'return', name: 'Delay' },
    ],
    aiDefaults: { model: 'diffusion', temperature: 0.3, density: 0.4 },
  },
];

export function loadTemplate(templateId: string): void {
  const template = FACTORY_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return;

  const session = useSessionStore.getState();
  const routing = useRoutingStore.getState();
  const instruments = useInstrumentStore.getState();
  const effects = useEffectsStore.getState();
  const ai = useAIStore.getState();

  for (const tpl of template.tracks) {
    let trackId: string;
    if (tpl.type === 'audio') {
      trackId = session.addAudioTrack(tpl.name);
    } else {
      trackId = session.addMidiTrack(tpl.name);
    }

    if (tpl.volume !== undefined || tpl.pan !== undefined) {
      session.updateTrack(trackId, {
        volume: tpl.volume ?? 0,
        pan: tpl.pan ?? 0,
      });
    }

    if (tpl.instrumentConfig) {
      instruments.assignInstrument(
        trackId,
        tpl.instrumentConfig.type,
        tpl.instrumentConfig.synthParams,
      );
    }

    if (tpl.effectConfigs) {
      for (const fx of tpl.effectConfigs) {
        effects.addEffect(trackId, fx.type, fx.params);
      }
    }
  }

  if (template.routingDefaults) {
    for (const bus of template.routingDefaults) {
      routing.addBus(bus.name, bus.type);
    }
  }

  if (template.aiDefaults) {
    ai.setComposer(template.aiDefaults);
  }

  if (template.genre) {
    session.setConfig({ genre: template.genre });
  }
}

export function getTemplatesByCategory(
  category: string,
): ProjectTemplate[] {
  return FACTORY_TEMPLATES.filter((t) => t.category === category);
}
