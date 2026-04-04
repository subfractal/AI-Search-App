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
  height = 100,
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
        className="relative rounded cursor-pointer"
        style={{
          width: 20,
          height,
          background: 'linear-gradient(to top, #111 0%, #1a1a1a 100%)',
          border: '1px solid #2a2a2a',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Fill */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b"
          style={{
            height: `${pct}%`,
            background: `linear-gradient(to top, #ff6b3520 0%, #ff6b3508 100%)`,
          }}
        />

        {/* Unity (0dB) mark */}
        <div
          className="absolute left-0 right-0 h-px bg-daw-text-muted/30"
          style={{ bottom: `${valueToPercent(0)}%` }}
        />

        {/* Ghost suggestion */}
        {ghost !== null && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-daw-ai-accent/50"
            style={{ bottom: `${valueToPercent(ghost)}%` }}
          />
        )}

        {/* Fader thumb */}
        <div
          className="absolute -left-[1px] -right-[1px] h-3 rounded-sm
                     cursor-grab active:cursor-grabbing"
          style={{
            bottom: `calc(${pct}% - 6px)`,
            background: 'linear-gradient(to bottom, #666 0%, #444 50%, #333 100%)',
            border: '1px solid #555',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {/* Grip lines */}
          <div className="absolute inset-x-1 top-[4px] h-px bg-white/10" />
          <div className="absolute inset-x-1 top-[6px] h-px bg-white/10" />
        </div>
      </div>

      {/* Value readout */}
      <span className="text-xxs font-mono text-daw-text-muted tabular-nums
                        leading-none">
        {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
      </span>
      {label && (
        <span className="text-xxs text-daw-text-muted truncate max-w-[54px]
                          leading-none">
          {label}
        </span>
      )}
    </div>
  );
}
