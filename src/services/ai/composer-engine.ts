import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { generateId } from '@/utils/id';
import type { ComposerResult, GeneratorModel } from '@/types/ai';
import type { MidiClip, MidiNote } from '@/types/audio';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

function createRng(seed: number): () => number {
  let s = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)] ?? items[0]!;
}

function generateNotes(
  model: GeneratorModel,
  bars: number,
  density: number,
  temperature: number,
  seed: number,
): MidiNote[] {
  const rng = createRng(seed);
  const beatsTotal = bars * 4;
  const scale = rng() > 0.5 ? MAJOR : MINOR;
  const root = pick(rng, [48, 50, 52, 53, 55, 57, 59]);
  const notes: MidiNote[] = [];
  let time = 0;
  let prevDegree = 0;

  while (time < beatsTotal) {
    const durPool = density > 0.7 ? [0.25, 0.5, 0.5, 1] : [0.5, 1, 1, 2];
    const duration = Math.min(pick(rng, durPool), beatsTotal - time);
    const gate = rng();

    if (gate < clamp01(density + 0.15)) {
      let degree = prevDegree;

      switch (model) {
        case 'markov': {
          const transitions: Record<number, number[]> = {
            0: [0, 2, 4],
            1: [0, 2, 4],
            2: [1, 3, 4],
            3: [2, 4, 5],
            4: [0, 2, 5],
            5: [0, 3, 4],
            6: [4, 5, 0],
          };
          degree = pick(rng, transitions[prevDegree % 7] ?? [0, 2, 4]);
          break;
        }
        case 'lstm':
          degree = (prevDegree + pick(rng, [0, 1, -1, 2])) % 7;
          break;
        case 'vae':
          degree = Math.floor(rng() * 7 * clamp01(temperature + 0.4)) % 7;
          break;
        case 'gan':
          degree = pick(rng, [0, 2, 4, 5, 6]);
          break;
        case 'evolutionary':
          degree = (prevDegree + pick(rng, [-2, -1, 1, 2, 3])) % 7;
          break;
        case 'diffusion':
          degree = Math.floor(rng() * 7);
          break;
      }

      if (degree < 0) degree += 7;
      const octave = model === 'diffusion' && rng() > 0.7 ? 12 : 0;
      const pitch = root + scale[degree]! + octave;
      const velocityBase = model === 'gan' ? 96 : 82;
      const velocity = Math.max(40, Math.min(120, Math.round(velocityBase + (rng() - 0.5) * 40 * (temperature + 0.2))));
      notes.push({ pitch, velocity, startTime: time, duration });
      prevDegree = degree;
    }

    time += duration;
  }

  if (model === 'evolutionary' && notes.length > 4) {
    for (let i = 1; i < notes.length; i += 4) {
      notes[i] = { ...notes[i]!, pitch: notes[i]!.pitch + (rng() > 0.5 ? 2 : -2) };
    }
  }

  return notes.sort((a, b) => a.startTime - b.startTime);
}

export function generateComposition(): ComposerResult | null {
  const session = useSessionStore.getState();
  const ai = useAIStore.getState();
  const settings = ai.composer;

  let trackId: string = session.selectedTrackId ?? '';
  const selected = trackId ? session.tracks.find((t) => t.id === trackId) ?? null : null;

  if (!selected || selected.type !== 'midi') {
    trackId = session.addMidiTrack(`AI ${settings.model.toUpperCase()}`);
  }

  const notes = generateNotes(
    settings.model,
    settings.bars,
    settings.density,
    settings.temperature,
    settings.seed,
  );

  const clip: MidiClip = {
    id: generateId('clip'),
    trackId,
    name: `AI ${settings.model}`,
    notes,
    startTime: 0,
    duration: settings.bars * 4,
  };

  session.addClipToTrack(trackId, clip);

  return {
    trackId,
    clipId: clip.id,
    noteCount: notes.length,
    model: settings.model,
    bars: settings.bars,
  };
}
