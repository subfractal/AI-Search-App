import * as Tone from 'tone';
import type { Track, MidiClip } from '@/types/audio';
import { isMidiClip } from '@/types/audio';
import { triggerNote, triggerDrumSound, hasInstrument } from './instrument-service';
import { useInstrumentStore } from '@/stores/instrument-store';

const scheduledEvents = new Map<string, number[]>();

export function scheduleMidiClips(tracks: Track[]): void {
  clearAllScheduledMidi();

  for (const track of tracks) {
    if (track.mute) continue;
    if (!hasInstrument(track.id)) continue;

    const config = useInstrumentStore.getState().instruments[track.id];
    if (!config) continue;

    for (const clip of track.clips) {
      if (!isMidiClip(clip)) continue;
      scheduleMidiClip(track.id, clip, config.type === 'drum-machine');
    }
  }
}

function scheduleMidiClip(
  trackId: string,
  clip: MidiClip,
  isDrum: boolean,
): void {
  const events: number[] = [];
  const config = useInstrumentStore.getState().instruments[trackId];

  for (const note of clip.notes) {
    const startTime = clip.startTime + note.startTime;

    if (isDrum && config?.drumPattern) {
      const sound = config.drumPattern.sounds.find(
        (_s, i) => i === note.pitch % config.drumPattern!.sounds.length,
      );
      if (sound) {
        const eventId = Tone.getTransport().schedule((time) => {
          triggerDrumSound(trackId, sound.id, sound.params, time);
        }, startTime);
        events.push(eventId);
      }
    } else {
      const noteName = midiToFrequency(note.pitch);
      const eventId = Tone.getTransport().schedule((time) => {
        triggerNote(trackId, noteName, note.duration, time, note.velocity / 127);
      }, startTime);
      events.push(eventId);
    }
  }

  const existing = scheduledEvents.get(trackId) ?? [];
  scheduledEvents.set(trackId, [...existing, ...events]);
}

export function clearAllScheduledMidi(): void {
  for (const events of scheduledEvents.values()) {
    for (const eventId of events) {
      Tone.getTransport().clear(eventId);
    }
  }
  scheduledEvents.clear();
}

const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

function midiToFrequency(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12]!;
  return `${note}${octave}`;
}
