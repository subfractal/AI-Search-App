import { useRef, useEffect, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import { getPositionSeconds, seekTo } from '@/services/transport-service';
import { isAudioClip } from '@/types/audio';
import {
  drawWaveform,
  drawGrid,
  drawRuler,
  drawPlayhead,
} from '@/utils/waveform-renderer';

const TRACK_HEIGHT = 60;
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

    // Background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, width, height);

    // Grid
    drawGrid(ctx, bpm, 4, pps, scrollX, width, height);

    // Track lanes
    tracks.forEach((track, index) => {
      const y = 16 + index * TRACK_HEIGHT; // 16px for ruler

      // Alternating lane backgrounds
      if (index % 2 === 0) {
        ctx.fillStyle = '#111111';
      } else {
        ctx.fillStyle = '#0f0f0f';
      }
      ctx.fillRect(0, y, width, TRACK_HEIGHT);

      // Lane separator
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + TRACK_HEIGHT);
      ctx.lineTo(width, y + TRACK_HEIGHT);
      ctx.stroke();

      // Clips
      track.clips.forEach((clip) => {
        const clipX = clip.startTime * pps - scrollX;
        const clipW = clip.duration * pps;
        const clipY = y + 3;
        const clipH = TRACK_HEIGHT - 6;

        if (clipX + clipW < 0 || clipX > width) return;

        // Clip background with rounded corners
        const radius = 3;
        ctx.beginPath();
        ctx.roundRect(clipX, clipY, clipW, clipH, radius);
        ctx.fillStyle = track.color + '18';
        ctx.fill();

        // Clip border
        ctx.strokeStyle = track.color + '44';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Clip header bar
        ctx.fillStyle = track.color + '30';
        ctx.beginPath();
        ctx.roundRect(clipX, clipY, clipW, 14, [radius, radius, 0, 0]);
        ctx.fill();

        // Clip name
        ctx.fillStyle = track.color + 'cc';
        ctx.font = '9px Inter, sans-serif';
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX + 2, clipY, clipW - 4, 14);
        ctx.clip();
        ctx.fillText(clip.name, clipX + 5, clipY + 10);
        ctx.restore();

        // Waveform / MIDI
        if (isAudioClip(clip)) {
          drawWaveform(
            ctx,
            clip.buffer,
            clipX,
            clipY + 14,
            clipW,
            clipH - 14,
            track.color,
          );
        } else {
          clip.notes.forEach((note) => {
            const noteX = clipX + note.startTime * pps;
            const noteW = Math.max(2, note.duration * pps);
            const noteY = clipY + clipH -
              ((note.pitch / 127) * (clipH - 16)) - 2;
            ctx.fillStyle = track.color + '99';
            ctx.beginPath();
            ctx.roundRect(noteX, noteY, noteW, 2.5, 1);
            ctx.fill();
          });
        }
      });
    });

    // Ruler (draw on top)
    drawRuler(ctx, bpm, pps, scrollX, width);

    // Playhead (draw last, on top of everything)
    const position = getPositionSeconds();
    drawPlayhead(ctx, position, pps, scrollX, height);

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
      className="w-full h-full relative overflow-hidden cursor-crosshair
                 bg-daw-bg"
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      {tracks.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center
                        justify-center text-daw-text-muted pointer-events-none
                        gap-3">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
            stroke="currentColor" strokeWidth="1" className="opacity-20">
            <rect x="8" y="10" width="32" height="6" rx="2" />
            <rect x="8" y="20" width="32" height="6" rx="2" />
            <rect x="8" y="30" width="32" height="6" rx="2" />
            <line x1="24" y1="4" x2="24" y2="44" strokeDasharray="2 2" />
          </svg>
          <span className="text-xs">
            Drop audio files or add tracks to begin
          </span>
        </div>
      )}
    </div>
  );
}
