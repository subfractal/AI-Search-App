import { useRef, useEffect, useCallback, useState } from 'react';
import type { AutomationLane as AutomationLaneType } from '@/types/automation';
import { useAutomationStore } from '@/stores/automation-store';
import { getValueAtTime } from '@/services/automation-service';

interface AutomationLaneProps {
  lane: AutomationLaneType;
  trackId: string;
  width: number;
  height: number;
  pixelsPerSecond: number;
  scrollX: number;
}

const POINT_RADIUS = 5;
const HIT_RADIUS = 8;

export default function AutomationLane({
  lane,
  trackId,
  width,
  height,
  pixelsPerSecond,
  scrollX,
}: AutomationLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { addPoint, updatePoint, removePoint } = useAutomationStore();

  const timeToX = useCallback(
    (time: number) => time * pixelsPerSecond - scrollX,
    [pixelsPerSecond, scrollX],
  );

  const xToTime = useCallback(
    (x: number) => (x + scrollX) / pixelsPerSecond,
    [pixelsPerSecond, scrollX],
  );

  const valueToY = useCallback(
    (value: number) => height - value * height,
    [height],
  );

  const yToValue = useCallback(
    (y: number) => Math.max(0, Math.min(1, 1 - y / height)),
    [height],
  );

  const findPointAtPosition = useCallback(
    (x: number, y: number): number | null => {
      for (let i = 0; i < lane.points.length; i++) {
        const point = lane.points[i]!;
        const px = timeToX(point.time);
        const py = valueToY(point.value);
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (dist <= HIT_RADIUS) return i;
      }
      return null;
    },
    [lane.points, timeToX, valueToY],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Horizontal guide lines at 25%, 50%, 75%
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    for (const frac of [0.25, 0.5, 0.75]) {
      const y = valueToY(frac);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw automation curve
    if (lane.points.length > 0) {
      ctx.strokeStyle = lane.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      // Extend line from left edge to first point
      const first = lane.points[0]!;
      const firstX = timeToX(first.time);
      ctx.moveTo(0, valueToY(first.value));
      ctx.lineTo(firstX, valueToY(first.value));

      // Draw segments between points
      for (let i = 0; i < lane.points.length; i++) {
        const point = lane.points[i]!;
        const px = timeToX(point.time);
        const py = valueToY(point.value);

        if (i === 0) {
          ctx.lineTo(px, py);
        } else {
          const prev = lane.points[i - 1]!;
          if (prev.curve === 'step') {
            ctx.lineTo(px, valueToY(prev.value));
            ctx.lineTo(px, py);
          } else if (prev.curve === 'exponential') {
            // Approximate exponential with small segments
            const steps = 20;
            for (let s = 1; s <= steps; s++) {
              const t =
                prev.time + (point.time - prev.time) * (s / steps);
              const v = getValueAtTime(lane, t);
              ctx.lineTo(timeToX(t), valueToY(v));
            }
          } else {
            ctx.lineTo(px, py);
          }
        }
      }

      // Extend line from last point to right edge
      const last = lane.points[lane.points.length - 1]!;
      ctx.lineTo(width, valueToY(last.value));
      ctx.stroke();

      // Fill area under curve
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = lane.color + '10';
      ctx.fill();

      // Draw points
      for (let i = 0; i < lane.points.length; i++) {
        const point = lane.points[i]!;
        const px = timeToX(point.time);
        const py = valueToY(point.value);

        const isHovered = hoverIndex === i;
        const isDragging = draggingIndex === i;
        const radius = isHovered || isDragging
          ? POINT_RADIUS + 2
          : POINT_RADIUS;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDragging
          ? '#ffffff'
          : isHovered
            ? lane.color
            : lane.color + 'cc';
        ctx.fill();
        ctx.strokeStyle = '#ffffff44';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Label
    ctx.fillStyle = lane.color + '99';
    ctx.font = '10px Inter, sans-serif';
    const label = lane.paramName
      ? `${lane.target}: ${lane.paramName}`
      : lane.target;
    ctx.fillText(label, 4, 12);
  }, [
    lane, width, height, timeToX, valueToY, hoverIndex, draggingIndex,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const pointIndex = findPointAtPosition(x, y);

      if (e.button === 2) {
        // Right-click to delete
        e.preventDefault();
        if (pointIndex !== null) {
          removePoint(trackId, lane.id, pointIndex);
        }
        return;
      }

      if (pointIndex !== null) {
        setDraggingIndex(pointIndex);
      } else {
        // Click empty space to add
        const time = xToTime(x);
        const value = yToValue(y);
        addPoint(trackId, lane.id, {
          time: Math.max(0, time),
          value,
          curve: 'linear',
        });
      }
    },
    [findPointAtPosition, trackId, lane.id, xToTime, yToValue,
      addPoint, removePoint],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (draggingIndex !== null) {
        const time = Math.max(0, xToTime(x));
        const value = yToValue(y);
        updatePoint(trackId, lane.id, draggingIndex, { time, value });
      } else {
        const pointIndex = findPointAtPosition(x, y);
        setHoverIndex(pointIndex);
      }
    },
    [draggingIndex, trackId, lane.id, xToTime, yToValue,
      updatePoint, findPointAtPosition],
  );

  const handleMouseUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="relative border-b border-daw-border">
      <canvas
        ref={canvasRef}
        className="block cursor-crosshair"
        style={{ width, height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
