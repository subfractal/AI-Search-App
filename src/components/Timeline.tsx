import { useRef, useEffect, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import { useAutomationStore } from '@/stores/automation-store';
import { getPositionSeconds, seekTo } from '@/services/transport-service';
import { isAudioClip } from '@/types/audio';
import type { AutomationLane } from '@/types/automation';
import {
  drawWaveform,
  drawGrid,
  drawRuler,
  drawPlayhead,
  drawLoopRegion,
  RULER_HEIGHT,
} from '@/utils/waveform-renderer';

const TRACK_HEIGHT = 72;
const AUTOMATION_LANE_HEIGHT = 36;
const CLIP_HEADER_HEIGHT = 18;

function drawAutomationLane(
  ctx: CanvasRenderingContext2D,
  lane: AutomationLane,
  y: number,
  h: number,
  pps: number,
  scrollX: number,
  width: number,
) {
  // Lane background
  ctx.fillStyle = lane.color + '0a';
  ctx.fillRect(0, y, width, h);

  // Lane label
  ctx.fillStyle = lane.color + '99';
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.fillText(lane.target.toUpperCase(), 4, y + 12);

  // Separator
  ctx.strokeStyle = lane.color + '25';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, y + h);
  ctx.lineTo(width, y + h);
  ctx.stroke();

  if (lane.points.length === 0) return;

  // Draw automation curve
  ctx.beginPath();
  ctx.strokeStyle = lane.color + 'dd';
  ctx.lineWidth = 2;

  let started = false;
  for (const point of lane.points) {
    const px = point.time * pps - scrollX;
    const normalized = (point.value - lane.minValue) / (lane.maxValue - lane.minValue);
    const py = y + h - normalized * (h - 6) - 3;

    if (!started) {
      const firstNorm = (lane.points[0]!.value - lane.minValue) / (lane.maxValue - lane.minValue);
      const firstPy = y + h - firstNorm * (h - 6) - 3;
      ctx.moveTo(0, firstPy);
      ctx.lineTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }

  const lastPoint = lane.points[lane.points.length - 1]!;
  const lastNorm = (lastPoint.value - lane.minValue) / (lane.maxValue - lane.minValue);
  const lastPy = y + h - lastNorm * (h - 6) - 3;
  ctx.lineTo(width, lastPy);
  ctx.stroke();

  // Draw points as dots
  for (const point of lane.points) {
    const px = point.time * pps - scrollX;
    if (px < -5 || px > width + 5) continue;
    const normalized = (point.value - lane.minValue) / (lane.maxValue - lane.minValue);
    const py = y + h - normalized * (h - 6) - 3;

    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = lane.color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

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
  const config = useSessionStore((s) => s.config);
  const bpm = useTransportStore((s) => s.bpm);
  const loopEnabled = useTransportStore((s) => s.loopEnabled);
  const loopStart = useTransportStore((s) => s.loopStart);
  const loopEnd = useTransportStore((s) => s.loopEnd);
  const transportState = useTransportStore((s) => s.state);
  const automationLanes = useAutomationStore((s) => s.lanes);
  const beatsPerBar = config.timeSignature.numerator;

  const [showAutomation, setShowAutomation] = useState(false);

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

      if (playheadX - scrollX > width * 0.75) {
        setScrollX(Math.max(0, playheadX - width * 0.25));
      }
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

    // Background — dark like Ableton
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, width, height);

    // Grid
    drawGrid(ctx, bpm, 4, pps, scrollX, width, height);

    // Track lanes
    let yOffset = RULER_HEIGHT;
    tracks.forEach((track, index) => {
      const trackLanes = showAutomation
        ? (automationLanes[track.id] ?? []).filter((l) => l.visible)
        : [];
      const autoHeight = trackLanes.length * AUTOMATION_LANE_HEIGHT;
      const totalTrackHeight = TRACK_HEIGHT + autoHeight;
      const y = yOffset - scrollY;
      yOffset += totalTrackHeight;

      if (y + totalTrackHeight < 0 || y > height) return;

      // Track lane background — subtle alternation
      ctx.fillStyle = index % 2 === 0 ? '#161616' : '#131313';
      ctx.fillRect(0, y, width, TRACK_HEIGHT);

      // Track color indicator — left edge strip (like Logic Pro)
      ctx.fillStyle = track.color + '60';
      ctx.fillRect(0, y, 3, TRACK_HEIGHT);

      // Lane separator — subtle
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + totalTrackHeight);
      ctx.lineTo(width, y + totalTrackHeight);
      ctx.stroke();

      // Clips — bold, saturated colors like Ableton/Logic
      track.clips.forEach((clip) => {
        const clipX = clip.startTime * pps - scrollX;
        const clipW = clip.duration * pps;
        const clipY = y + 2;
        const clipH = TRACK_HEIGHT - 4;

        if (clipX + clipW < 0 || clipX > width) return;

        const radius = 3;

        // Clip body — saturated fill
        ctx.beginPath();
        ctx.roundRect(clipX, clipY, clipW, clipH, radius);
        ctx.fillStyle = track.color + '35';
        ctx.fill();

        // Clip border — visible edge
        ctx.strokeStyle = track.color + '80';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Clip header bar — fully colored like Ableton
        ctx.beginPath();
        ctx.roundRect(clipX, clipY, clipW, CLIP_HEADER_HEIGHT, [radius, radius, 0, 0]);
        ctx.fillStyle = track.color + 'cc';
        ctx.fill();

        // Clip name — white text on colored header
        ctx.fillStyle = '#000000cc';
        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX + 2, clipY, clipW - 4, CLIP_HEADER_HEIGHT);
        ctx.clip();
        ctx.fillText(clip.name, clipX + 5, clipY + 13);
        ctx.restore();

        // Content area
        const contentY = clipY + CLIP_HEADER_HEIGHT;
        const contentH = clipH - CLIP_HEADER_HEIGHT;

        if (isAudioClip(clip)) {
          drawWaveform(
            ctx,
            clip.buffer,
            clipX,
            contentY,
            clipW,
            contentH,
            track.color,
          );
        } else {
          // MIDI notes — thicker, more visible
          clip.notes.forEach((note) => {
            const noteX = clipX + note.startTime * pps;
            const noteW = Math.max(3, note.duration * pps);
            const noteY = contentY + contentH -
              ((note.pitch / 127) * (contentH - 4)) - 2;
            const noteH = Math.max(3, contentH / 24);

            ctx.fillStyle = track.color + 'dd';
            ctx.beginPath();
            ctx.roundRect(noteX, noteY, noteW, noteH, 1);
            ctx.fill();
          });
        }
      });

      // Automation lanes
      trackLanes.forEach((lane, laneIdx) => {
        const laneY = y + TRACK_HEIGHT + laneIdx * AUTOMATION_LANE_HEIGHT;
        drawAutomationLane(ctx, lane, laneY, AUTOMATION_LANE_HEIGHT, pps, scrollX, width);
      });
    });

    // Loop region
    if (loopEnabled) {
      drawLoopRegion(ctx, loopStart, loopEnd, pps, scrollX, height);
    }

    // Ruler (on top)
    drawRuler(ctx, bpm, pps, scrollX, width, beatsPerBar);

    // Playhead (last, on top)
    const position = getPositionSeconds();
    drawPlayhead(ctx, position, pps, scrollX, height);

    rafRef.current = requestAnimationFrame(draw);
  }, [tracks, bpm, pps, scrollX, scrollY, loopEnabled, loopStart, loopEnd, beatsPerBar, showAutomation, automationLanes]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z - e.deltaY * 0.001)));
    } else if (e.shiftKey) {
      setScrollX((s) => Math.max(0, s + e.deltaY));
      setFollowPlayhead(false);
    } else {
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
                 bg-[#141414]"
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Controls overlay */}
      <div className="absolute top-[24px] right-1 flex items-center gap-0.5 z-10
                      pointer-events-auto">
        <button
          onClick={(e) => { e.stopPropagation(); setShowAutomation((v) => !v); }}
          className={`w-6 h-5 rounded text-xxs flex items-center justify-center
                     transition-all font-bold
                     ${showAutomation
              ? 'bg-red-500/25 text-red-400 border border-red-500/50'
              : 'bg-black/60 text-daw-text-muted border border-daw-border/40 hover:text-daw-text-dim'}`}
          title={showAutomation ? 'Hide Automation' : 'Show Automation'}
        >
          A
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
          className={`w-6 h-5 rounded text-xxs flex items-center justify-center
                     transition-all
                     ${followPlayhead
              ? 'bg-daw-accent/25 text-daw-accent border border-daw-accent/50'
              : 'bg-black/60 text-daw-text-muted border border-daw-border/40 hover:text-daw-text-dim'}`}
          title={followPlayhead ? 'Follow ON' : 'Follow OFF'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d="M1 5h2l1.5-3 2 6L8 5h1" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="w-6 h-5 rounded text-xxs bg-black/60 text-daw-text-muted
                     border border-daw-border/40 flex items-center justify-center
                     hover:text-daw-text-dim transition-all"
          title="Zoom Out"
        >
          −
        </button>
        <span className="text-xxs text-daw-text-muted font-mono w-8 text-center
                         bg-black/50 rounded border border-daw-border/30 leading-5">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="w-6 h-5 rounded text-xxs bg-black/60 text-daw-text-muted
                     border border-daw-border/40 flex items-center justify-center
                     hover:text-daw-text-dim transition-all"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); zoomFit(); }}
          className="w-6 h-5 rounded text-xxs bg-black/60 text-daw-text-muted
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
