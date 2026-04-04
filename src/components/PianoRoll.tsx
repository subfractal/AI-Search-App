import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { MidiClip, MidiNote } from '@/types/audio';
import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import { triggerNote } from '@/services/instrument-service';
import { getPositionSeconds } from '@/services/transport-service';
import { midiToNoteName } from '@/types/instruments';

interface PianoRollProps {
  trackId: string;
  clip: MidiClip;
  onClose: () => void;
}

type Tool = 'draw' | 'select' | 'erase';
type SnapValue = '1/4' | '1/8' | '1/16' | '1/32';

const NOTE_HEIGHT = 14;
const PIANO_WIDTH = 40;
const VELOCITY_HEIGHT = 60;
const TOOLBAR_HEIGHT = 36;
const MIN_PITCH = 24;   // C1
const MAX_PITCH = 96;   // C7
const TOTAL_NOTES = MAX_PITCH - MIN_PITCH + 1;
const DEFAULT_PPS = 120;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;
const RESIZE_HANDLE_PX = 6;

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

const SNAP_DIVISORS: Record<SnapValue, number> = {
  '1/4': 1,
  '1/8': 2,
  '1/16': 4,
  '1/32': 8,
};

function snapTime(t: number, bpm: number, snap: SnapValue): number {
  const beatDuration = 60 / bpm;
  const subdivDuration = beatDuration / SNAP_DIVISORS[snap];
  return Math.round(t / subdivDuration) * subdivDuration;
}

function getSnapDuration(bpm: number, snap: SnapValue): number {
  return (60 / bpm) / SNAP_DIVISORS[snap];
}

