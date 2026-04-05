import { useRef, useEffect, useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useAutomationStore } from '@/stores/automation-store';
import type { AutomationTarget, AutomationPoint } from '@/types/automation';

const TARGET_LABELS: Record<AutomationTarget, string> = {
  volume: 'Volume',
  pan: 'Pan',
  mute: 'Mute',
  filterFrequency: 'Filter Freq',
  filterResonance: 'Filter Res',
  effectParam: 'Effect',
};

const TARGETS: AutomationTarget[] = ['volume', 'pan', 'mute', 'filterFrequency', 'filterResonance'];

export default function AutomationPanel() {
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const tracks = useSessionStore((s) => s.tracks);
  const lanes = useAutomationStore((s) => selectedTrackId ? (s.lanes[selectedTrackId] ?? []) : []);
  const addLane = useAutomationStore((s) => s.addLane);
  const removeLane = useAutomationStore((s) => s.removeLane);
  const addPoint = useAutomationStore((s) => s.addPoint);
  const removePoint = useAutomationStore((s) => s.removePoint);
  const toggleLane = useAutomationStore((s) => s.toggleLane);
  const toggleLaneVisibility = useAutomationStore((s) => s.toggleLaneVisibility);

  const track = tracks.find((t) => t.id === selectedTrackId);

  if (!selectedTrackId || !track) {
    return (
      <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
        Select a track to edit automation
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Lane list sidebar */}
      <div className="w-44 shrink-0 border-r border-daw-border/30 p-2 overflow-y-auto">
        <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#E63946]/90 mb-2">
          AUTOMATION — {track.name}
        </div>

        {/* Add lane */}
        <select
          onChange={(e) => {
            if (e.target.value) {
              addLane(selectedTrackId, e.target.value as AutomationTarget);
              e.target.value = '';
            }
          }}
          className="w-full bg-daw-surface-light/10 border border-daw-border/30 text-[9px] text-daw-text font-mono px-1 py-0.5 mb-2"
          defaultValue=""
          aria-label="Add automation lane"
        >
          <option value="" disabled>Add Lane...</option>
          {TARGETS.map((t) => (
            <option key={t} value={t}>{TARGET_LABELS[t]}</option>
          ))}
        </select>

        {/* Lane list */}
        <div className="space-y-1">
          {lanes.map((lane) => (
            <div
              key={lane.id}
              className="flex items-center gap-1 text-[9px] font-mono"
            >
              <button
                onClick={() => toggleLane(selectedTrackId, lane.id)}
                className={`w-2.5 h-2.5 rounded-sm border flex-shrink-0 ${
                  lane.enabled ? 'border-transparent' : 'border-daw-border'
                }`}
                style={{ backgroundColor: lane.enabled ? lane.color : 'transparent' }}
                aria-label={`Toggle ${TARGET_LABELS[lane.target]} lane`}
              />
              <button
                onClick={() => toggleLaneVisibility(selectedTrackId, lane.id)}
                className={`flex-1 text-left truncate ${
                  lane.visible ? 'text-daw-text' : 'text-daw-text-muted/40'
                }`}
              >
                {TARGET_LABELS[lane.target]}
                {lane.paramName ? ` (${lane.paramName})` : ''}
              </button>
              <span className="text-daw-text-muted/40">{lane.points.length}pt</span>
              <button
                onClick={() => removeLane(selectedTrackId, lane.id)}
                className="text-daw-text-muted/30 hover:text-[#E63946]"
                aria-label={`Remove ${TARGET_LABELS[lane.target]} lane`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {lanes.length === 0 && (
          <div className="text-[8px] text-daw-text-muted/40 mt-2">
            No automation lanes. Add one above.
          </div>
        )}
      </div>

      {/* Canvas area for drawing automation */}
      <div className="flex-1 min-w-0">
        {lanes.filter((l) => l.visible).map((lane) => (
          <AutomationLaneCanvas
            key={lane.id}
            trackId={selectedTrackId}
            laneId={lane.id}
            points={lane.points}
            color={lane.color}
            enabled={lane.enabled}
            minValue={lane.minValue}
            maxValue={lane.maxValue}
            label={TARGET_LABELS[lane.target]}
            onAddPoint={(pt) => addPoint(selectedTrackId, lane.id, pt)}
            onRemovePoint={(idx) => removePoint(selectedTrackId, lane.id, idx)}
          />
        ))}
        {lanes.filter((l) => l.visible).length === 0 && (
          <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted/40">
            No visible lanes
          </div>
        )}
      </div>
    </div>
  );
}

interface LaneCanvasProps {
  trackId: string;
  laneId: string;
  points: AutomationPoint[];
  color: string;
  enabled: boolean;
  minValue: number;
  maxValue: number;
  label: string;
  onAddPoint: (pt: AutomationPoint) => void;
  onRemovePoint: (index: number) => void;
}

function AutomationLaneCanvas({
  points, color, enabled, minValue, maxValue, label, onAddPoint, onRemovePoint,
}: LaneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = enabled ? color : '#444';
    ctx.font = '9px monospace';
    ctx.fillText(label, 4, 12);

    if (points.length === 0) return;

    // Find time range
    const maxTime = Math.max(16, ...points.map((p) => p.time));
    const range = maxValue - minValue;

    // Draw automation line
    ctx.strokeStyle = enabled ? color : '#444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      const x = (pt.time / maxTime) * w;
      const y = h - ((pt.value - minValue) / range) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw points
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      const x = (pt.time / maxTime) * w;
      const y = h - ((pt.value - minValue) / range) * h;
      ctx.fillStyle = enabled ? color : '#666';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [points, color, enabled, minValue, maxValue, label]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio);
      draw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const maxTime = Math.max(16, ...points.map((p) => p.time));
    const range = maxValue - minValue;
    const time = (x / w) * maxTime;
    const value = minValue + (1 - y / h) * range;

    // Check if clicking near an existing point (to remove)
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      const px = (pt.time / maxTime) * w;
      const py = h - ((pt.value - minValue) / range) * h;
      if (Math.abs(px - x) < 8 && Math.abs(py - y) < 8) {
        onRemovePoint(i);
        return;
      }
    }

    // Add new point
    onAddPoint({ time, value, curve: 'linear' });
  }, [points, minValue, maxValue, onAddPoint, onRemovePoint]);

  return (
    <div className="border-b border-daw-border/20" style={{ height: 80 }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onClick={handleClick}
        role="img"
        aria-label={`${label} automation lane`}
      />
    </div>
  );
}
