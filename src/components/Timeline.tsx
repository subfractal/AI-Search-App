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

const TRACK_HEIGHT = 48;
const PIXELS_PER_SECOND = 100;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

export default function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [followPlayhead, setFollowPlayhead] = useState(true);

  const tracks = useSessionStore((s) => s.tracks);
  const bpm = useTransportStore((s) => s.bpm);
  const transportState = useTransportStore((s) => s.state);

  const pps = PIXELS_PER_SECOND * zoom;

  // Follow playhead during playback
  useEffect(() => {
    if (!followPlayhead || transportState !== 'playing') return;

    let active = true;
    const follow = () => {
      if (!active) return;
      const container = containerRef.current;
      if (!container) return;
      const { width } = container.getBoundingClientRect();
      const pos = getPositionSeconds();
      const playheadX = pos * pps;

      // If playhead is past 75% of visible area, scroll to keep it at 25%
      if (playheadX - scrollX > width * 0.75) {
        setScrollX(Math.max(0, playheadX - width * 0.25));
      }
      // If playhead is before visible area, jump back
      if (playheadX < scrollX) {
        setScrollX(Math.max(0, playheadX - width * 0.1));
      }
      requestAnimationFrame(follow);
    };
    const id = requestAnimationFrame(follow);
    return () => {
      active = false;
      cancelAnimationFrame(id);
    };
  }, [followPlayhead, transportState, pps, scrollX]);

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
      const y = 16 + index * TRACK_HEIGHT - scrollY;

      if (y + TRACK_HEIGHT < 0 || y > height) return;

      // Alternating lane backgrounds
      ctx.fillStyle = index % 2 === 0 ? '#111111' : '#0f0f0f';
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
  }, [tracks, bpm, pps, scrollX, scrollY]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z - e.deltaY * 0.001)));
    } else if (e.shiftKey) {
      // Horizontal scroll with shift
      setScrollX((s) => Math.max(0, s + e.deltaY));
      setFollowPlayhead(false);
    } else {
      // Vertical scroll for tracks, horizontal for deltaX
      setScrollY((s) => Math.max(0, s + e.deltaY));
      if (e.deltaX !== 0) {
        setScrollX((s) => Math.max(0, s + e.deltaX));
        setFollowPlayhead(false);
      }
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

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z * 1.3));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z / 1.3));
  const zoomFit = () => {
    const container = containerRef.current;
    if (!container || tracks.length === 0) return;
    const { width } = container.getBoundingClientRect();
    let maxEnd = 10;
    for (const track of tracks) {
      for (const clip of track.clips) {
        maxEnd = Math.max(maxEnd, clip.startTime + clip.duration);
      }
    }
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, width / (maxEnd * PIXELS_PER_SECOND))));
    setScrollX(0);
  };

  const toggleFollow = () => setFollowPlayhead((v) => !v);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden cursor-crosshair
                 bg-daw-bg"
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Zoom / Follow controls overlay */}
      <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10
                      pointer-events-auto">
        <button
          onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
          className={`w-6 h-5 rounded text-xxs flex items-center justify-center
                     transition-all
                     ${followPlayhead
              ? 'bg-daw-accent/20 text-daw-accent border border-daw-accent/40'
              : 'bg-daw-bg/80 text-daw-text-muted border border-daw-border/40 hover:text-daw-text-dim'}`}
          title={followPlayhead ? 'Follow ON — click to disable' : 'Follow OFF — click to enable'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M1 5h2l1.5-3 2 6L8 5h1" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="w-6 h-5 rounded text-xxs bg-daw-bg/80 text-daw-text-muted
                     border border-daw-border/40 flex items-center justify-center
                     hover:text-daw-text-dim transition-all"
          title="Zoom Out"
        >
          −
        </button>
        <span className="text-xxs text-daw-text-muted font-mono w-8 text-center
                         bg-daw-bg/60 rounded border border-daw-border/30 leading-5">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="w-6 h-5 rounded text-xxs bg-daw-bg/80 text-daw-text-muted
                     border border-daw-border/40 flex items-center justify-center
                     hover:text-daw-text-dim transition-all"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); zoomFit(); }}
          className="w-6 h-5 rounded text-xxs bg-daw-bg/80 text-daw-text-muted
                     border border-daw-border/40 flex items-center justify-center
                     hover:text-daw-text-dim transition-all"
          title="Zoom to Fit"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <rect x="1" y="1" width="8" height="8" rx="1" />
            <line x1="3" y1="5" x2="7" y2="5" />
          </svg>
        </button>
      </div>

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
