import { useRef, useEffect, useCallback } from 'react';
import { getTrackLevel } from '@/services/track-manager';

interface PeakMeterProps {
  trackId: string;
  width?: number;
  height?: number;
}

export default function PeakMeter({
  trackId,
  width = 12,
  height = 120,
}: PeakMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);

    const db = getTrackLevel(trackId);
    const normalized = Math.max(0, Math.min(1, (db + 60) / 66));
    const meterHeight = normalized * height;

    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#4ade80');
    gradient.addColorStop(0.6, '#4ade80');
    gradient.addColorStop(0.8, '#facc15');
    gradient.addColorStop(1.0, '#ef4444');

    ctx.fillStyle = gradient;
    ctx.fillRect(1, height - meterHeight, width - 2, meterHeight);

    rafRef.current = requestAnimationFrame(draw);
  }, [trackId, width, height]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-sm"
    />
  );
}
