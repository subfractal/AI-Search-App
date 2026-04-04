import { useRef, useEffect, useCallback, useState } from 'react';
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
type SnapValue = 0.25 | 0.125 | 0.0625 | 0.03125;

const NOTE_HEIGHT = 12;
const PIANO_WIDTH = 44;
const VELOCITY_HEIGHT = 40;
const MIN_PITCH = 24;   // C1
const MAX_PITCH = 96;   // C7
const TOTAL_NOTES = MAX_PITCH - MIN_PITCH;

const BLACK_KEYS = new Set([1,3,6,8,10]);

export default function PianoRoll({ trackId, clip, onClose }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [tool, setTool] = useState<Tool>('draw');
  const [snap, setSnap] = useState<SnapValue>(0.125);
  const [zoom, setZoom] = useState(1);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(TOTAL_NOTES * NOTE_HEIGHT / 2 - 100);
  const [notes, setNotes] = useState<MidiNote[]>(() => [...clip.notes]);
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [dragState, setDragState] = useState<{
    type: 'create' | 'move' | 'resize';
    startX: number;
    startY: number;
    noteIndex?: number;
    originalNote?: MidiNote;
  } | null>(null);

  const bpm = useTransportStore((s) => s.bpm);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const removeClip = useSessionStore((s) => s.removeClip);

  const pps = 200 * zoom; // pixels per second
  const beatWidth = (60 / bpm) * pps;

  // Sync notes back to store
  useEffect(() => {
    const updatedClip: MidiClip = {
      ...clip,
      notes: [...notes],
      duration: Math.max(
        clip.duration,
        ...notes.map((n) => n.startTime + n.duration),
      ),
    };
    removeClip(trackId, clip.id);
    addClipToTrack(trackId, updatedClip);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const snapTime = (t: number): number => {
    const beatDuration = 60 / bpm;
    const snapDuration = beatDuration * snap * 4;
    return Math.round(t / snapDuration) * snapDuration;
  };

  const pitchFromY = (y: number): number => {
    return MAX_PITCH - Math.floor((y + scrollY) / NOTE_HEIGHT);
  };

  const timeFromX = (x: number): number => {
    return (x - PIANO_WIDTH + scrollX) / pps;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height: totalHeight } = container.getBoundingClientRect();
    const height = totalHeight - VELOCITY_HEIGHT;
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

    // Draw note rows
    for (let pitch = MIN_PITCH; pitch <= MAX_PITCH; pitch++) {
      const y = (MAX_PITCH - pitch) * NOTE_HEIGHT - scrollY;
      if (y + NOTE_HEIGHT < 0 || y > height) continue;

      const isBlack = BLACK_KEYS.has(pitch % 12);
      ctx.fillStyle = isBlack ? '#0f0f0f' : '#141414';
      ctx.fillRect(PIANO_WIDTH, y, width - PIANO_WIDTH, NOTE_HEIGHT);

      // Row separator
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PIANO_WIDTH, y + NOTE_HEIGHT);
      ctx.lineTo(width, y + NOTE_HEIGHT);
      ctx.stroke();
    }

    // Beat grid lines
    const beatDuration = 60 / bpm;
    const startBeat = Math.floor(scrollX / pps / beatDuration);
    const endBeat = Math.ceil((scrollX + width) / pps / beatDuration) + 1;

    for (let beat = startBeat; beat <= endBeat; beat++) {
      const x = PIANO_WIDTH + beat * beatDuration * pps - scrollX;
      if (x < PIANO_WIDTH || x > width) continue;

      ctx.strokeStyle = beat % 4 === 0 ? '#333' : '#1e1e1e';
      ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Beat numbers
      if (beat % 4 === 0) {
        ctx.fillStyle = '#555';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`${Math.floor(beat / 4) + 1}`, x + 2, 10);
      }
    }

    // Draw notes
    notes.forEach((note, i) => {
      const x = PIANO_WIDTH + note.startTime * pps - scrollX;
      const y = (MAX_PITCH - note.pitch) * NOTE_HEIGHT - scrollY;
      const w = Math.max(4, note.duration * pps);

      if (x + w < PIANO_WIDTH || x > width || y + NOTE_HEIGHT < 0 || y > height) return;

      const isSelected = selectedNotes.has(i);
      const alpha = Math.round((note.velocity / 127) * 200 + 55);
      const alphaHex = alpha.toString(16).padStart(2, '0');

      ctx.fillStyle = `#53c0f0${alphaHex}`;
      ctx.beginPath();
      ctx.roundRect(x, y + 1, w, NOTE_HEIGHT - 2, 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Resize handle
      ctx.fillStyle = '#ffffff30';
      ctx.fillRect(x + w - 3, y + 1, 3, NOTE_HEIGHT - 2);
    });

    // Piano keyboard
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, PIANO_WIDTH, height);

    for (let pitch = MIN_PITCH; pitch <= MAX_PITCH; pitch++) {
      const y = (MAX_PITCH - pitch) * NOTE_HEIGHT - scrollY;
      if (y + NOTE_HEIGHT < 0 || y > height) continue;

      const isBlack = BLACK_KEYS.has(pitch % 12);
      const noteIdx = pitch % 12;
      const octave = Math.floor(pitch / 12) - 1;

      ctx.fillStyle = isBlack ? '#111' : '#222';
      ctx.fillRect(0, y, PIANO_WIDTH - 1, NOTE_HEIGHT);

      if (noteIdx === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '8px Inter, sans-serif';
        ctx.fillText(`C${octave}`, 3, y + NOTE_HEIGHT - 2);
      }

      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + NOTE_HEIGHT);
      ctx.lineTo(PIANO_WIDTH, y + NOTE_HEIGHT);
      ctx.stroke();
    }

    // Velocity strip
    const velY = height;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, velY, width, VELOCITY_HEIGHT);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, velY);
    ctx.lineTo(width, velY);
    ctx.stroke();

    notes.forEach((note, i) => {
      const x = PIANO_WIDTH + note.startTime * pps - scrollX;
      if (x < PIANO_WIDTH || x > width) return;

      const velH = (note.velocity / 127) * (VELOCITY_HEIGHT - 4);
      const isSelected = selectedNotes.has(i);
      ctx.fillStyle = isSelected ? '#53c0f0' : '#53c0f080';
      ctx.fillRect(x, velY + VELOCITY_HEIGHT - velH - 2, Math.max(3, note.duration * pps), velH);
    });

    // Playhead
    const pos = getPositionSeconds() - clip.startTime;
    if (pos >= 0) {
      const px = PIANO_WIDTH + pos * pps - scrollX;
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, totalHeight);
      ctx.stroke();
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [notes, selectedNotes, scrollX, scrollY, zoom, pps, bpm, beatWidth, clip.startTime]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Piano keyboard click
    if (x < PIANO_WIDTH) {
      const pitch = pitchFromY(y);
      if (pitch >= MIN_PITCH && pitch <= MAX_PITCH) {
        triggerNote(trackId, midiToNoteName(pitch), '8n');
      }
      return;
    }

    const time = timeFromX(x);
    const pitch = pitchFromY(y);

    if (tool === 'draw') {
      const snappedTime = snapTime(Math.max(0, time));
      const duration = snapTime(60 / bpm * snap * 4) || 0.125;
      const newNote: MidiNote = {
        pitch,
        velocity: 100,
        startTime: snappedTime,
        duration,
      };
      setNotes((prev) => [...prev, newNote]);
      triggerNote(trackId, midiToNoteName(pitch), '8n');
    } else if (tool === 'select') {
      // Find clicked note
      const idx = notes.findIndex((n) => {
        const nx = PIANO_WIDTH + n.startTime * pps - scrollX;
        const ny = (MAX_PITCH - n.pitch) * NOTE_HEIGHT - scrollY;
        const nw = Math.max(4, n.duration * pps);
        return x >= nx && x <= nx + nw && y >= ny && y <= ny + NOTE_HEIGHT;
      });

      if (idx >= 0) {
        if (e.shiftKey) {
          setSelectedNotes((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
          });
        } else {
          setSelectedNotes(new Set([idx]));
          const note = notes[idx]!;
          const nx = PIANO_WIDTH + note.startTime * pps - scrollX;
          const nw = Math.max(4, note.duration * pps);

          // Check if clicking near right edge (resize)
          if (x > nx + nw - 6) {
            setDragState({
              type: 'resize',
              startX: x,
              startY: y,
              noteIndex: idx,
              originalNote: { ...note },
            });
          } else {
            setDragState({
              type: 'move',
              startX: x,
              startY: y,
              noteIndex: idx,
              originalNote: { ...note },
            });
          }
        }
      } else {
        setSelectedNotes(new Set());
      }
    } else if (tool === 'erase') {
      const idx = notes.findIndex((n) => {
        const nx = PIANO_WIDTH + n.startTime * pps - scrollX;
        const ny = (MAX_PITCH - n.pitch) * NOTE_HEIGHT - scrollY;
        const nw = Math.max(4, n.duration * pps);
        return x >= nx && x <= nx + nw && y >= ny && y <= ny + NOTE_HEIGHT;
      });
      if (idx >= 0) {
        setNotes((prev) => prev.filter((_, i) => i !== idx));
        setSelectedNotes(new Set());
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragState.type === 'move' && dragState.noteIndex !== undefined && dragState.originalNote) {
      const dx = (x - dragState.startX) / pps;
      const dy = Math.round((dragState.startY - y) / NOTE_HEIGHT);
      const newTime = snapTime(Math.max(0, dragState.originalNote.startTime + dx));
      const newPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, dragState.originalNote.pitch + dy));

      setNotes((prev) => prev.map((n, i) =>
        i === dragState.noteIndex ? { ...n, startTime: newTime, pitch: newPitch } : n,
      ));
    } else if (dragState.type === 'resize' && dragState.noteIndex !== undefined && dragState.originalNote) {
      const dx = (x - dragState.startX) / pps;
      const newDuration = snapTime(Math.max(0.03, dragState.originalNote.duration + dx));

      setNotes((prev) => prev.map((n, i) =>
        i === dragState.noteIndex ? { ...n, duration: newDuration } : n,
      ));
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.max(0.2, Math.min(5, z - e.deltaY * 0.002)));
    } else if (e.shiftKey) {
      setScrollX((s) => Math.max(0, s + e.deltaY));
    } else {
      setScrollY((s) => Math.max(0, Math.min(TOTAL_NOTES * NOTE_HEIGHT - 200, s + e.deltaY)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      setNotes((prev) => prev.filter((_, i) => !selectedNotes.has(i)));
      setSelectedNotes(new Set());
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-daw-surface"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 h-7 border-b border-daw-border/30 shrink-0">
        <button onClick={onClose} className="text-xxs text-daw-text-muted hover:text-daw-text mr-1">
          ✕
        </button>
        <span className="daw-section-label mr-2">Piano Roll</span>

        {(['draw', 'select', 'erase'] as Tool[]).map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`daw-button text-xxs px-2 py-0.5
                       ${tool === t ? 'daw-button-active' : ''}`}
          >
            {t === 'draw' ? '✏' : t === 'select' ? '↖' : '⌫'}
            <span className="ml-0.5">{t[0]!.toUpperCase() + t.slice(1)}</span>
          </button>
        ))}

        <div className="daw-divider mx-1" />

        <span className="text-xxs text-daw-text-muted">Snap</span>
        <select
          value={snap}
          onChange={(e) => setSnap(parseFloat(e.target.value) as SnapValue)}
          className="daw-input text-xxs py-0 w-14"
        >
          <option value={0.25}>1/4</option>
          <option value={0.125}>1/8</option>
          <option value={0.0625}>1/16</option>
          <option value={0.03125}>1/32</option>
        </select>

        <div className="flex-1" />
        <span className="text-xxs text-daw-text-muted">
          {notes.length} notes
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden cursor-crosshair"
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();
            // Right-click delete
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const idx = notes.findIndex((n) => {
              const nx = PIANO_WIDTH + n.startTime * pps - scrollX;
              const ny = (MAX_PITCH - n.pitch) * NOTE_HEIGHT - scrollY;
              const nw = Math.max(4, n.duration * pps);
              return x >= nx && x <= nx + nw && y >= ny && y <= ny + NOTE_HEIGHT;
            });
            if (idx >= 0) {
              setNotes((prev) => prev.filter((_, i) => i !== idx));
            }
          }}
        />
      </div>
    </div>
  );
}
