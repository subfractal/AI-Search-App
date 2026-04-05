/**
 * Natural Language Command Parser — regex/keyword-based intent parser.
 * No LLM, no external APIs. Pattern matching against a grammar of DAW actions.
 */

import type { Track } from '@/types/audio';
import type {
  ParsedCommand,
  CommandTarget,
  CommandGrammarRule,
} from '@/types/commands';
import type { EffectType } from '@/types/effects';

const EFFECT_NAMES: Record<string, EffectType> = {
  reverb: 'reverb',
  delay: 'delay',
  echo: 'delay',
  eq: 'eq',
  equalizer: 'eq',
  compressor: 'compressor',
  compression: 'compressor',
  chorus: 'chorus',
  distortion: 'distortion',
  overdrive: 'distortion',
  phaser: 'phaser',
  filter: 'filter',
  'pitch shift': 'pitchShift',
  gate: 'gate',
  'de-esser': 'deesser',
  deesser: 'deesser',
  exciter: 'exciter',
  saturator: 'saturator',
  saturation: 'saturator',
  limiter: 'limiter',
  'multiband compressor': 'multibandComp',
  multiband: 'multibandComp',
  stereo: 'stereoImager',
  widener: 'stereoImager',
  tremolo: 'tremolo',
  flanger: 'flanger',
  'ring mod': 'ringMod',
  utility: 'utility',
};

function parseTarget(name: string): CommandTarget {
  const lower = name.toLowerCase().trim();
  if (lower === 'all' || lower === 'everything' || lower === 'every track') {
    return { type: 'all', value: 'all' };
  }
  if (lower === 'selected' || lower === 'this' || lower === 'current') {
    return { type: 'selected', value: 'selected' };
  }
  // Check if it matches a known role
  const roles = ['drums', 'bass', 'vocal', 'vocals', 'lead', 'pad', 'keys',
    'guitar', 'synth', 'percussion', 'fx', 'arp'];
  if (roles.includes(lower)) {
    return { type: 'trackRole', value: lower === 'vocals' ? 'vocal' : lower };
  }
  return { type: 'trackName', value: lower };
}

function findEffect(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [name, type] of Object.entries(EFFECT_NAMES)) {
    if (lower.includes(name)) return type;
  }
  return null;
}

const GRAMMAR_RULES: CommandGrammarRule[] = [
  // Sidechain ducking: "duck the bass when kick hits"
  {
    pattern: /duck\s+(?:the\s+)?(\w+)\s+when\s+(?:the\s+)?(\w+)\s+(?:hits|plays|triggers)/i,
    intent: 'duck',
    extract: (m) => ({
      targets: [parseTarget(m[1]!), parseTarget(m[2]!)],
      params: { type: 'sidechain' },
    }),
  },
  // Volume with dB: "lower/raise vocals by 3db"
  {
    pattern: /(?:lower|reduce|decrease|turn\s+down)\s+(?:the\s+)?(.+?)\s+by\s+(\d+(?:\.\d+)?)\s*db/i,
    intent: 'setVolume',
    extract: (m) => ({
      targets: [parseTarget(m[1]!)],
      params: { delta: -parseFloat(m[2]!) },
    }),
  },
  {
    pattern: /(?:raise|increase|boost|turn\s+up)\s+(?:the\s+)?(.+?)\s+by\s+(\d+(?:\.\d+)?)\s*db/i,
    intent: 'setVolume',
    extract: (m) => ({
      targets: [parseTarget(m[1]!)],
      params: { delta: parseFloat(m[2]!) },
    }),
  },
  // Generic volume: "make vocals louder/quieter"
  {
    pattern: /(?:make|turn)\s+(?:the\s+)?(.+?)\s+(louder|quieter|softer)/i,
    intent: 'setVolume',
    extract: (m) => ({
      targets: [parseTarget(m[1]!)],
      params: { delta: m[2] === 'louder' ? 3 : -3 },
    }),
  },
  // Pan: "pan guitar left/right/center"
  {
    pattern: /pan\s+(?:the\s+)?(.+?)\s+(left|right|center|centre|hard\s+left|hard\s+right)/i,
    intent: 'setPan',
    extract: (m) => {
      const dir = m[2]!.toLowerCase();
      let value = 0;
      if (dir.includes('left')) value = dir.includes('hard') ? -1 : -0.5;
      if (dir.includes('right')) value = dir.includes('hard') ? 1 : 0.5;
      return { targets: [parseTarget(m[1]!)], params: { value } };
    },
  },
  // Mute/unmute/solo/unsolo: "mute drums"
  {
    pattern: /^(mute|unmute|solo|unsolo)\s+(?:the\s+)?(.+)/i,
    intent: 'mute', // will be overridden below
    extract: (m) => ({
      targets: [parseTarget(m[2]!)],
      params: {},
    }),
  },
  // Add effect: "add reverb to guitar"
  {
    pattern: /add\s+(.+?)\s+(?:to|on)\s+(?:the\s+)?(.+)/i,
    intent: 'addEffect',
    extract: (m) => {
      const effect = findEffect(m[1]!);
      const params: Record<string, string | number> = {};
      if (effect) params.effectType = effect;
      return { targets: [parseTarget(m[2]!)], params };
    },
  },
  // Remove effect: "remove reverb from guitar"
  {
    pattern: /(?:remove|delete)\s+(.+?)\s+(?:from|on)\s+(?:the\s+)?(.+)/i,
    intent: 'removeEffect',
    extract: (m) => {
      const effect = findEffect(m[1]!);
      const params: Record<string, string | number> = {};
      if (effect) params.effectType = effect;
      return { targets: [parseTarget(m[2]!)], params };
    },
  },
  // Freeze/unfreeze: "freeze drums"
  {
    pattern: /^(freeze|unfreeze)\s+(?:the\s+)?(.+)/i,
    intent: 'freeze',
    extract: (m) => ({
      targets: [parseTarget(m[2]!)],
      params: {},
    }),
  },
  // Analyze: "analyze the mix"
  {
    pattern: /analyze\s+(?:the\s+)?(?:mix|session|levels|everything|mastering)/i,
    intent: 'analyze',
    extract: () => ({ targets: [], params: {} }),
  },
  // Master: "master the mix"
  {
    pattern: /master\s+(?:the\s+)?(?:mix|session|track)/i,
    intent: 'master',
    extract: () => ({ targets: [], params: {} }),
  },
  // Set BPM: "set bpm to 120"
  {
    pattern: /(?:set\s+)?(?:the\s+)?(?:bpm|tempo)\s+(?:to\s+)?(\d+)/i,
    intent: 'setBpm',
    extract: (m) => ({
      targets: [],
      params: { bpm: parseInt(m[1]!, 10) },
    }),
  },
  // Compose: "generate 4 bars of bass"
  {
    pattern: /(?:generate|compose|create)\s+(\d+)\s+bars?\s+(?:of\s+)?(\w+)/i,
    intent: 'compose',
    extract: (m) => ({
      targets: [parseTarget(m[2]!)],
      params: { bars: parseInt(m[1]!, 10) },
    }),
  },
  // Transport: "play", "stop", "record"
  {
    pattern: /^(play|stop|record|pause)$/i,
    intent: 'play',
    extract: (m) => ({
      targets: [],
      params: { action: m[1]!.toLowerCase() },
    }),
  },
  // Loop: "loop the bridge"
  {
    pattern: /loop\s+(?:the\s+)?(.+)/i,
    intent: 'loop',
    extract: (m) => ({
      targets: [parseTarget(m[1]!)],
      params: {},
    }),
  },
  // Rename: "rename track 1 to Kick"
  {
    pattern: /rename\s+(?:the\s+)?(.+?)\s+to\s+(.+)/i,
    intent: 'rename',
    extract: (m) => ({
      targets: [parseTarget(m[1]!)],
      params: { name: m[2]!.trim() },
    }),
  },
  // Export: "export the mix"
  {
    pattern: /export\s+(?:the\s+)?(?:mix|session|project|audio)/i,
    intent: 'export',
    extract: () => ({ targets: [], params: {} }),
  },
];

