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

  // Fill background
  ctx.fillStyle = color + '12';
  ctx.fillRect(x, y, width, height);

  // Draw waveform as filled shape
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
    ctx.lineTo(x + i, centerY - max * halfHeight * 0.9);
  }

  // Bottom half (reverse)
  for (let i = width - 1; i >= 0; i--) {
    const start = Math.floor(i * step);
    let min = 0;
    for (let j = 0; j < step && start + j < data.length; j++) {
      const sample = data[start + j]!;
      if (sample < min) min = sample;
    }
    ctx.lineTo(x + i, centerY - min * halfHeight * 0.9);
  }

  ctx.closePath();
  ctx.fillStyle = color + '55';
  ctx.fill();

  // Draw center line
  ctx.strokeStyle = color + '30';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x, centerY);
  ctx.lineTo(x + width, centerY);
  ctx.stroke();

  // Draw waveform outline
  ctx.beginPath();
  for (let i = 0; i < width; i++) {
    const start = Math.floor(i * step);
    let max = 0;
    for (let j = 0; j < step && start + j < data.length; j++) {
      const sample = Math.abs(data[start + j]!);
      if (sample > max) max = sample;
    }
    const top = centerY - max * halfHeight * 0.9;
    const bottom = centerY + max * halfHeight * 0.9;
    ctx.moveTo(x + i, top);
    ctx.lineTo(x + i, bottom);
  }
  ctx.strokeStyle = color + '88';
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

    ctx.strokeStyle = isBar ? '#383838' : '#222222';
    ctx.lineWidth = isBar ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(px, isBar ? 0 : 16);
    ctx.lineTo(px, height);
    ctx.stroke();

    // Bar numbers in ruler
    if (isBar) {
      ctx.fillStyle = '#666';
      ctx.font = '9px Inter, sans-serif';
      const barNum = Math.round(t / barInterval) + 1;
      ctx.fillText(String(barNum), px + 4, 11);
    }

    t += beatInterval;
  }
}

export function drawRuler(
  ctx: CanvasRenderingContext2D,
  bpm: number,
  pixelsPerSecond: number,
  scrollX: number,
  width: number,
  beatsPerBar: number = 4,
): void {
  // Ruler background
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, 0, width, 16);

  // Ruler bottom border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(width, 16);
  ctx.stroke();

  const beatInterval = 60 / bpm;
  const barInterval = beatInterval * beatsPerBar;

  const startTime = scrollX / pixelsPerSecond;
  const endTime = startTime + width / pixelsPerSecond;

  // Draw beat ticks
  let t = Math.floor(startTime / beatInterval) * beatInterval;
  while (t <= endTime) {
    const px = (t - startTime) * pixelsPerSecond;
    const isBar = Math.abs(t % barInterval) < 0.001;

    if (isBar) {
      // Bar tick — tall
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 4);
      ctx.lineTo(px, 16);
      ctx.stroke();

      // Bar number
      const barNum = Math.round(t / barInterval) + 1;
      ctx.fillStyle = '#999';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillText(String(barNum), px + 3, 11);
    } else {
      // Beat tick — short
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 11);
      ctx.lineTo(px, 16);
      ctx.stroke();
    }

    t += beatInterval;
  }
}

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

  // Loop region overlay
  ctx.fillStyle = 'rgba(255, 107, 53, 0.04)';
  ctx.fillRect(startPx, 16, endPx - startPx, height - 16);

  // Loop region ruler highlight
  ctx.fillStyle = 'rgba(255, 107, 53, 0.15)';
  ctx.fillRect(startPx, 0, endPx - startPx, 16);

  // Loop bracket lines
  ctx.strokeStyle = 'rgba(255, 107, 53, 0.5)';
  ctx.lineWidth = 1.5;
  // Left bracket
  ctx.beginPath();
  ctx.moveTo(startPx, 0);
  ctx.lineTo(startPx, height);
  ctx.stroke();
  // Right bracket
  ctx.beginPath();
  ctx.moveTo(endPx, 0);
  ctx.lineTo(endPx, height);
  ctx.stroke();

  // Loop markers in ruler
  ctx.fillStyle = '#ff6b35';
  // Left triangle
  ctx.beginPath();
  ctx.moveTo(startPx, 0);
  ctx.lineTo(startPx + 6, 0);
  ctx.lineTo(startPx, 6);
  ctx.closePath();
  ctx.fill();
  // Right triangle
  ctx.beginPath();
  ctx.moveTo(endPx, 0);
  ctx.lineTo(endPx - 6, 0);
  ctx.lineTo(endPx, 6);
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

  // Playhead line
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.stroke();

  // Playhead triangle
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.moveTo(px - 5, 0);
  ctx.lineTo(px + 5, 0);
  ctx.lineTo(px, 7);
  ctx.closePath();
  ctx.fill();

  // Subtle glow
  const gradient = ctx.createLinearGradient(px - 8, 0, px + 8, 0);
  gradient.addColorStop(0, 'rgba(255, 107, 53, 0)');
  gradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.06)');
  gradient.addColorStop(1, 'rgba(255, 107, 53, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(px - 8, 0, 16, height);
}
