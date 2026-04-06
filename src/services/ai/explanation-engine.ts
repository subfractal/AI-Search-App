/**
 * Explanation Engine — generates human-readable explanations
 * for every AI decision. Template-based, no LLM.
 */

import type { AISuggestion, MasteringDecision } from '@/types/ai';

export interface AIExplanation {
  what: string;
  why: string;
  how: string;
  alternatives: string[];
}

/**
 * Explain an AI suggestion.
 */
export function explainSuggestion(suggestion: AISuggestion): AIExplanation {
  const what = suggestion.title;
  let why = suggestion.rationale ?? '';
  let how = '';
  const alternatives: string[] = [];

  switch (suggestion.type) {
    case 'level':
      why = why || 'The track level was outside the optimal range for a balanced mix.';
      how = 'Adjusted the track volume fader. You can manually override this in the mixer.';
      alternatives.push(
        'Use clip gain instead of track volume',
        'Add a limiter to control peaks',
      );
      break;

    case 'clipping':
      why = why || 'The signal exceeded 0 dBFS, causing digital clipping artifacts.';
      how = 'Reduced the track volume to bring peaks below clipping threshold.';
      alternatives.push(
        'Add a limiter before the clipping occurs',
        'Reduce input gain at the source',
      );
      break;

    case 'pan':
      why = why || 'Adjusting stereo placement helps separate instruments in the mix.';
      how = 'Changed the track pan position. You can adjust this manually on the channel strip.';
      alternatives.push(
        'Use stereo widening instead',
        'Apply mid-side processing',
      );
      break;

    case 'eq':
    case 'masking':
      why = why || 'Frequency masking was detected between tracks competing in the same range.';
      how = 'Applied EQ adjustments to carve out space. See the Effects Rack to tweak parameters.';
      alternatives.push(
        'Pan conflicting tracks apart',
        'Use sidechain ducking',
        'Adjust the clarity macro for automatic spectral ducking',
      );
      break;

    case 'compression':
      why = why || 'Dynamic range was inconsistent, making the track harder to sit in the mix.';
      how = 'Added compression. Adjust threshold, ratio, and attack in the Effects Rack.';
      alternatives.push(
        'Use parallel compression for more transparent results',
        'Try multiband compression for frequency-specific control',
      );
      break;

    case 'loudness':
    case 'gain-staging':
      why = why || 'Track levels were not optimally staged for the mix bus.';
      how = 'Adjusted gain to achieve proper headroom. Each track now peaks around -6 dBFS.';
      alternatives.push(
        'Set a different target level in AI settings',
        'Use clip gain for pre-fader adjustment',
      );
      break;

    default:
      why = why || suggestion.description;
      how = 'Applied through the AI suggestion engine. Check the Effects Rack or mixer to review.';
      alternatives.push('Reject the suggestion and make manual adjustments');
  }

  // Add evidence-based details
  if (suggestion.evidence && suggestion.evidence.length > 0) {
    const evidenceStr = suggestion.evidence
      .map((e) => `${e.label}: ${e.value}`)
      .join('; ');
    why += ` (Evidence: ${evidenceStr})`;
  }

  return { what, why, how, alternatives };
}

/**
 * Explain a mastering decision.
 */
export function explainDecision(decision: MasteringDecision): AIExplanation {
  const what = decision.description;
  let why = '';
  let how = '';
  const alternatives: string[] = [];

  switch (decision.stage) {
    case 'Gain Staging': {
      const vol = decision.params.volume;
      why = `The track's peak level needed adjustment to achieve proper headroom for the mix bus.`;
      how = `Set volume to ${vol !== undefined ? vol.toFixed(1) : '?'} dB. You can manually adjust this on the channel strip.`;
      alternatives.push(
        'Use clip gain for pre-fader control',
        'Adjust the gain staging target in settings',
      );
      break;
    }

    case 'EQ Balance': {
      why = 'The frequency balance was uneven compared to the target genre profile.';
      how = 'Applied a 3-band EQ. Adjust low/mid/high in the Effects Rack.';
      alternatives.push(
        'Use a different genre profile',
        'Apply EQ manually with a parametric EQ',
        'Use the Clarity macro for automatic spectral ducking',
      );
      break;
    }

    case 'Compression': {
      const threshold = decision.params.threshold;
      const ratio = decision.params.ratio;
      why = 'Dynamic range exceeded the target for the genre profile.';
      how = `Applied compressor with threshold ${threshold?.toFixed(1) ?? '?'} dB and ratio ${ratio?.toFixed(1) ?? '?'}:1. Tweak in Effects Rack.`;
      alternatives.push(
        'Use parallel compression for more transparent dynamics',
        'Try multiband compression for frequency-specific control',
        'Adjust the genre profile target',
      );
      break;
    }

    case 'Stereo': {
      why = 'Stereo width was adjusted to match the target genre profile.';
      how = 'Applied stereo imaging. Adjust width parameter in the Effects Rack.';
      alternatives.push(
        'Use mid-side EQ for frequency-dependent width',
        'Pan individual tracks instead',
      );
      break;
    }

    case 'Limiting': {
      why = 'Final output needed peak limiting to meet loudness standards.';
      how = 'Applied limiter to the master bus. Adjust threshold and release in Effects Rack.';
      alternatives.push(
        'Target a different streaming platform loudness standard',
        'Use a softer clipper instead of a limiter',
      );
      break;
    }

    default:
      why = 'Applied as part of the mastering pipeline.';
      how = 'Check the Effects Rack for the applied effect and its parameters.';
      alternatives.push('Revert this specific decision');
  }

  return { what, why, how, alternatives };
}

/**
 * Explain a specific effect parameter value.
 */
export function explainParameter(
  effectType: string,
  paramName: string,
  value: number,
): string {
  const explanations: Record<string, Record<string, (v: number) => string>> = {
    eq: {
      low: (v) => `Low band: ${v > 0 ? 'boosting' : 'cutting'} ${Math.abs(v).toFixed(1)} dB below 400 Hz`,
      mid: (v) => `Mid band: ${v > 0 ? 'boosting' : 'cutting'} ${Math.abs(v).toFixed(1)} dB at 400-2500 Hz`,
      high: (v) => `High band: ${v > 0 ? 'boosting' : 'cutting'} ${Math.abs(v).toFixed(1)} dB above 2500 Hz`,
    },
    compressor: {
      threshold: (v) => `Signals above ${v.toFixed(1)} dB are compressed. Lower = more compression.`,
      ratio: (v) => `${v.toFixed(1)}:1 ratio. Higher = more aggressive compression.`,
      attack: (v) => `${(v * 1000).toFixed(1)} ms attack. Shorter = catches transients faster.`,
      release: (v) => `${(v * 1000).toFixed(1)} ms release. Shorter = faster recovery.`,
    },
    reverb: {
      decay: (v) => `${v.toFixed(1)}s decay. Longer = more ambient, larger space.`,
      mix: (v) => `${Math.round(v * 100)}% wet. Higher = more reverb in the signal.`,
    },
    limiter: {
      threshold: (v) => `Limits peaks above ${v.toFixed(1)} dB. Lower = louder output.`,
    },
  };

  const typeExplanations = explanations[effectType];
  if (typeExplanations) {
    const paramExplanation = typeExplanations[paramName];
    if (paramExplanation) return paramExplanation(value);
  }

  return `${paramName}: ${value}`;
}
