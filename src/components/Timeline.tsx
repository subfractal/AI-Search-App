import { useRef, useEffect, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import { useAutomationStore } from '@/stores/automation-store';
import { useAIStore } from '@/stores/ai-store';
import { getPositionSeconds, seekTo } from '@/services/transport-service';
import { isAudioClip } from '@/types/audio';
import type { Clip } from '@/types/audio';
import type { AutomationLane } from '@/types/automation';
import InlineSuggestion from '@/components/ai/InlineSuggestion';
import ClipContextMenu from '@/components/ClipContextMenu';
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
const RESIZE_HANDLE_WIDTH = 6;
const PIXELS_PER_SECOND = 100;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

function drawAutomationLane(
  ctx: CanvasRenderingContext2D,
  lane: AutomationLane,
  y: number,
  h: number,
  pps: number,
  scrollX: number,
  width: number,
) {
  ctx.fillStyle = lane.color + '0a';
  ctx.fillRect(0, y, width, h);
  ctx.fillStyle = lane.color + '99';
  ctx.font = '9px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillText(lane.target.toUpperCase(), 4, y + 12);
  ctx.strokeStyle = lane.color + '25';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, y + h);
  ctx.lineTo(width, y + h);
  ctx.stroke();

  if (lane.points.length === 0) return;

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

interface HitResult {
  trackId: string;
  trackIndex: number;
  clip: Clip;
  edge: 'left' | 'right' | 'body';
}

export default function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [showAutomation, setShowAutomation] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    clip: Clip;
    trackId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Drag state
  const dragRef = useRef<{
    type: 'move' | 'resize-left' | 'resize-right' | 'pan';
    trackId: string;
    clipId: string;
    startX: number;
    startTime: number;
    startDuration: number;
    moved: boolean;
  } | null>(null);

  const tracks = useSessionStore((s) => s.tracks);
  const config = useSessionStore((s) => s.config);
  const selectedClips = useSessionStore((s) => s.selectedClips);
  const selectClip = useSessionStore((s) => s.selectClip);
  const clearClipSelection = useSessionStore((s) => s.clearClipSelection);
  const moveClipTime = useSessionStore((s) => s.moveClipTime);
  const resizeClipDuration = useSessionStore((s) => s.resizeClipDuration);
  const splitClipAtTime = useSessionStore((s) => s.splitClipAtTime);
  const deleteSelectedClips = useSessionStore((s) => s.deleteSelectedClips);
  const copySelectedClips = useSessionStore((s) => s.copySelectedClips);
  const pasteClips = useSessionStore((s) => s.pasteClips);
  const viewMode = useSessionStore((s) => s.viewMode);
  const setViewMode = useSessionStore((s) => s.setViewMode);

  const bpm = useTransportStore((s) => s.bpm);
  const loopEnabled = useTransportStore((s) => s.loopEnabled);
  const loopStart = useTransportStore((s) => s.loopStart);
  const loopEnd = useTransportStore((s) => s.loopEnd);
  const transportState = useTransportStore((s) => s.state);
  const automationLanes = useAutomationStore((s) => s.lanes);
  const aiSuggestions = useAIStore((s) => s.suggestions);
  const beatsPerBar = config.timeSignature.numerator;
  const pps = PIXELS_PER_SECOND * zoom;

  const inlineSuggestions = aiSuggestions.filter(
    (s) => s.priority === 'inline' && s.status === 'pending' && s.targetTrackId,
  );

  // Hit test: find which clip (if any) is at a given pixel position
  const hitTest = useCallback((clientX: number, clientY: number): HitResult | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left + scrollX;
    const y = clientY - rect.top + scrollY;

    let yOffset = RULER_HEIGHT;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]!;
      const trackLanes = showAutomation
        ? (automationLanes[track.id] ?? []).filter((l) => l.visible)
        : [];
      const totalH = TRACK_HEIGHT + trackLanes.length * AUTOMATION_LANE_HEIGHT;
      const trackY = yOffset;
      yOffset += totalH;

      if (y < trackY || y > trackY + TRACK_HEIGHT) continue;

      for (const clip of track.clips) {
        const clipX = clip.startTime * pps;
        const clipW = clip.duration * pps;
        if (x >= clipX && x <= clipX + clipW) {
          const relX = x - clipX;
          const edge =
            relX < RESIZE_HANDLE_WIDTH ? 'left' :
              relX > clipW - RESIZE_HANDLE_WIDTH ? 'right' : 'body';
          return { trackId: track.id, trackIndex: i, clip, edge };
        }
      }
    }
    return null;
  }, [tracks, scrollX, scrollY, pps, showAutomation, automationLanes]);

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
    return () => { active = false; cancelAnimationFrame(id); };
  }, [followPlayhead, transportState, pps, scrollX]);

  // Draw
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

    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, width, height);
    drawGrid(ctx, bpm, 4, pps, scrollX, width, height);

    const selectedSet = new Set(selectedClips.map((s) => s.clipId));

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

      ctx.fillStyle = index % 2 === 0 ? '#161616' : '#131313';
      ctx.fillRect(0, y, width, TRACK_HEIGHT);
      ctx.fillStyle = track.color + '60';
      ctx.fillRect(0, y, 3, TRACK_HEIGHT);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + totalTrackHeight);
      ctx.lineTo(width, y + totalTrackHeight);
      ctx.stroke();

      track.clips.forEach((clip) => {
        const clipX = clip.startTime * pps - scrollX;
        const clipW = clip.duration * pps;
        const clipY = y + 2;
        const clipH = TRACK_HEIGHT - 4;
        if (clipX + clipW < 0 || clipX > width) return;

        const isSelected = selectedSet.has(clip.id);

        // Clip body
        ctx.fillStyle = track.color + '35';
        ctx.fillRect(clipX, clipY, clipW, clipH);

        // Clip border — highlight if selected
        ctx.strokeStyle = isSelected ? '#ffffff' : track.color + '80';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(clipX, clipY, clipW, clipH);

        // Clip header
        ctx.fillStyle = track.color + 'cc';
        ctx.fillRect(clipX, clipY, clipW, CLIP_HEADER_HEIGHT);

        // Clip name
        ctx.fillStyle = '#000000cc';
        ctx.font = 'bold 10px "IBM Plex Sans", system-ui, sans-serif';
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX + 2, clipY, clipW - 4, CLIP_HEADER_HEIGHT);
        ctx.clip();
        ctx.fillText(clip.name, clipX + 5, clipY + 13);
        ctx.restore();

        // Content
        const contentY = clipY + CLIP_HEADER_HEIGHT;
        const contentH = clipH - CLIP_HEADER_HEIGHT;
        if (isAudioClip(clip)) {
          drawWaveform(ctx, clip.buffer, clipX, contentY, clipW, contentH, track.color);
        } else {
          clip.notes.forEach((note) => {
            const noteX = clipX + note.startTime * pps;
            const noteW = Math.max(3, note.duration * pps);
            const noteY = contentY + contentH - ((note.pitch / 127) * (contentH - 4)) - 2;
            const noteH = Math.max(3, contentH / 24);
            ctx.fillStyle = track.color + 'dd';
            ctx.fillRect(noteX, noteY, noteW, noteH);
          });
        }

        // Resize handles (visible on hover/selection)
        if (isSelected) {
          ctx.fillStyle = '#ffffff40';
          ctx.fillRect(clipX, clipY, RESIZE_HANDLE_WIDTH, clipH);
          ctx.fillRect(clipX + clipW - RESIZE_HANDLE_WIDTH, clipY, RESIZE_HANDLE_WIDTH, clipH);
        }
      });

      trackLanes.forEach((lane, laneIdx) => {
        const laneY = y + TRACK_HEIGHT + laneIdx * AUTOMATION_LANE_HEIGHT;
        drawAutomationLane(ctx, lane, laneY, AUTOMATION_LANE_HEIGHT, pps, scrollX, width);
      });
    });

    if (loopEnabled) {
      drawLoopRegion(ctx, loopStart, loopEnd, pps, scrollX, height);
    }
    drawRuler(ctx, bpm, pps, scrollX, width, beatsPerBar);
    const position = getPositionSeconds();
    drawPlayhead(ctx, position, pps, scrollX, height);

    rafRef.current = requestAnimationFrame(draw);
  }, [tracks, bpm, pps, scrollX, scrollY, loopEnabled, loopStart, loopEnd, beatsPerBar, showAutomation, automationLanes, selectedClips]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return; // right-click handled separately
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      e.stopPropagation();
      selectClip(hit.trackId, hit.clip.id, e.shiftKey || e.metaKey);
      const dragType = hit.edge === 'left' ? 'resize-left' as const
        : hit.edge === 'right' ? 'resize-right' as const
          : 'move' as const;
      dragRef.current = {
        type: dragType,
        trackId: hit.trackId,
        clipId: hit.clip.id,
        startX: e.clientX,
        startTime: hit.clip.startTime,
        startDuration: hit.clip.duration,
        moved: false,
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dtSecs = dx / pps;
        if (Math.abs(dx) > 3) dragRef.current.moved = true;
        if (dragRef.current.type === 'move') {
          moveClipTime(dragRef.current.trackId, dragRef.current.clipId,
            Math.max(0, dragRef.current.startTime + dtSecs));
        } else if (dragRef.current.type === 'resize-right') {
          resizeClipDuration(dragRef.current.trackId, dragRef.current.clipId,
            Math.max(0.1, dragRef.current.startDuration + dtSecs));
        } else if (dragRef.current.type === 'resize-left') {
          const newStart = Math.max(0, dragRef.current.startTime + dtSecs);
          const shrink = newStart - dragRef.current.startTime;
          moveClipTime(dragRef.current.trackId, dragRef.current.clipId, newStart);
          resizeClipDuration(dragRef.current.trackId, dragRef.current.clipId,
            Math.max(0.1, dragRef.current.startDuration - shrink));
        }
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    } else {
      clearClipSelection();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only seek if we didn't just drag
    if (dragRef.current?.moved) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollX;
      seekTo(Math.max(0, x / pps));
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      selectClip(hit.trackId, hit.clip.id);
      setContextMenu({
        clip: hit.clip,
        trackId: hit.trackId,
        position: { x: e.clientX, y: e.clientY },
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (hit) {
      canvas.style.cursor = hit.edge === 'left' || hit.edge === 'right'
        ? 'col-resize' : 'grab';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  };

  // Keyboard shortcuts for clip editing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClips.length > 0) {
          e.preventDefault();
          deleteSelectedClips();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedClips.length > 0) {
          e.preventDefault();
          copySelectedClips();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteClips();
      }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        // Split at playhead
        if (selectedClips.length > 0) {
          const pos = getPositionSeconds();
          for (const sel of selectedClips) {
            const track = tracks.find((t) => t.id === sel.trackId);
            const clip = track?.clips.find((c) => c.id === sel.clipId);
            if (clip && pos > clip.startTime && pos < clip.startTime + clip.duration) {
              splitClipAtTime(sel.trackId, sel.clipId, pos - clip.startTime);
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedClips, deleteSelectedClips, copySelectedClips, pasteClips, splitClipAtTime, tracks]);

  // Wheel
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

  // Touch — improved responsiveness
  const touchRef = useRef<{
    startX: number;
    startY: number;
    scrollXStart: number;
    scrollYStart: number;
    pinchDist: number | null;
    zoomStart: number;
    moved: boolean;
    timestamp: number;
  } | null>(null);

  const getTouchDist = (touches: React.TouchList | TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[1]!.clientX - touches[0]!.clientX;
    const dy = touches[1]!.clientY - touches[0]!.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]!;
    const pinchDist = getTouchDist(e.touches);
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      scrollXStart: scrollX,
      scrollYStart: scrollY,
      pinchDist,
      zoomStart: zoom,
      moved: false,
      timestamp: Date.now(),
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    e.preventDefault();
    const ref = touchRef.current;

    if (e.touches.length >= 2) {
      const dist = getTouchDist(e.touches);
      if (dist && ref.pinchDist) {
        const scale = dist / ref.pinchDist;
        setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ref.zoomStart * scale)));
      }
      return;
    }

    const touch = e.touches[0]!;
    const dx = ref.startX - touch.clientX;
    const dy = ref.startY - touch.clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) ref.moved = true;
    setScrollX(Math.max(0, ref.scrollXStart + dx));
    setScrollY(Math.max(0, ref.scrollYStart + dy));
    setFollowPlayhead(false);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchRef.current && !touchRef.current.moved && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]!;
      const elapsed = Date.now() - touchRef.current.timestamp;
      // Quick tap = seek, long tap = context menu
      if (elapsed < 300) {
        const hit = hitTest(touch.clientX, touch.clientY);
        if (hit) {
          selectClip(hit.trackId, hit.clip.id);
        } else {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left + scrollX;
            seekTo(Math.max(0, x / pps));
          }
        }
      } else if (elapsed >= 500) {
        // Long press = context menu
        const hit = hitTest(touch.clientX, touch.clientY);
        if (hit) {
          selectClip(hit.trackId, hit.clip.id);
          setContextMenu({
            clip: hit.clip,
            trackId: hit.trackId,
            position: { x: touch.clientX, y: touch.clientY },
          });
        }
      }
    }
    touchRef.current = null;
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

  return (
    <div className="w-full h-full flex flex-col">
      {/* ── Clip Editing Toolbar ── */}
      <div className="flex items-center h-8 px-2.5 gap-1 shrink-0"
        style={{ background: '#0a0a0c', borderBottom: '2px solid #1a1a1c' }}>
        <span className="text-[8px] font-mono font-bold uppercase tracking-[3px] text-[#E63946]/80 shrink-0 mr-1">
          TIMELINE
        </span>
        {/* View mode toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'arrangement' ? 'session' : 'arrangement')}
          className={`text-[9px] font-mono uppercase px-2 py-0.5 transition-all font-bold
                     ${viewMode === 'session'
      ? 'bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30'
      : 'daw-hw-btn text-daw-text-muted hover:text-daw-text-dim'}`}
          title={viewMode === 'arrangement' ? 'Switch to Session View' : 'Switch to Arrangement View'}
        >
          {viewMode === 'arrangement' ? 'ARR' : 'SESSION'}
        </button>

        <div className="daw-divider mx-1 shrink-0" />

        {/* Clip operations */}
        <button
          onClick={() => { if (selectedClips.length > 0) { const pos = getPositionSeconds(); for (const sel of selectedClips) { const tr = tracks.find((t) => t.id === sel.trackId); const cl = tr?.clips.find((c) => c.id === sel.clipId); if (cl && pos > cl.startTime && pos < cl.startTime + cl.duration) splitClipAtTime(sel.trackId, sel.clipId, pos - cl.startTime); } } }}
          disabled={selectedClips.length === 0}
          className="text-[9px] px-1.5 py-0.5 text-daw-text-muted hover:text-daw-text-dim
                     disabled:opacity-20 transition-all daw-hw-btn font-mono"
          title="Split at Playhead (S)"
        >
          Split
        </button>
        <button
          onClick={copySelectedClips}
          disabled={selectedClips.length === 0}
          className="text-[9px] px-1.5 py-0.5 text-daw-text-muted hover:text-daw-text-dim
                     disabled:opacity-20 transition-all daw-hw-btn font-mono"
          title="Copy (Ctrl+C)"
        >
          Copy
        </button>
        <button
          onClick={() => pasteClips()}
          className="text-[9px] px-1.5 py-0.5 text-daw-text-muted hover:text-daw-text-dim
                     disabled:opacity-20 transition-all daw-hw-btn font-mono"
          title="Paste (Ctrl+V)"
        >
          Paste
        </button>
        <button
          onClick={deleteSelectedClips}
          disabled={selectedClips.length === 0}
          className="text-[9px] px-1.5 py-0.5 text-daw-text-muted hover:text-red-400
                     disabled:opacity-20 transition-all bg-daw-bg/40 border border-daw-border/20"
          title="Delete (Del)"
        >
          Delete
        </button>

        <div className="flex-1" />

        {/* Selection info */}
        {selectedClips.length > 0 && (
          <span className="text-[9px] text-daw-accent font-mono">
            {selectedClips.length} clip{selectedClips.length > 1 ? 's' : ''} selected
          </span>
        )}

        <div className="daw-divider mx-1 shrink-0" />

        {/* Zoom controls */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowAutomation((v) => !v); }}
          className={`w-5 h-5 text-[9px] flex items-center justify-center font-bold transition-all
                     ${showAutomation
      ? 'bg-red-500/25 text-red-400 border border-red-500/50'
      : 'bg-daw-bg/40 text-daw-text-muted border border-daw-border/20 hover:text-daw-text-dim'}`}
          title="Automation"
        >
          A
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setFollowPlayhead((v) => !v); }}
          className={`w-5 h-5 text-[9px] flex items-center justify-center transition-all
                     ${followPlayhead
      ? 'bg-daw-accent/25 text-daw-accent border border-daw-accent/50'
      : 'bg-daw-bg/40 text-daw-text-muted border border-daw-border/20 hover:text-daw-text-dim'}`}
          title="Follow Playhead"
        >
          F
        </button>
        <button onClick={zoomOut} className="w-5 h-5 text-[9px] bg-daw-bg/40 text-daw-text-muted border border-daw-border/20 flex items-center justify-center hover:text-daw-text-dim">−</button>
        <span className="text-[9px] text-daw-text-muted font-mono w-7 text-center bg-daw-bg/30 border border-daw-border/20 leading-5">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className="w-5 h-5 text-[9px] bg-daw-bg/40 text-daw-text-muted border border-daw-border/20 flex items-center justify-center hover:text-daw-text-dim">+</button>
        <button onClick={zoomFit} className="w-5 h-5 text-[9px] bg-daw-bg/40 text-daw-text-muted border border-daw-border/20 flex items-center justify-center hover:text-daw-text-dim" title="Fit">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
            <rect x="1" y="1" width="6" height="6" />
            <line x1="2" y1="4" x2="6" y2="4" />
          </svg>
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[#141414] touch-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Inline AI suggestions */}
        {inlineSuggestions.map((suggestion) => {
          const trackIndex = tracks.findIndex((t) => t.id === suggestion.targetTrackId);
          if (trackIndex < 0) return null;
          const topPx = RULER_HEIGHT + trackIndex * TRACK_HEIGHT - scrollY + 4;
          return (
            <InlineSuggestion
              key={suggestion.id}
              suggestion={suggestion}
              style={{ top: topPx, right: 8 }}
            />
          );
        })}

        {/* Empty state */}
        {tracks.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-daw-text-muted pointer-events-none gap-3">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
              stroke="currentColor" strokeWidth="1" className="opacity-20">
              <rect x="8" y="10" width="32" height="6" />
              <rect x="8" y="20" width="32" height="6" />
              <rect x="8" y="30" width="32" height="6" />
              <line x1="24" y1="4" x2="24" y2="44" strokeDasharray="2 2" />
            </svg>
            <span className="text-xs">Drop audio files or add tracks to begin</span>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ClipContextMenu
          clip={contextMenu.clip}
          trackId={contextMenu.trackId}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
