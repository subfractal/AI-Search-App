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
        {/* Fader slot (groove) — recessed industrial channel */}
        <div
          className="absolute"
          style={{
            width: slotW,
            left: (trackW - slotW) / 2,
            top: 3,
            bottom: 3,
            background: 'linear-gradient(to right, #030303, #080808, #030303)',
            border: '2px solid #111113',
            borderTopColor: '#0a0a0a',
            borderBottomColor: '#1a1a1c',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)',
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

        {/* Fader cap — industrial raised knob */}
        <div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: 0,
            right: 0,
            height: 22,
            bottom: `calc(${pct}% - 11px)`,
            background: 'linear-gradient(to bottom, #2a2a2c, #1e1e20, #181818)',
            border: '2px solid #333336',
            borderBottom: '2px solid #141416',
            borderTop: '2px solid #3a3a3c',
            boxShadow: '0 2px 4px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Grip lines — industrial knurling */}
          <div className="absolute inset-x-[3px] top-[4px] h-px bg-white/10" />
          <div className="absolute inset-x-[3px] top-[6px] h-px bg-black/40" />
          <div className="absolute inset-x-[3px] top-[8px] h-px bg-white/10" />
          <div className="absolute inset-x-[3px] top-[10px] h-px bg-black/40" />
          <div className="absolute inset-x-[3px] top-[12px] h-px bg-white/10" />
          <div className="absolute inset-x-[3px] top-[14px] h-px bg-black/40" />
          <div className="absolute inset-x-[3px] top-[16px] h-px bg-white/10" />
          {/* Center indicator line — Signal Red */}
          <div className="absolute left-1/2 -translate-x-1/2 top-[9px] w-2 h-0.5 bg-[#E63946]/60" />
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
