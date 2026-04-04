import { useCallback, useRef } from 'react';

interface KnobProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  size?: number;
}

export default function Knob({
  value,
  min = -1,
  max = 1,
  onChange,
  label,
  size = 32,
}: KnobProps) {
  const startY = useRef(0);
  const startValue = useRef(0);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startY.current = e.clientY;
      startValue.current = value;

      const onMove = (ev: MouseEvent) => {
        const delta = (startY.current - ev.clientY) / 100;
        const newVal = startValue.current + delta * (max - min);
        onChange(
          Math.round(
            Math.max(min, Math.min(max, newVal)) * 100,
          ) / 100,
        );
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [value, min, max, onChange],
  );

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative rounded-full bg-daw-bg border border-daw-grid/50
                   cursor-pointer select-none"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        <div
          className="absolute inset-1 rounded-full border border-daw-grid/30"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2
                       bg-daw-accent rounded-full"
          />
        </div>
      </div>
      {label && (
        <span className="text-[10px] text-daw-text-dim">{label}</span>
      )}
    </div>
  );
}
