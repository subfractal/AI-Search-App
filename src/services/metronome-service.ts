import * as Tone from 'tone';

let clickHigh: Tone.Synth | null = null;
let clickLow: Tone.Synth | null = null;
let eventId: number | null = null;
let enabled = false;

function ensureSynths() {
  if (!clickHigh) {
    clickHigh = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -12,
    }).toDestination();
  }
  if (!clickLow) {
    clickLow = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
      volume: -16,
    }).toDestination();
  }
}

export function startMetronome(beatsPerBar: number = 4): void {
  if (eventId !== null) return;
  ensureSynths();
  enabled = true;

  let beatCount = 0;
  eventId = Tone.getTransport().scheduleRepeat((time) => {
    if (!enabled) return;
    const isDownbeat = beatCount % beatsPerBar === 0;
    if (isDownbeat) {
      clickHigh?.triggerAttackRelease('C6', '32n', time);
    } else {
      clickLow?.triggerAttackRelease('C5', '32n', time);
    }
    beatCount++;
  }, '4n');
}

export function stopMetronome(): void {
  enabled = false;
  if (eventId !== null) {
    Tone.getTransport().clear(eventId);
    eventId = null;
  }
}

export function isMetronomeEnabled(): boolean {
  return enabled;
}

export function setMetronomeEnabled(on: boolean, beatsPerBar: number = 4): void {
  if (on && !enabled) {
    startMetronome(beatsPerBar);
  } else if (!on && enabled) {
    stopMetronome();
  }
}
