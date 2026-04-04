import { useCallback, useRef } from 'react';

interface FaderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  height?: number;
  ghost?: number | null;
}

export default function Fader({
  value,
  min = -60,
  max = 6,
  onChange,
  label,
  height = 120,
  ghost = null,
}: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const valueToPercent = (v: number) =>
    ((v - min) / (max - min)) * 100;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const track = trackRef.current;
      if (!track) return;

      const update = (clientY: number) => {
        const rect = track.getBoundingClientRect();
        const pct = 1 - (clientY - rect.top) / rect.height;
        const val = min + pct * (max - min);
        onChange(Math.max(min, Math.min(max, Math.round(val * 10) / 10)));
      };

      update(e.clientY);

      const onMove = (ev: MouseEvent) => update(ev.clientY);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [min, max, onChange],
  );

  const pct = valueToPercent(value);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={trackRef}
        className="relative bg-daw-bg rounded-sm cursor-pointer"
        style={{ width: 24, height }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute bottom-0 left-0 right-0 bg-daw-accent/30 rounded-sm"
          style={{ height: `${pct}%` }}
        />

        {ghost !== null && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-daw-ai-accent/60"
            style={{ bottom: `${valueToPercent(ghost)}%` }}
          />
        )}

        <div
          className="absolute left-0 right-0 h-2 bg-daw-text rounded-sm
                     shadow-md cursor-grab active:cursor-grabbing"
          style={{ bottom: `calc(${pct}% - 4px)` }}
        />
      </div>
      <span className="text-[10px] text-daw-text-dim tabular-nums">
        {value > 0 ? `+${value}` : value} dB
      </span>
      {label && (
        <span className="text-[10px] text-daw-text-dim truncate max-w-[60px]">
          {label}
        </span>
      )}
    </div>
  );
}
