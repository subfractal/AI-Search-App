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

      const update = (clientY: number, shiftKey: boolean) => {
        const rect = track.getBoundingClientRect();
        const pct = 1 - (clientY - rect.top) / rect.height;
        const range = maxRef.current - minRef.current;
        let val = minRef.current + pct * range;
        const precision = shiftKey ? 100 : 10;
        val = Math.round(val * precision) / precision;
        onChangeRef.current(
          Math.max(minRef.current, Math.min(maxRef.current, val)),
        );
      };

      const startY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
      const shiftKey = !('touches' in e) && (e as React.MouseEvent).shiftKey;
      update(startY, shiftKey);

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const y = 'touches' in ev ? ev.touches[0]!.clientY : (ev as MouseEvent).clientY;
        const shift = 'shiftKey' in ev ? ev.shiftKey : false;
        update(y, shift);
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

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChangeRef.current(0);
    },
    [],
  );

  const pct = valueToPercent(value);
  const unityPct = valueToPercent(0);
  const trackW = width;
  const slotW = Math.max(4, trackW - 12);

  const ticks = [-48, -36, -24, -12, 0, 6].filter((t) => t >= min && t <= max);

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && (
        <span className="text-[8px] text-daw-text-muted/50 uppercase leading-none"
              style={{ letterSpacing: '1.5px' }}>
          {label}
        </span>
      )}
      <div
        ref={trackRef}
        className="relative cursor-pointer touch-none select-none"
        style={{ width: trackW, height }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Fader slot (groove) — sharp edges */}
        <div
          className="absolute"
          style={{
            width: slotW,
            left: (trackW - slotW) / 2,
            top: 4,
            bottom: 4,
            background: 'linear-gradient(to top, #050505 0%, #0F0F11 100%)',
            border: '1px solid #222224',
          }}
        />

        {/* Fill */}
        <div
          className="absolute"
          style={{
            width: slotW - 2,
            left: (trackW - slotW) / 2 + 1,
            bottom: 5,
            height: `${Math.max(0, pct - 2)}%`,
            background: 'linear-gradient(to top, rgba(230,57,70,0.2) 0%, rgba(230,57,70,0.03) 100%)',
          }}
        />

        {/* Tick marks */}
        {ticks.map((tick) => {
          const y = (1 - valueToPercent(tick) / 100) * (height - 8) + 4;
          const isUnity = tick === 0;
          return (
            <div key={tick} className="absolute flex items-center" style={{ top: y, left: 0, right: 0 }}>
              <div className={isUnity ? 'w-1.5 h-px bg-daw-text-muted/30' : 'w-1 h-px bg-daw-text-muted/15'} />
              <div className="flex-1" />
              <div className={isUnity ? 'w-1.5 h-px bg-daw-text-muted/30' : 'w-1 h-px bg-daw-text-muted/15'} />
            </div>
          );
        })}

        {/* Unity mark */}
        <div
          className="absolute h-px bg-daw-text-muted/25"
          style={{ bottom: `${unityPct}%`, left: 2, right: 2 }}
        />

        {/* Ghost suggestion — Signal Red */}
        {ghost !== null && (
          <div
            className="absolute left-1 right-1 h-[3px]"
            style={{
              bottom: `${valueToPercent(ghost)}%`,
              background: 'rgba(230, 57, 70, 0.5)',
            }}
          />
        )}

        {/* Fader cap — flat industrial */}
        <div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: 1,
            right: 1,
            height: 18,
            bottom: `calc(${pct}% - 9px)`,
            background: '#222224',
            border: '1px solid #333',
            borderBottom: '1px solid #1a1a1a',
          }}
        >
          {/* Grip lines */}
          <div className="absolute inset-x-[3px] top-[5px] h-px bg-white/8" />
          <div className="absolute inset-x-[3px] top-[7px] h-px bg-black/30" />
          <div className="absolute inset-x-[3px] top-[9px] h-px bg-white/8" />
          <div className="absolute inset-x-[3px] top-[11px] h-px bg-black/30" />
          <div className="absolute inset-x-[3px] top-[13px] h-px bg-white/8" />
        </div>
      </div>

      {/* Value readout */}
      {showValue && (
        <span className="text-[8px] font-mono text-daw-text-muted/50 tabular-nums leading-none">
          {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
