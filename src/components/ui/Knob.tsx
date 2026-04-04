import { useRef, useCallback } from 'react';

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  size?: number;
  showValue?: boolean;
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startY.current = e.clientY;
      startValue.current = value;

      const onMove = (ev: MouseEvent) => {
        const delta = (startY.current - ev.clientY) / 100;
        const range = maxRef.current - minRef.current;
        const newVal = startValue.current + delta * range;
        const clamped = Math.max(minRef.current, Math.min(maxRef.current, newVal));
        onChangeRef.current(Math.round(clamped * 100) / 100);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [value],
  );

  const r = size / 2 - 2;
  const arcStart = -225 * (Math.PI / 180);
  const arcEnd = arcStart + normalizedValue * 270 * (Math.PI / 180);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg
        width={size}
        height={size}
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
      >
        {/* Background track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="#111"
          stroke="#333"
          strokeWidth="1"
        />

        {/* Value arc */}
        <path
          d={describeArc(cx, cy, r - 1, arcStart, arcEnd)}
          fill="none"
          stroke="#ff6b35"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.7}
        />

        {/* Pointer line */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 3) * Math.cos(rotation * Math.PI / 180)}
          y2={cy + (r - 3) * Math.sin(rotation * Math.PI / 180)}
          stroke="#ccc"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="2" fill="#444" />
      </svg>
      {showValue && (
        <span className="text-[8px] font-mono text-daw-text-dim tabular-nums leading-none">
          {value.toFixed(max >= 10 ? 0 : 1)}
        </span>
      )}
      {label && (
        <span className="text-xxs text-daw-text-muted leading-none">
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
