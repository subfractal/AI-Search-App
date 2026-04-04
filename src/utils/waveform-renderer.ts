export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  buffer: AudioBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const halfHeight = height / 2;
  const centerY = y + halfHeight;

  // Draw waveform as filled shape — bold and saturated like Ableton/Logic
  ctx.beginPath();
  ctx.moveTo(x, centerY);

  // Top half
  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * step);
    let max = 0;
    for (let j = 0; j < step && start + j < data.length; j++) {
      const sample = data[start + j]!;
      if (sample > max) max = sample;
    }
    ctx.lineTo(x + i, centerY - max * halfHeight * 0.95);
  }

  // Bottom half (reverse)
  for (let i = width - 1; i >= 0; i--) {
    const start = Math.floor(i * step);
    let min = 0;
    for (let j = 0; j < step && start + j < data.length; j++) {
      const sample = data[start + j]!;
      if (sample < min) min = sample;
    }
    ctx.lineTo(x + i, centerY - min * halfHeight * 0.95);
  }

  ctx.closePath();
  ctx.fillStyle = color + 'bb';
  ctx.fill();

  // Draw waveform outline — crisp edge
  ctx.beginPath();
  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * step);
    let max = 0;
    for (let j = 0; j < step && start + j < data.length; j++) {
      const sample = Math.abs(data[start + j]!);
      if (sample > max) max = sample;
    }
    const top = centerY - max * halfHeight * 0.95;
    const bottom = centerY + max * halfHeight * 0.95;
    ctx.moveTo(x + i, top);
    ctx.lineTo(x + i, bottom);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  bpm: number,
  _timeSignature: number,
  pixelsPerSecond: number,
  scrollX: number,
  width: number,
  height: number,
): void {
  const beatInterval = 60 / bpm;
  const barInterval = beatInterval * 4;

  const startTime = scrollX / pixelsPerSecond;
  const endTime = startTime + width / pixelsPerSecond;

  // Draw bar/beat lines
  let t = Math.floor(startTime / beatInterval) * beatInterval;
  while (t <= endTime) {
    const px = (t - startTime) * pixelsPerSecond;
    const isBar = Math.abs(t % barInterval) < 0.001;

    ctx.strokeStyle = isBar ? '#2a2a2a' : '#1a1a1a';
    ctx.lineWidth = isBar ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 22);
    ctx.lineTo(px, height);
    ctx.stroke();

    t += beatInterval;
  }
}

const RULER_HEIGHT = 22;

export function drawRuler(
  ctx: CanvasRenderingContext2D,
  bpm: number,
  pixelsPerSecond: number,
  scrollX: number,
  width: number,
  beatsPerBar: number = 4,
): void {
  // Ruler background — darker, more distinct
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, RULER_HEIGHT);

  // Ruler bottom border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, RULER_HEIGHT);
  ctx.lineTo(width, RULER_HEIGHT);
  ctx.stroke();

  const beatInterval = 60 / bpm;
  const barInterval = beatInterval * beatsPerBar;

  const startTime = scrollX / pixelsPerSecond;
  const endTime = startTime + width / pixelsPerSecond;

  // Draw beat ticks and bar numbers
  let t = Math.floor(startTime / beatInterval) * beatInterval;
  while (t <= endTime) {
    const px = (t - startTime) * pixelsPerSecond;
    const isBar = Math.abs(t % barInterval) < 0.001;

    if (isBar) {
      // Bar tick — full height
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, RULER_HEIGHT);
      ctx.stroke();

      // Bar number — bold and visible
      const barNum = Math.round(t / barInterval) + 1;
      ctx.fillStyle = '#aaa';
      ctx.font = 'bold 10px Inter, system-ui, sans-serif';
      ctx.fillText(String(barNum), px + 4, 14);
    } else {
      // Beat tick — short
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 14);
      ctx.lineTo(px, RULER_HEIGHT);
      ctx.stroke();

      // Beat number within bar
      const beatInBar = Math.round((t % barInterval) / beatInterval) + 1;
      if (pixelsPerSecond > 80) {
        ctx.fillStyle = '#555';
        ctx.font = '8px Inter, system-ui, sans-serif';
        ctx.fillText(String(beatInBar), px + 2, 14);
      }
    }

    t += beatInterval;
  }
}

export { RULER_HEIGHT };

export function drawLoopRegion(
  ctx: CanvasRenderingContext2D,
  loopStart: number,
  loopEnd: number,
  pixelsPerSecond: number,
  scrollX: number,
  height: number,
): void {
  const startPx = loopStart * pixelsPerSecond - scrollX;
  const endPx = loopEnd * pixelsPerSecond - scrollX;

  // Loop region overlay — subtle tint
  ctx.fillStyle = 'rgba(255, 107, 53, 0.06)';
  ctx.fillRect(startPx, RULER_HEIGHT, endPx - startPx, height - RULER_HEIGHT);

  // Loop region ruler highlight
  ctx.fillStyle = 'rgba(255, 107, 53, 0.25)';
  ctx.fillRect(startPx, 0, endPx - startPx, RULER_HEIGHT);

  // Loop bracket lines
  ctx.strokeStyle = 'rgba(255, 107, 53, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startPx, 0);
  ctx.lineTo(startPx, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(endPx, 0);
  ctx.lineTo(endPx, height);
  ctx.stroke();

  // Loop markers in ruler — triangles
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.moveTo(startPx, 0);
  ctx.lineTo(startPx + 8, 0);
  ctx.lineTo(startPx, 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(endPx, 0);
  ctx.lineTo(endPx - 8, 0);
  ctx.lineTo(endPx, 8);
  ctx.closePath();
  ctx.fill();
}

export function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  positionSeconds: number,
  pixelsPerSecond: number,
  scrollX: number,
  height: number,
): void {
  const px = positionSeconds * pixelsPerSecond - scrollX;
  if (px < 0 || px > ctx.canvas.width) return;

  // Playhead line — crisp
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.stroke();

  // Playhead triangle — white like Logic Pro
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(px - 6, 0);
  ctx.lineTo(px + 6, 0);
  ctx.lineTo(px, 8);
  ctx.closePath();
  ctx.fill();
}
