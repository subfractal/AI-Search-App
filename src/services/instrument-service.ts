import * as Tone from 'tone';
import type {
  InstrumentType,
  SynthParams,
  DrumSynthParams,
} from '@/types/instruments';
import { DEFAULT_SYNTH_PARAMS } from '@/types/instruments';
import { getTrackNodes } from './track-manager';

interface TrackInstrument {
  type: InstrumentType;
  synth: Tone.PolySynth | Tone.MonoSynth | null;
  drumSynths: Map<string, { synth: Tone.MembraneSynth; noise: Tone.NoiseSynth | null }>;
  params: SynthParams;
}

const trackInstruments = new Map<string, TrackInstrument>();

export function createInstrument(
  trackId: string,
  type: InstrumentType,
  params?: SynthParams,
): void {
  disposeInstrument(trackId);

  const node = getTrackNodes(trackId);
  if (!node) return;

  const synthParams = params ?? DEFAULT_SYNTH_PARAMS;

  const instrument: TrackInstrument = {
    type,
    synth: null,
    drumSynths: new Map(),
    params: synthParams,
  };

  if (type === 'drum-machine') {
    // Drum synths are created on-demand
  } else {
    const synth = createSynthNode(type, synthParams);
    synth.connect(node.channel);
    instrument.synth = synth;
  }

  trackInstruments.set(trackId, instrument);
}

function createSynthNode(
  type: InstrumentType,
  params: SynthParams,
): Tone.PolySynth | Tone.MonoSynth {
  const envelope = {
    attack: params.attack,
    decay: params.decay,
    sustain: params.sustain,
    release: params.release,
  };

  if (type === 'mono-synth') {
    return new Tone.MonoSynth({
      oscillator: { type: params.oscillator },
      filter: {
        type: params.filterType,
        frequency: params.filterFrequency,
        Q: params.filterResonance,
      },
      envelope,
      filterEnvelope: {
        attack: params.attack,
        decay: params.decay,
        sustain: 0.5,
        release: params.release,
        baseFrequency: 200,
        octaves: 4,
      },
    });
  }

  let synthType: 'Synth' | 'FMSynth' | 'AMSynth' = 'Synth';
  if (type === 'fm-synth') synthType = 'FMSynth';
  if (type === 'am-synth') synthType = 'AMSynth';

  const options: Record<string, unknown> = {
    oscillator: { type: params.oscillator },
    envelope,
  };

  if (synthType === 'Synth') {
    return new Tone.PolySynth(Tone.Synth, options);
  } else if (synthType === 'FMSynth') {
    return new Tone.PolySynth(Tone.FMSynth, options);
  } else {
    return new Tone.PolySynth(Tone.AMSynth, options);
  }
}

export function updateSynthParams(
  trackId: string,
  params: Partial<SynthParams>,
): void {
  const instrument = trackInstruments.get(trackId);
  if (!instrument || !instrument.synth) return;

  Object.assign(instrument.params, params);

  // Recreate synth with new params
  const node = getTrackNodes(trackId);
  if (!node) return;

  instrument.synth.dispose();
  const newSynth = createSynthNode(instrument.type, instrument.params);
  newSynth.connect(node.channel);
  instrument.synth = newSynth;
}

export function triggerNote(
  trackId: string,
  note: string,
  duration: string | number,
  time?: number,
  velocity: number = 0.8,
): void {
  const instrument = trackInstruments.get(trackId);
  if (!instrument) return;

  if (instrument.synth) {
    if (instrument.synth instanceof Tone.MonoSynth) {
      instrument.synth.triggerAttackRelease(note, duration, time, velocity);
    } else {
      instrument.synth.triggerAttackRelease(note, duration, time, velocity);
    }
  }
}

export function triggerDrumSound(
  trackId: string,
  soundId: string,
  drumParams: DrumSynthParams,
  time?: number,
): void {
  const instrument = trackInstruments.get(trackId);
  if (!instrument) return;

  const node = getTrackNodes(trackId);
  if (!node) return;

  // Create drum synth on-demand and cache it
  let drumEntry = instrument.drumSynths.get(soundId);
  if (!drumEntry) {
    const synth = new Tone.MembraneSynth({
      pitchDecay: drumParams.pitchDecay,
      octaves: drumParams.pitchDecay > 0 ? 4 : 1,
      envelope: {
        attack: 0.001,
        decay: drumParams.decay,
        sustain: 0,
        release: drumParams.decay * 0.5,
      },
    });
    synth.connect(node.channel);

    let noise: Tone.NoiseSynth | null = null;
    if (drumParams.noise) {
      noise = new Tone.NoiseSynth({
        noise: { type: drumParams.noiseType },
        envelope: {
          attack: 0.001,
          decay: drumParams.decay * 0.8,
          sustain: 0,
          release: 0.01,
        },
      });
      noise.connect(node.channel);
    }

    drumEntry = { synth, noise };
    instrument.drumSynths.set(soundId, drumEntry);
  }

  const t = time ?? Tone.now();
  drumEntry.synth.triggerAttackRelease(
    drumParams.frequency,
    drumParams.decay,
    t,
  );
  if (drumEntry.noise) {
    drumEntry.noise.triggerAttackRelease(drumParams.decay * 0.8, t);
  }
}

export function getInstrument(trackId: string): TrackInstrument | undefined {
  return trackInstruments.get(trackId);
}

export function hasInstrument(trackId: string): boolean {
  return trackInstruments.has(trackId);
}

export function disposeInstrument(trackId: string): void {
  const instrument = trackInstruments.get(trackId);
  if (!instrument) return;

  instrument.synth?.dispose();
  for (const entry of instrument.drumSynths.values()) {
    entry.synth.dispose();
    entry.noise?.dispose();
  }
  trackInstruments.delete(trackId);

  // Clean up analyser
  const analyser = trackAnalysers.get(trackId);
  if (analyser) {
    analyser.disconnect();
    trackAnalysers.delete(trackId);
  }
}

// --- Analyser nodes for oscilloscope display ---
const trackAnalysers = new Map<string, AnalyserNode>();

export function getAnalyserNode(trackId: string): AnalyserNode | null {
  const existing = trackAnalysers.get(trackId);
  if (existing) return existing;

  const node = getTrackNodes(trackId);
  if (!node) return null;

  // Access the raw Web Audio context and create an AnalyserNode
  const ctx = Tone.getContext().rawContext;
  if (!ctx) return null;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;

  // Connect the Tone.js channel to the analyser
  Tone.connect(node.channel, analyser);
  trackAnalysers.set(trackId, analyser);
  return analyser;
}
