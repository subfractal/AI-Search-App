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

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.7;

  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * step);
    let min = 1.0;
    let max = -1.0;

    for (let j = 0; j < step && start + j < data.length; j++) {
      const sample = data[start + j]!;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    const top = y + halfHeight - max * halfHeight;
    const bottom = y + halfHeight - min * halfHeight;
    ctx.fillRect(x + i, top, 1, Math.max(1, bottom - top));
  }

  ctx.globalAlpha = 1.0;
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  bpm: number,
  _timeSignature: number,
  pixelsPerSecond: number,
  scrollX: number,
  width: number,
  height: number,
  gridColor: string,
): void {
  const beatInterval = 60 / bpm;
  const barInterval = beatInterval * 4;

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;

  const startTime = scrollX / pixelsPerSecond;
  const endTime = startTime + width / pixelsPerSecond;

  let t = Math.floor(startTime / beatInterval) * beatInterval;
  while (t <= endTime) {
    const px = (t - startTime) * pixelsPerSecond;
    const isBar = Math.abs(t % barInterval) < 0.001;

    ctx.globalAlpha = isBar ? 0.4 : 0.15;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height);
    ctx.stroke();

    if (isBar) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = gridColor;
      ctx.font = '10px JetBrains Mono, monospace';
      const barNum = Math.round(t / barInterval) + 1;
      ctx.fillText(String(barNum), px + 3, 12);
    }

    t += beatInterval;
  }
  ctx.globalAlpha = 1.0;
}

export function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  positionSeconds: number,
  pixelsPerSecond: number,
  scrollX: number,
  height: number,
  color: string,
): void {
  const px = positionSeconds * pixelsPerSecond - scrollX;
  if (px < 0 || px > ctx.canvas.width) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(px - 5, 0);
  ctx.lineTo(px + 5, 0);
  ctx.lineTo(px, 8);
  ctx.closePath();
  ctx.fill();
}
