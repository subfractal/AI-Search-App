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

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;
  const pointerInner = r * 0.55;
  const pointerOuter = r * 0.85;

  // Knurling: radial tick marks around the perimeter
  const knurlCount = size >= 22 ? 24 : 12;
  const knurlR1 = r - 1;
  const knurlR2 = r + 1;

  const knurlTicks = Array.from({ length: knurlCount }, (_, i) => {
    const angle = (i / knurlCount) * 360 * (Math.PI / 180);
    return {
      x1: cx + knurlR1 * Math.cos(angle),
      y1: cy + knurlR1 * Math.sin(angle),
      x2: cx + knurlR2 * Math.cos(angle),
      y2: cy + knurlR2 * Math.sin(angle),
    };
  });

  // Pointer angle
  const pointerAngle = rotation * (Math.PI / 180);

  return (
    <div className="flex flex-col items-center gap-0.5 touch-none select-none">
      <svg
        width={size}
        height={size}
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Knob body — industrial brushed metal */}
        <defs>
          <radialGradient id={`knob-grad-${size}`} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2a2a2c" />
            <stop offset="100%" stopColor="#111113" />
          </radialGradient>
        </defs>
        <circle
          cx={cx} cy={cy} r={r}
          fill={`url(#knob-grad-${size})`}
          stroke="#333336"
          strokeWidth="1.5"
        />

        {/* Knurling texture — fine radial marks */}
        {knurlTicks.map((tick, i) => (
          <line
            key={i}
            x1={tick.x1} y1={tick.y1}
            x2={tick.x2} y2={tick.y2}
            stroke="#333336"
            strokeWidth="0.6"
          />
        ))}

        {/* Single pointer tick — Signal Red indicator */}
        <line
          x1={cx + pointerInner * Math.cos(pointerAngle)}
          y1={cy + pointerInner * Math.sin(pointerAngle)}
          x2={cx + pointerOuter * Math.cos(pointerAngle)}
          y2={cy + pointerOuter * Math.sin(pointerAngle)}
          stroke="#E63946"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {showValue && (
        <span className="text-[8px] font-mono text-daw-text-dim tabular-nums leading-none">
          {value.toFixed(max >= 10 ? 0 : 1)}
        </span>
      )}
      {label && (
        <span className="text-[8px] text-daw-text-muted leading-none uppercase"
              style={{ letterSpacing: '1.5px' }}>
          {label}
        </span>
      )}
    </div>
  );
}
