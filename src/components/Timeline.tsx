import { useRef, useEffect, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import { getPositionSeconds, seekTo } from '@/services/transport-service';
import { isAudioClip } from '@/types/audio';
import {
  drawWaveform,
  drawGrid,
  drawPlayhead,
} from '@/utils/waveform-renderer';

const TRACK_HEIGHT = 80;
const PIXELS_PER_SECOND = 100;

export default function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [scrollX, setScrollX] = useState(0);
  const [zoom, setZoom] = useState(1);

  const tracks = useSessionStore((s) => s.tracks);
  const bpm = useTransportStore((s) => s.bpm);

  const pps = PIXELS_PER_SECOND * zoom;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, bpm, 4, pps, scrollX, width, height, '#2a3a5c');

    tracks.forEach((track, index) => {
      const y = index * TRACK_HEIGHT;

      if (index % 2 === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, y, width, TRACK_HEIGHT);
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(0, y + TRACK_HEIGHT);
      ctx.lineTo(width, y + TRACK_HEIGHT);
      ctx.stroke();

      track.clips.forEach((clip) => {
        const clipX = clip.startTime * pps - scrollX;
        const clipW = clip.duration * pps;

        if (clipX + clipW < 0 || clipX > width) return;

        ctx.fillStyle = track.color + '33';
        ctx.fillRect(clipX, y + 2, clipW, TRACK_HEIGHT - 4);

        ctx.strokeStyle = track.color + '88';
        ctx.lineWidth = 1;
        ctx.strokeRect(clipX, y + 2, clipW, TRACK_HEIGHT - 4);

        if (isAudioClip(clip)) {
          drawWaveform(
            ctx,
            clip.buffer,
            clipX,
            y + 2,
            clipW,
            TRACK_HEIGHT - 4,
            track.color,
          );
        } else {
          clip.notes.forEach((note) => {
            const noteX = clipX + note.startTime * pps;
            const noteW = note.duration * pps;
            const noteY = y + TRACK_HEIGHT - 4 -
              ((note.pitch / 127) * (TRACK_HEIGHT - 8));
            ctx.fillStyle = track.color;
            ctx.fillRect(noteX, noteY, Math.max(2, noteW), 3);
          });
        }

        ctx.fillStyle = '#ffffffcc';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(clip.name, clipX + 4, y + 14);
      });
    });

    const position = getPositionSeconds();
    drawPlayhead(ctx, position, pps, scrollX, height, '#e94560');

    rafRef.current = requestAnimationFrame(draw);
  }, [tracks, bpm, pps, scrollX]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.max(0.1, Math.min(10, z - e.deltaY * 0.001)));
    } else {
      setScrollX((s) => Math.max(0, s + e.deltaX));
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const time = x / pps;
    seekTo(Math.max(0, time));
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden cursor-crosshair"
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      {tracks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center
                        text-daw-text-dim text-sm pointer-events-none">
          Drop audio files here or add tracks to get started
        </div>
      )}
    </div>
  );
}
