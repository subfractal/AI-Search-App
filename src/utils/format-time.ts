export function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export function formatBarsBeats(
  seconds: number,
  bpm: number,
  numerator: number,
): string {
  const beatsPerSecond = bpm / 60;
  const totalBeats = seconds * beatsPerSecond;
  const bars = Math.floor(totalBeats / numerator) + 1;
  const beats = Math.floor(totalBeats % numerator) + 1;
  const ticks = Math.floor((totalBeats % 1) * 100);
  return `${bars}.${beats}.${String(ticks).padStart(2, '0')}`;
}
