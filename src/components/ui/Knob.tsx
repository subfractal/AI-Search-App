import { useRef, useCallback } from 'react';

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  size?: number;
  showValue?: boolean;
  color?: string;
}

export default function Knob({
  value,
  min = -1,
  max = 1,
  onChange,
  label,
  size = 28,
  showValue = false,
  color = '#ff6b35',
}: KnobProps) {
  const startY = useRef(0);
  const startValue = useRef(0);
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);
  onChangeRef.current = onChange;
  minRef.current = min;
  maxRef.current = max;

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135;

  const startDrag = useCallback(
    (clientY: number) => {
      startY.current = clientY;
      startValue.current = value;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const y = 'touches' in ev ? ev.touches[0]!.clientY : (ev as MouseEvent).clientY;
        const delta = (startY.current - y) / 100;
        const range = maxRef.current - minRef.current;
        const newVal = startValue.current + delta * range;
        const clamped = Math.max(minRef.current, Math.min(maxRef.current, newVal));
        onChangeRef.current(Math.round(clamped * 100) / 100);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    },
    [value],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startDrag(e.clientY);
    },
    [startDrag],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startDrag(e.touches[0]!.clientY);
    },
    [startDrag],
  );

  const r = size / 2 - 3;
  const trackR = r + 1;
  const cx = size / 2;
  const cy = size / 2;
  const pointerLen = r - 4;

  // Track arc (full 270 degrees, background)
  const trackStart = -225 * (Math.PI / 180);
  const trackEnd = trackStart + 270 * (Math.PI / 180);

  // Value arc
  const arcEnd = trackStart + normalizedValue * 270 * (Math.PI / 180);

  return (
    <div className="flex flex-col items-center gap-0.5 touch-none select-none">
      <svg
        width={size}
        height={size}
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <defs>
          {/* Subtle radial gradient for knob body */}
          <radialGradient id={`knob-grad-${size}`} cx="40%" cy="35%">
            <stop offset="0%" stopColor="#3a3a45" />
            <stop offset="60%" stopColor="#222228" />
            <stop offset="100%" stopColor="#18181e" />
          </radialGradient>
          {/* Glow filter for value arc */}
          <filter id={`knob-glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track ring */}
        <path
          d={describeArc(cx, cy, trackR, trackStart, trackEnd)}
          fill="none"
          stroke="#1a1a22"
          strokeWidth={size > 24 ? 3 : 2.5}
          strokeLinecap="round"
        />

        {/* Value arc ring */}
        {normalizedValue > 0.005 && (
          <path
            d={describeArc(cx, cy, trackR, trackStart, arcEnd)}
            fill="none"
            stroke={color}
            strokeWidth={size > 24 ? 3 : 2.5}
            strokeLinecap="round"
            opacity={0.85}
            filter={`url(#knob-glow-${size})`}
          />
        )}

        {/* Knob body */}
        <circle
          cx={cx} cy={cy} r={r}
          fill={`url(#knob-grad-${size})`}
          stroke="#2a2a35"
          strokeWidth="0.5"
        />

        {/* Subtle inner highlight */}
        <circle
          cx={cx} cy={cy - 1} r={r - 2}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="0.5"
        />

        {/* Pointer line */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + pointerLen * Math.cos(rotation * Math.PI / 180)}
          y2={cy + pointerLen * Math.sin(rotation * Math.PI / 180)}
          stroke="#d0d0e0"
          strokeWidth={size > 24 ? 1.5 : 1}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={size > 24 ? 1.5 : 1} fill="#555568" />
      </svg>
      {showValue && (
        <span className="text-[8px] font-mono text-daw-text-dim tabular-nums leading-none">
          {value.toFixed(max >= 10 ? 0 : 1)}
        </span>
      )}
      {label && (
        <span className="text-[8px] text-daw-text-muted leading-none tracking-wide uppercase">
          {label}
        </span>
      )}
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  const end = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    'M', start.x, start.y,
    'A', r, r, 0, largeArc, 0, end.x, end.y,
  ].join(' ');
}
