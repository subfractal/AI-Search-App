import { useCallback, useRef } from 'react';

interface FaderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  height?: number;
  width?: number;
  ghost?: number | null;
  showValue?: boolean;
}

export default function Fader({
  value,
  min = -60,
  max = 6,
  onChange,
  label,
  height = 100,
  width = 28,
  ghost = null,
  showValue = true,
}: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  onChangeRef.current = onChange;
  minRef.current = min;
  maxRef.current = max;

  const valueToPercent = (v: number) =>
    ((v - min) / (max - min)) * 100;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const track = trackRef.current;
      if (!track) return;

      const update = (clientY: number) => {
        const rect = track.getBoundingClientRect();
        const pct = 1 - (clientY - rect.top) / rect.height;
        const val = minRef.current + pct * (maxRef.current - minRef.current);
        onChangeRef.current(
          Math.max(minRef.current, Math.min(maxRef.current, Math.round(val * 10) / 10)),
        );
      };

      const startY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
      update(startY);

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const y = 'touches' in ev ? ev.touches[0]!.clientY : (ev as MouseEvent).clientY;
        update(y);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onUp);
    },
    [],
  );

  const pct = valueToPercent(value);
  const unityPct = valueToPercent(0);
  const trackW = width;
  const slotW = Math.max(4, trackW - 12);

  // Tick marks at -48, -36, -24, -12, 0, +6
  const ticks = [-48, -36, -24, -12, 0, 6].filter((t) => t >= min && t <= max);

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && (
        <span className="text-[8px] text-daw-text-muted/60 uppercase tracking-wide leading-none">
          {label}
        </span>
      )}
      <div
        ref={trackRef}
        className="relative cursor-pointer touch-none select-none"
        style={{ width: trackW, height }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Fader slot (groove) */}
        <div
          className="absolute rounded-full"
          style={{
            width: slotW,
            left: (trackW - slotW) / 2,
            top: 4,
            bottom: 4,
            background: 'linear-gradient(to top, #0a0a0a 0%, #151515 100%)',
            border: '1px solid #222',
          }}
        />

        {/* Fill glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: slotW - 2,
            left: (trackW - slotW) / 2 + 1,
            bottom: 5,
            height: `${Math.max(0, pct - 2)}%`,
            background: 'linear-gradient(to top, #ff6b3530 0%, #ff6b3508 100%)',
          }}
        />

        {/* Tick marks */}
        {ticks.map((tick) => {
          const y = (1 - valueToPercent(tick) / 100) * (height - 8) + 4;
          return (
            <div key={tick} className="absolute flex items-center" style={{ top: y, left: 0, right: 0 }}>
              <div className="w-1 h-px bg-daw-text-muted/20" />
              <div className="flex-1" />
              <div className="w-1 h-px bg-daw-text-muted/20" />
            </div>
          );
        })}

        {/* Unity (0dB) mark — stronger */}
        <div
          className="absolute h-px bg-daw-text-muted/40"
          style={{
            bottom: `${unityPct}%`,
            left: 0,
            right: 0,
          }}
        />

        {/* Ghost suggestion */}
        {ghost !== null && (
          <div
            className="absolute left-0 right-0 h-0.5 bg-daw-ai-accent/50"
            style={{ bottom: `${valueToPercent(ghost)}%` }}
          />
        )}

        {/* Fader cap / thumb */}
        <div
          className="absolute rounded-sm cursor-grab active:cursor-grabbing"
          style={{
            left: 1,
            right: 1,
            height: 16,
            bottom: `calc(${pct}% - 8px)`,
            background: 'linear-gradient(to bottom, #777 0%, #555 30%, #444 70%, #333 100%)',
            border: '1px solid #666',
            boxShadow: '0 1px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          {/* Grip lines on the cap */}
          <div className="absolute inset-x-1 top-[5px] h-px bg-white/10" />
          <div className="absolute inset-x-1 top-[7px] h-px bg-black/20" />
          <div className="absolute inset-x-1 top-[9px] h-px bg-white/10" />
          <div className="absolute inset-x-1 top-[11px] h-px bg-black/20" />
        </div>
      </div>

      {/* Value readout */}
      {showValue && (
        <span className="text-[8px] font-mono text-daw-text-muted/60 tabular-nums leading-none">
          {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