/**
 * Fuzzy match a target name against available tracks.
 * Returns the best-matching track ID, or null if no good match.
 */
export function resolveTrackTarget(
  target: CommandTarget,
  tracks: Track[],
): string[] {
  if (target.type === 'all') {
    return tracks.map((t) => t.id);
  }
  if (target.type === 'selected') {
    return []; // caller should use selectedTrackId from session store
  }
  if (target.type === 'trackRole') {
    return tracks
      .filter((t) => {
        const trackRole = (t as Track & { role?: string }).role?.toLowerCase();
        return trackRole === target.value.toLowerCase();
      })
      .map((t) => t.id);
  }

  // Track name: fuzzy substring match
  const lower = target.value.toLowerCase();
  const exact = tracks.find((t) => t.name.toLowerCase() === lower);
  if (exact) return [exact.id];

  const partial = tracks.filter((t) =>
    t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase()),
  );
  if (partial.length > 0) return partial.map((t) => t.id);

  return [];
}

/**
 * Parse a natural language command string into a structured ParsedCommand.
 */
export function parseCommand(
  input: string,
  _tracks: Track[],
): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const rule of GRAMMAR_RULES) {
    const match = trimmed.match(rule.pattern);
    if (match) {
      let intent = rule.intent;
      const { targets, params } = rule.extract(match);

      // Fix mute/unmute/solo/unsolo intent from generic rule
      if (rule.intent === 'mute') {
        const verb = match[1]?.toLowerCase();
        if (verb === 'unmute') intent = 'unmute';
        else if (verb === 'solo') intent = 'solo';
        else if (verb === 'unsolo') intent = 'unsolo';
      }
      // Fix freeze/unfreeze
      if (rule.intent === 'freeze') {
        if (match[1]?.toLowerCase() === 'unfreeze') intent = 'unfreeze';
      }
      // Fix transport
      if (rule.intent === 'play') {
        const action = params.action as string | undefined;
        if (action === 'stop') intent = 'stop';
        else if (action === 'record') intent = 'record';
      }

      return {
        intent,
        targets,
        params,
        confidence: 0.8,
        raw: trimmed,
      };
    }
  }

  // No match
  return {
    intent: 'unknown',
    targets: [],
    params: {},
    confidence: 0,
    raw: trimmed,
  };
}
