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

  // --- Arrangement commands ---

  // "make the chorus hit harder" / "make the chorus louder" / "boost the chorus"
  {
    pattern: /(?:make\s+(?:the\s+)?(.+?)\s+(?:hit\s+harder|punch(?:ier)?|more\s+powerful|slam|bang)|boost\s+(?:the\s+)?(.+?)\s+(?:section|energy|volume|level))/i,
    intent: 'boostSection',
    extract: (m) => ({
      targets: [],
      params: { section: (m[1] ?? m[2] ?? 'chorus').toLowerCase() },
    }),
  },

  // "thin out before the drop" / "strip back before the chorus"
  {
    pattern: /(?:thin\s+(?:out|it)\s+(?:before|leading\s+into)|strip\s+(?:back|down)\s+(?:before|leading\s+into)|reduce\s+(?:tracks?|instruments?|layers?)\s+(?:before|leading\s+into))\s+(?:the\s+)?(.+)/i,
    intent: 'thinSection',
    extract: (m) => ({
      targets: [],
      params: { section: (m[1] ?? 'drop').toLowerCase() },
    }),
  },

  // "add a breakdown after the verse" / "insert breakdown before chorus"
  {
    pattern: /(?:add|insert|put)\s+(?:a\s+)?breakdown\s+(?:after|before|between)\s+(?:the\s+)?(.+)/i,
    intent: 'addBreakdown',
    extract: (m) => ({
      targets: [],
      params: { section: (m[1] ?? 'verse').toLowerCase() },
    }),
  },

  // "extend the intro by 4 bars" / "make the intro longer by 8 bars"
  {
    pattern: /(?:extend|lengthen|stretch|make\s+(?:the\s+)?(.+?)\s+longer)\s+(?:the\s+)?(.+?)?\s*(?:by\s+)?(\d+)\s*bars?/i,
    intent: 'extendSection',
    extract: (m) => ({
      targets: [],
      params: {
        section: (m[1] ?? m[2] ?? 'intro').toLowerCase().trim(),
        bars: parseInt(m[3]!, 10),
      },
    }),
  },

  // "make the outro fade out" / "fade out the ending" / "add fadeout to outro"
  {
    pattern: /(?:(?:make|have)\s+(?:the\s+)?(?:outro|ending|end)\s+fade\s*out|fade\s*out\s+(?:the\s+)?(?:outro|ending|end)|add\s+(?:a\s+)?fade\s*out\s+(?:to|on)\s+(?:the\s+)?(?:outro|ending|end))/i,
    intent: 'fadeOutro',
    extract: () => ({
      targets: [],
      params: { section: 'outro' },
    }),
  },

  // "double the chorus" / "duplicate the chorus" / "repeat the chorus"
  {
    pattern: /(?:double|duplicate|repeat|copy)\s+(?:the\s+)?(.+?)(?:\s+section)?$/i,
    intent: 'duplicateSection',
    extract: (m) => ({
      targets: [],
      params: { section: (m[1] ?? 'chorus').toLowerCase() },
    }),
  },

  // "add energy buildup" / "build energy before the drop" / "add a riser"
  {
    pattern: /(?:add\s+(?:an?\s+)?(?:energy\s+)?(?:build\s*up|riser|sweep)|build\s+(?:up\s+)?energy(?:\s+before\s+(?:the\s+)?(.+))?|add\s+(?:a\s+)?(?:rising|build)\s+(?:filter|tension|energy))/i,
    intent: 'energyBuildup',
    extract: (m) => ({
      targets: [],
      params: { section: (m[1] ?? 'drop').toLowerCase() },
    }),
  },

  // --- Mix commands ---

  // "make the vocals brighter" / "brighten the vocals" / "add brightness to vocals"
  {
    pattern: /(?:make\s+(?:the\s+)?(.+?)\s+(?:brighter|crisper|airier|more\s+airy)|brighten\s+(?:the\s+)?(.+)|add\s+(?:more\s+)?(?:brightness|air|sparkle|shimmer)\s+(?:to|on)\s+(?:the\s+)?(.+))/i,
    intent: 'eqBoost',
    extract: (m) => ({
      targets: [parseTarget(m[1] ?? m[2] ?? m[3] ?? 'vocals')],
      params: { band: 'high', freqLow: 3000, freqHigh: 16000, gain: 3 },
    }),
  },

  // "add more bass" / "boost the bass" / "more low end" / "more bottom"
  {
    pattern: /(?:add\s+(?:more\s+)?bass|boost\s+(?:the\s+)?(?:bass|low\s*end|bottom|sub)|more\s+(?:bass|low\s*end|bottom|sub))/i,
    intent: 'eqBoost',
    extract: () => ({
      targets: [parseTarget('bass')],
      params: { band: 'low', freqLow: 40, freqHigh: 250, gain: 3 },
    }),
  },

  // "widen the stereo" / "spread it out" / "make it wider" / "more stereo width"
  {
    pattern: /(?:widen\s+(?:the\s+)?(?:stereo|mix|sound)|(?:more|add)\s+(?:stereo\s+)?(?:width|spread)|make\s+(?:it|the\s+mix)\s+wider|spread\s+(?:it|the\s+mix)\s+out)/i,
    intent: 'widenStereo',
    extract: () => ({
      targets: [parseTarget('all')],
      params: {},
    }),
  },

  // "reduce muddiness" / "clean up the mud" / "less muddy"
  {
    pattern: /(?:reduce\s+(?:the\s+)?(?:muddiness|mud)|clean\s+(?:up\s+)?(?:the\s+)?(?:mud|muddiness|low\s*mids)|(?:less|cut\s+the)\s+(?:mud|muddiness)|(?:it(?:'s)?|sounds?)\s+(?:too\s+)?muddy)/i,
    intent: 'reduceMuddiness',
    extract: () => ({
      targets: [parseTarget('all')],
      params: { freqLow: 200, freqHigh: 500, cut: -3 },
    }),
  },

  // "tighten the low end" / "clean up the bass" / "tighter bass"
  {
    pattern: /(?:tighten\s+(?:the\s+)?(?:low\s*end|bass|bottom)|(?:tighter|cleaner)\s+(?:low\s*end|bass|bottom)|clean\s+up\s+(?:the\s+)?(?:low\s*end|bass|bottom))/i,
    intent: 'tightenLowEnd',
    extract: () => ({
      targets: [parseTarget('all')],
      params: { highPassFreq: 80 },
    }),
  },

  // "make it louder" / "it's too quiet" / "turn it up" / "louder"
  {
    pattern: /(?:make\s+(?:it|everything|the\s+mix)\s+louder|(?:it(?:'s)?|sounds?)\s+too\s+quiet|turn\s+(?:it|everything)\s+up|^louder$|needs?\s+(?:to\s+be\s+)?(?:more\s+)?(?:louder|loud|volume))/i,
    intent: 'gainStaging',
    extract: () => ({
      targets: [],
      params: { mode: 'boost' },
    }),
  },

  // "add warmth" / "make it warmer" / "more warmth"
  {
    pattern: /(?:add\s+(?:more\s+)?warmth|make\s+(?:it|the\s+mix)\s+warmer|more\s+warmth|warmer\s+(?:sound|tone|mix))/i,
    intent: 'addWarmth',
    extract: () => ({
      targets: [parseTarget('all')],
      params: { band: 'lowMid', freqLow: 200, freqHigh: 500, gain: 2 },
    }),
  },

  // "reduce harshness" / "less harsh" / "too harsh" / "it's harsh"
  {
    pattern: /(?:reduce\s+(?:the\s+)?harshness|(?:less|cut\s+the)\s+harshness|(?:it(?:'s)?|sounds?)\s+(?:too\s+)?harsh|tame\s+(?:the\s+)?(?:highs?|harshness)|de-?harsh)/i,
    intent: 'reduceHarshness',
    extract: () => ({
      targets: [parseTarget('all')],
      params: { freqLow: 2000, freqHigh: 5000, cut: -3 },
    }),
  },

  // "compress the drums" / "add compression to drums" / "squash the drums"
  {
    pattern: /(?:compress\s+(?:the\s+)?(.+)|add\s+(?:more\s+)?compression\s+(?:to|on)\s+(?:the\s+)?(.+)|squash\s+(?:the\s+)?(.+))/i,
    intent: 'compressTracks',
    extract: (m) => ({
      targets: [parseTarget(m[1] ?? m[2] ?? m[3] ?? 'drums')],
      params: { threshold: -18, ratio: 4, attack: 0.01, release: 0.15 },
    }),
  },

  // --- Session commands ---

  // "balance the levels" / "level the tracks" / "balance the mix"
  {
    pattern: /(?:balance\s+(?:the\s+)?(?:levels?|tracks?|mix|volumes?)|level\s+(?:the\s+)?(?:tracks?|mix)|auto\s*(?:-?\s*)?(?:gain|level))/i,
    intent: 'balanceLevels',
    extract: () => ({ targets: [], params: {} }),
  },

  // "check for problems" / "find issues" / "any problems?"
  {
    pattern: /(?:check\s+(?:for\s+)?(?:problems?|issues?|errors?)|find\s+(?:any\s+)?(?:problems?|issues?|errors?)|(?:any|are\s+there)\s+(?:problems?|issues?))/i,
    intent: 'engineeringScan',
    extract: () => ({ targets: [], params: {} }),
  },

  // "scan the session" / "scan the project" / "run a scan"
  {
    pattern: /(?:scan\s+(?:the\s+)?(?:session|project|mix|tracks?)|run\s+(?:a\s+)?(?:session\s+)?scan)/i,
    intent: 'sessionScan',
    extract: () => ({ targets: [], params: {} }),
  },

  // "compare to reference" / "match the reference" / "reference match"
  {
    pattern: /(?:compare\s+(?:to|with|against)\s+(?:the\s+)?reference|match\s+(?:the\s+)?reference|reference\s+match(?:ing)?|use\s+(?:a\s+)?reference)/i,
    intent: 'referenceMatch',
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
