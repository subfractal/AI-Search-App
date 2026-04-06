import { useRef, useEffect } from 'react';
import { getTrackLevel } from '@/services/track-manager';

interface PeakMeterProps {
  trackId: string;
  width?: number;
  height?: number;
  truePeakDb?: number;
}

export default function PeakMeter({
  trackId,
  width = 8,
  height = 100,
  truePeakDb,
}: PeakMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const peakHoldRef = useRef(0);
  const peakDecayRef = useRef(0);
  const lastDrawRef = useRef(0);
  const sizedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (now: number) => {
      if (now - lastDrawRef.current < 33) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDrawRef.current = now;

      if (!sizedRef.current) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        sizedRef.current = true;
      }

      // Dark background with subtle gradient
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      const db = getTrackLevel(trackId);
      const normalized = Math.max(0, Math.min(1, (db + 60) / 66));

      const segmentHeight = 2;
      const segmentGap = 1;
      const totalSegments = Math.floor(height / (segmentHeight + segmentGap));
      const filledSegments = Math.floor(normalized * totalSegments);

      for (let i = 0; i < totalSegments; i++) {
        const segY = height - (i + 1) * (segmentHeight + segmentGap);
        const ratio = i / totalSegments;

        if (i < filledSegments) {
          if (ratio > 0.92) {
            ctx.fillStyle = '#E63946';
          } else if (ratio > 0.75) {
            ctx.fillStyle = '#F77F00';
          } else {
            ctx.fillStyle = '#D1D1D1';
          }
        } else {
          // Dimmed segments for visual depth
          ctx.fillStyle = ratio > 0.92
            ? 'rgba(230,57,70,0.06)'
            : ratio > 0.75
              ? 'rgba(247,127,0,0.04)'
              : 'rgba(209,209,209,0.04)';
        }

        ctx.fillRect(1, segY, width - 2, segmentHeight);
      }

      // Peak hold
      if (normalized > peakHoldRef.current) {
        peakHoldRef.current = normalized;
        peakDecayRef.current = 60;
      }

      if (peakDecayRef.current > 0) {
        peakDecayRef.current--;
      } else {
        peakHoldRef.current = Math.max(peakHoldRef.current - 0.01, normalized);
      }

      if (peakHoldRef.current > 0.02) {
        const peakY = height - peakHoldRef.current * height;
        ctx.fillStyle = peakHoldRef.current > 0.92 ? '#E63946' : 'rgba(255,255,255,0.7)';
        ctx.fillRect(1, peakY, width - 2, 1);
      }

      // True peak indicator
      if (truePeakDb !== undefined && truePeakDb > -60) {
        const tpNorm = Math.max(0, Math.min(1, (truePeakDb + 60) / 66));
        const tpY = height - tpNorm * height;
        ctx.fillStyle = truePeakDb > -1 ? '#E63946' : '#F77F00';
        ctx.fillRect(0, tpY, width, 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    sizedRef.current = false;
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackId, width, height, truePeakDb]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className=""
    />
  );
}