export default function PianoRoll({ trackId, clip, onClose }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [tool, setTool] = useState<Tool>('draw');
  const [snap, setSnap] = useState<SnapValue>('1/16');
  const [zoom, setZoom] = useState(1);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [notes, setNotes] = useState<MidiNote[]>(() => [...clip.notes]);
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [dragState, setDragState] = useState<{
    type: 'draw' | 'move' | 'resize';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    noteIndex?: number;
    originalNote?: MidiNote;
    drawPitch?: number;
  } | null>(null);

  const bpm = useTransportStore((s) => s.bpm);
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const tracks = useSessionStore((s) => s.tracks);

  const trackColor = useMemo(() => {
    const track = tracks.find((t) => t.id === trackId);
    return track?.color ?? '#ff6b35';
  }, [tracks, trackId]);

  const pps = DEFAULT_PPS * zoom;

  // Center initial scroll around C3-C5
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const gridH = container.getBoundingClientRect().height - VELOCITY_HEIGHT;
    const midY = (MAX_PITCH - 60) * NOTE_HEIGHT - gridH / 2;
    setScrollY(Math.max(0, midY));
  }, []);

  // Sync notes back to store
  useEffect(() => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const updatedClips = track.clips.map((c) => {
      if (c.id === clip.id) {
        return { ...c, notes } as MidiClip;
      }
      return c;
    });
    updateTrack(trackId, { clips: updatedClips });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const pitchFromY = useCallback((y: number): number => {
    return MAX_PITCH - Math.floor((y + scrollY) / NOTE_HEIGHT);
  }, [scrollY]);

  const timeFromX = useCallback((x: number): number => {
    return (x - PIANO_WIDTH + scrollX) / pps;
  }, [scrollX, pps]);

  const xFromTime = useCallback((time: number): number => {
    return time * pps - scrollX + PIANO_WIDTH;
  }, [scrollX, pps]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height: totalHeight } = container.getBoundingClientRect();
    const gridHeight = totalHeight - VELOCITY_HEIGHT;
    const gridWidth = width - PIANO_WIDTH;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, width, totalHeight);

    // --- Grid area (clipped) ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(PIANO_WIDTH, 0, gridWidth, gridHeight);
    ctx.clip();

    // Note row backgrounds
    for (let pitch = MIN_PITCH; pitch <= MAX_PITCH; pitch++) {
      const y = (MAX_PITCH - pitch) * NOTE_HEIGHT - scrollY;
      if (y + NOTE_HEIGHT < 0 || y > gridHeight) continue;

      const isBlack = BLACK_KEYS.has(pitch % 12);
      ctx.fillStyle = isBlack ? '#111111' : '#151515';
      ctx.fillRect(PIANO_WIDTH, y, gridWidth, NOTE_HEIGHT);

      // Row separator
      ctx.strokeStyle = '#1e1e1e';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PIANO_WIDTH, y + NOTE_HEIGHT);
      ctx.lineTo(width, y + NOTE_HEIGHT);
      ctx.stroke();

      // Thicker line at C notes
      if (pitch % 12 === 0) {
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PIANO_WIDTH, y + NOTE_HEIGHT);
        ctx.lineTo(width, y + NOTE_HEIGHT);
        ctx.stroke();
      }
    }

    // Vertical gridlines: subdivisions (16th notes), beats, bars
    const beatDuration = 60 / bpm;
    const subdivDuration = beatDuration / 4;
    const startSubdiv = Math.floor((scrollX / pps) / subdivDuration);
    const endSubdiv = Math.ceil(((scrollX + gridWidth) / pps) / subdivDuration);

    for (let i = startSubdiv; i <= endSubdiv; i++) {
      const t = i * subdivDuration;
      const x = xFromTime(t);
      if (x < PIANO_WIDTH || x > width) continue;

      const isBar = i % 16 === 0;
      const isBeat = i % 4 === 0;

      if (isBar) {
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
      } else if (isBeat) {
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 0.8;
      } else {
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 0.5;
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, gridHeight);
      ctx.stroke();

      // Bar numbers
      if (isBar) {
        ctx.fillStyle = '#555555';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`${Math.floor(i / 16) + 1}`, x + 3, 10);
      }
    }

    // --- Render notes ---
    // Apply drag transforms for live preview
    let renderedNotes = notes;
    if (dragState && dragState.type !== 'draw') {
      const ds = dragState;
      renderedNotes = notes.map((note, i) => {
        if (!selectedNotes.has(i)) return note;
        if (ds.type === 'move') {
          const dx = (ds.currentX - ds.startX) / pps;
          const dy = Math.round((ds.startY - ds.currentY) / NOTE_HEIGHT);
          return {
            ...note,
            startTime: snapTime(Math.max(0, note.startTime + dx), bpm, snap),
            pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, note.pitch + dy)),
          };
        }
        if (ds.type === 'resize') {
          const dx = (ds.currentX - ds.startX) / pps;
          const minDur = getSnapDuration(bpm, snap);
          return {
            ...note,
            duration: Math.max(minDur, snapTime(note.duration + dx, bpm, snap)),
          };
        }
        return note;
      });
    }

    renderedNotes.forEach((note, i) => {
      const x = xFromTime(note.startTime);
      const y = (MAX_PITCH - note.pitch) * NOTE_HEIGHT - scrollY;
      const w = Math.max(4, note.duration * pps);
      const h = NOTE_HEIGHT - 1;

      if (x + w < PIANO_WIDTH || x > width) return;
      if (y + h < 0 || y > gridHeight) return;

      const isSelected = selectedNotes.has(i);
      const alpha = Math.round((note.velocity / 127) * 200 + 55);
      const alphaHex = alpha.toString(16).padStart(2, '0');

      ctx.fillStyle = trackColor + alphaHex;
      ctx.beginPath();
      ctx.roundRect(x, y + 0.5, w, h, 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = trackColor + 'aa';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Resize handle indicator
      if (w > 10) {
        ctx.fillStyle = '#ffffff18';
        ctx.fillRect(x + w - RESIZE_HANDLE_PX, y + 0.5, RESIZE_HANDLE_PX, h);
      }
    });

    // Draw-in-progress note preview
    if (dragState?.type === 'draw' && dragState.drawPitch != null) {
      const t1 = timeFromX(Math.min(dragState.startX, dragState.currentX));
      const t2 = timeFromX(Math.max(dragState.startX, dragState.currentX));
      const snappedStart = snapTime(Math.max(0, t1), bpm, snap);
      const snappedEnd = snapTime(Math.max(snappedStart, t2), bpm, snap);
      const minDur = getSnapDuration(bpm, snap);
      const drawDur = Math.max(minDur, snappedEnd - snappedStart);
      const dx = xFromTime(snappedStart);
      const dy = (MAX_PITCH - dragState.drawPitch) * NOTE_HEIGHT - scrollY;

      ctx.fillStyle = trackColor + '88';
      ctx.beginPath();
      ctx.roundRect(dx, dy + 0.5, drawDur * pps, NOTE_HEIGHT - 1, 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffffcc';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();

    // --- Piano keys ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PIANO_WIDTH, gridHeight);
    ctx.clip();

    for (let pitch = MIN_PITCH; pitch <= MAX_PITCH; pitch++) {
      const y = (MAX_PITCH - pitch) * NOTE_HEIGHT - scrollY;
      if (y + NOTE_HEIGHT < 0 || y > gridHeight) continue;

      const isBlack = BLACK_KEYS.has(pitch % 12);
      ctx.fillStyle = isBlack ? '#1a1a1a' : '#2a2a2a';
      ctx.fillRect(0, y, PIANO_WIDTH, NOTE_HEIGHT);

      // Border
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + NOTE_HEIGHT);
      ctx.lineTo(PIANO_WIDTH, y + NOTE_HEIGHT);
      ctx.stroke();

      // Label C notes
      if (pitch % 12 === 0) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(midiToNoteName(pitch), 4, y + NOTE_HEIGHT - 3);
      }
    }

    // Right border for piano
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PIANO_WIDTH, 0);
    ctx.lineTo(PIANO_WIDTH, gridHeight);
    ctx.stroke();
    ctx.restore();

    // --- Playhead ---
    const pos = getPositionSeconds();
    const playheadX = xFromTime(pos);
    if (playheadX >= PIANO_WIDTH && playheadX <= width) {
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, gridHeight);
      ctx.stroke();
    }

    // --- Velocity strip ---
    const velY = gridHeight;
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, velY, width, VELOCITY_HEIGHT);
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, velY);
    ctx.lineTo(width, velY);
    ctx.stroke();

    // Velocity bars
    ctx.save();
    ctx.beginPath();
    ctx.rect(PIANO_WIDTH, velY, gridWidth, VELOCITY_HEIGHT);
    ctx.clip();

    renderedNotes.forEach((note, i) => {
      const x = xFromTime(note.startTime);
      const w = Math.max(3, note.duration * pps);
      if (x + w < PIANO_WIDTH || x > width) return;

      const barH = (note.velocity / 127) * (VELOCITY_HEIGHT - 8);
      const barY = velY + VELOCITY_HEIGHT - barH - 4;
      const isSelected = selectedNotes.has(i);

      ctx.fillStyle = isSelected ? '#ffffff88' : trackColor + '88';
      ctx.fillRect(x + 1, barY, Math.max(2, w - 2), barH);
    });

    ctx.restore();

    // Velocity label
    ctx.fillStyle = '#555555';
    ctx.font = '8px Inter, sans-serif';
    ctx.fillText('VEL', 4, velY + 12);

    rafRef.current = requestAnimationFrame(draw);
  }, [
    notes, selectedNotes, scrollX, scrollY, pps, bpm,
    snap, trackColor, dragState, timeFromX, xFromTime,
  ]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const findNoteAt = useCallback((x: number, y: number): {
    index: number; isResize: boolean;
  } | null => {
    const midi = pitchFromY(y);
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i]!;
      if (note.pitch !== midi) continue;
      const nx = xFromTime(note.startTime);
      const nxEnd = xFromTime(note.startTime + note.duration);
      if (x >= nx && x <= nxEnd) {
        return { index: i, isResize: x >= nxEnd - RESIZE_HANDLE_PX };
      }
    }
    return null;
  }, [notes, pitchFromY, xFromTime]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const gridHeight = rect.height - VELOCITY_HEIGHT;

    // Piano keyboard click
    if (x < PIANO_WIDTH && y < gridHeight) {
      const pitch = pitchFromY(y);
      if (pitch >= MIN_PITCH && pitch <= MAX_PITCH) {
        triggerNote(trackId, midiToNoteName(pitch), '8n');
      }
      return;
    }

    if (x < PIANO_WIDTH || y >= gridHeight) return;

    // Right-click: delete
    if (e.button === 2) {
      e.preventDefault();
      const hit = findNoteAt(x, y);
      if (hit) {
        setNotes((prev) => prev.filter((_, i) => i !== hit.index));
        setSelectedNotes((prev) => {
          const next = new Set<number>();
          for (const idx of prev) {
            if (idx < hit.index) next.add(idx);
            else if (idx > hit.index) next.add(idx - 1);
          }
          return next;
        });
      }
      return;
    }

    if (tool === 'erase') {
      const hit = findNoteAt(x, y);
      if (hit) {
        setNotes((prev) => prev.filter((_, i) => i !== hit.index));
        setSelectedNotes(new Set());
      }
      return;
    }

    if (tool === 'select' || tool === 'draw') {
      const hit = findNoteAt(x, y);

      if (hit) {
        // Clicked on a note: select and start drag
        if (e.shiftKey && tool === 'select') {
          setSelectedNotes((prev) => {
            const next = new Set(prev);
            if (next.has(hit.index)) next.delete(hit.index);
            else next.add(hit.index);
            return next;
          });
        } else if (!selectedNotes.has(hit.index)) {
          setSelectedNotes(new Set([hit.index]));
        }

        const original = notes[hit.index];
        if (!original) return;

        setDragState({
          type: hit.isResize ? 'resize' : 'move',
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          noteIndex: hit.index,
          originalNote: { ...original },
        });
        return;
      }

      // Empty space
      if (tool === 'draw') {
        const pitch = pitchFromY(y);
        if (pitch < MIN_PITCH || pitch > MAX_PITCH) return;

        triggerNote(trackId, midiToNoteName(pitch), '8n');
        setDragState({
          type: 'draw',
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          drawPitch: pitch,
        });
        setSelectedNotes(new Set());
      } else {
        if (!e.shiftKey) setSelectedNotes(new Set());
      }
    }
  }, [tool, notes, selectedNotes, findNoteAt, pitchFromY, trackId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!dragState) {
      // Update cursor
      if (x < PIANO_WIDTH) {
        canvas.style.cursor = 'pointer';
      } else if (tool === 'erase') {
        canvas.style.cursor = 'crosshair';
      } else {
        const hit = findNoteAt(x, y);
        if (hit) {
          canvas.style.cursor = hit.isResize ? 'ew-resize' : 'grab';
        } else {
          canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
        }
      }
      return;
    }

    setDragState((prev) =>
      prev ? { ...prev, currentX: x, currentY: y } : null,
    );
  }, [dragState, tool, findNoteAt]);

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    if (dragState.type === 'draw' && dragState.drawPitch != null) {
      const t1 = timeFromX(Math.min(dragState.startX, dragState.currentX));
      const t2 = timeFromX(Math.max(dragState.startX, dragState.currentX));
      const snappedStart = snapTime(Math.max(0, t1), bpm, snap);
      const snappedEnd = snapTime(Math.max(snappedStart, t2), bpm, snap);
      const minDur = getSnapDuration(bpm, snap);
      const duration = Math.max(minDur, snappedEnd - snappedStart);

      const newNote: MidiNote = {
        pitch: dragState.drawPitch,
        velocity: 100,
        startTime: snappedStart,
        duration,
      };
      setNotes((prev) => [...prev, newNote]);
      setSelectedNotes(new Set([notes.length]));
    } else if (dragState.type === 'move' || dragState.type === 'resize') {
      // Apply drag transforms permanently
      setNotes((prev) =>
        prev.map((note, i) => {
          if (!selectedNotes.has(i)) return note;
          if (dragState.type === 'move') {
            const dx = (dragState.currentX - dragState.startX) / pps;
            const dy = Math.round(
              (dragState.startY - dragState.currentY) / NOTE_HEIGHT,
            );
            return {
              ...note,
              startTime: snapTime(Math.max(0, note.startTime + dx), bpm, snap),
              pitch: Math.max(
                MIN_PITCH,
                Math.min(MAX_PITCH, note.pitch + dy),
              ),
            };
          }
          if (dragState.type === 'resize') {
            const dx = (dragState.currentX - dragState.startX) / pps;
            const minDur = getSnapDuration(bpm, snap);
            return {
              ...note,
              duration: Math.max(
                minDur,
                snapTime(note.duration + dx, bpm, snap),
              ),
            };
          }
          return note;
        }),
      );
    }

    setDragState(null);
  }, [dragState, timeFromX, bpm, snap, notes.length, selectedNotes, pps]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z - e.deltaY * 0.002)));
    } else {
      setScrollX((s) => Math.max(0, s + e.deltaX * 0.5));
      setScrollY((s) => {
        const maxY = TOTAL_NOTES * NOTE_HEIGHT - 200;
        return Math.max(0, Math.min(maxY, s + e.deltaY));
      });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNotes.size > 0) {
          e.preventDefault();
          setNotes((prev) => prev.filter((_, i) => !selectedNotes.has(i)));
          setSelectedNotes(new Set());
        }
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedNotes(new Set(notes.map((_, i) => i)));
      }
      if (e.key === 'Escape') {
        setSelectedNotes(new Set());
        setDragState(null);
      }
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'b' || e.key === 'B') setTool('draw');
        if (e.key === 'v' || e.key === 'V') setTool('select');
        if (e.key === 'e' || e.key === 'E') setTool('erase');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNotes, notes]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * 1.25));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / 1.25));
  }, []);

  return (
    <div className="flex flex-col w-full h-full bg-daw-bg">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 bg-daw-surface border-b
                   border-daw-border shrink-0"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        {/* Tool buttons */}
        <div className="flex items-center gap-1">
          <button
            className={`daw-button text-xxs px-2 py-1 ${
              tool === 'draw' ? 'daw-button-active' : ''
            }`}
            onClick={() => setTool('draw')}
            title="Draw (B)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <path d="M10 2l2 2-8 8H2v-2l8-8z" />
            </svg>
          </button>
          <button
            className={`daw-button text-xxs px-2 py-1 ${
              tool === 'select' ? 'daw-button-active' : ''
            }`}
            onClick={() => setTool('select')}
            title="Select (V)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <path d="M3 2l8 5-4 1-1 4-3-10z" />
            </svg>
          </button>
          <button
            className={`daw-button text-xxs px-2 py-1 ${
              tool === 'erase' ? 'daw-button-active' : ''
            }`}
            onClick={() => setTool('erase')}
            title="Erase (E)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <path d="M2 10l4-4 4 4H2zM6 6l4-4 2 2-4 4" />
            </svg>
          </button>
        </div>

        <div className="w-px h-5 bg-daw-border" />

        {/* Snap selector */}
        <div className="flex items-center gap-1">
          <span className="text-xxs text-daw-text-dim">Snap:</span>
          <select
            className="bg-daw-panel text-daw-text text-xxs px-1 py-0.5
                       border border-daw-border rounded outline-none
                       focus:border-daw-accent"
            value={snap}
            onChange={(e) => setSnap(e.target.value as SnapValue)}
          >
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
            <option value="1/32">1/32</option>
          </select>
        </div>

        <div className="w-px h-5 bg-daw-border" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            className="daw-button text-xxs px-1.5 py-0.5"
            onClick={zoomOut}
            title="Zoom out"
          >
            -
          </button>
          <span className="text-xxs text-daw-text-dim w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="daw-button text-xxs px-1.5 py-0.5"
            onClick={zoomIn}
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className="w-px h-5 bg-daw-border" />

        <span className="text-xxs text-daw-text-dim ml-1">
          {clip.name}
        </span>

        <div className="flex-1" />

        <span className="text-xxs text-daw-text-muted mr-2">
          {notes.length} notes
        </span>
        <button
          className="daw-button text-xxs px-2 py-0.5"
          onClick={onClose}
          title="Close piano roll"
        >
          Close
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden"
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
}
