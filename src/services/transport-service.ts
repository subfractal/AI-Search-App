import * as Tone from 'tone';
import { initAudioContext } from './audio-engine';

export async function play(): Promise<void> {
  await initAudioContext();
  Tone.getTransport().start();
}

export function pause(): void {
  Tone.getTransport().pause();
}

export function stop(): void {
  Tone.getTransport().stop();
  Tone.getTransport().position = 0;
}

export function setBpm(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}

export function getBpm(): number {
  return Tone.getTransport().bpm.value;
}

export function setLoop(start: number, end: number, enabled: boolean): void {
  const transport = Tone.getTransport();
  transport.loop = enabled;
  transport.loopStart = start;
  transport.loopEnd = end;
}

export function getPositionSeconds(): number {
  return Tone.getTransport().seconds;
}

export function seekTo(time: number): void {
  Tone.getTransport().seconds = time;
}

export function getTransportState(): 'started' | 'stopped' | 'paused' {
  return Tone.getTransport().state;
}

export function scheduleEvent(
  callback: (time: number) => void,
  time: number,
): number {
  return Tone.getTransport().schedule(callback, time);
}

export function clearEvent(eventId: number): void {
  Tone.getTransport().clear(eventId);
}
