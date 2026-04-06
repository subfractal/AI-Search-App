import type { TrackType } from '@/types/audio';
import type { MixGenre, ComposerSettings } from '@/types/ai';
import type { InstrumentConfig } from '@/types/instruments';
import type { EffectConfig } from '@/types/effects';
import type { BusType } from '@/types/routing';

export type TemplateCategory = 'project' | 'instrument' | 'drum' | 'ai-mode';

export interface TemplateTrack {
  name: string;
  type: TrackType;
  instrumentConfig?: InstrumentConfig;
  effectConfigs?: EffectConfig[];
  volume?: number;
  pan?: number;
}

export interface TemplateRouting {
  type: BusType;
  name: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  tracks: TemplateTrack[];
  routingDefaults?: TemplateRouting[];
  aiDefaults?: Partial<ComposerSettings>;
  genre?: MixGenre;
}
