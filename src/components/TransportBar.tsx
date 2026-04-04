import { useEffect, useRef, useState } from 'react';
import { useTransportStore } from '@/stores/transport-store';
import { getPositionSeconds } from '@/services/transport-service';
import { formatSeconds, formatBarsBeats } from '@/utils/format-time';

interface TransportBarProps {
  showMixer: boolean;
  onToggleMixer: () => void;
  showAI: boolean;
  onToggleAI: () => void;
}

export default function TransportBar({
  showMixer,
  onToggleMixer,
  showAI,
  onToggleAI,
}: TransportBarProps) {
  const {
    state, bpm, loopEnabled,
    play, pause, stop, toggleRecord, setBpm, toggleLoop,
  } = useTransportStore();

  const [position, setPosition] = useState(0);
  const [bpmInput, setBpmInput] = useState(String(bpm));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      setPosition(getPositionSeconds());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    setBpmInput(String(bpm));
  }, [bpm]);

  const handleBpmChange = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (val >= 20 && val <= 999) {
      setBpm(val);
    } else {
      setBpmInput(String(bpm));
    }
  };

  const isPlaying = state === 'playing';
  const isRecording = state === 'recording';

  return (
    <div className="daw-panel flex items-center gap-3 px-4 py-2 border-b
                    border-daw-grid/30 select-none">
      <div className="flex items-center gap-1">
        <button
          onClick={stop}
          className={`daw-button ${state === 'stopped' ? 'daw-button-active' : ''}`}
          title="Stop"
        >
          &#9632;
        </button>
        <button
          onClick={isPlaying ? pause : play}
          className={`daw-button ${isPlaying ? 'daw-button-active' : ''}`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '&#10074;&#10074;' : '&#9654;'}
        </button>
        <button
          onClick={toggleRecord}
          className={`daw-button ${isRecording ? 'bg-red-600 text-white' : ''}`}
          title="Record"
        >
          &#9679;
        </button>
      </div>

      <div className="w-px h-6 bg-daw-grid/50" />

      <div className="flex flex-col items-center text-xs leading-tight">
        <span className="text-daw-text-dim text-[10px]">TIME</span>
        <span className="tabular-nums">{formatSeconds(position)}</span>
      </div>

      <div className="flex flex-col items-center text-xs leading-tight">
        <span className="text-daw-text-dim text-[10px]">BARS</span>
        <span className="tabular-nums">
          {formatBarsBeats(position, bpm, 4)}
        </span>
      </div>

      <div className="w-px h-6 bg-daw-grid/50" />

      <div className="flex items-center gap-1">
        <span className="text-xs text-daw-text-dim">BPM</span>
        <input
          type="number"
          value={bpmInput}
          onChange={(e) => setBpmInput(e.target.value)}
          onBlur={handleBpmChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="daw-input w-14 text-center text-sm"
          min={20}
          max={999}
        />
      </div>

      <button
        onClick={toggleLoop}
        className={`daw-button text-xs ${loopEnabled ? 'daw-button-active' : ''}`}
        title="Toggle Loop"
      >
        LOOP
      </button>

      <div className="flex-1" />

      <button
        onClick={onToggleMixer}
        className={`daw-button text-xs ${showMixer ? 'daw-button-active' : ''}`}
      >
        MIXER
      </button>
      <button
        onClick={onToggleAI}
        className={`daw-button text-xs ${showAI ? 'bg-daw-ai-suggestion text-white' : ''}`}
      >
        AI
      </button>
    </div>
  );
}
