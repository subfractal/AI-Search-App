import { useEffect, useRef, useState } from 'react';
import { useTransportStore } from '@/stores/transport-store';
import { useHistoryStore } from '@/stores/history-store';
import { getPositionSeconds } from '@/services/transport-service';
import { formatSeconds, formatBarsBeats } from '@/utils/format-time';

import type { BottomPanel } from '@/App';

interface TransportBarProps {
  activePanel: BottomPanel;
  onTogglePanel: (panel: BottomPanel) => void;
  showAI: boolean;
  onToggleAI: () => void;
  onExport?: () => void;
  onHistory?: () => void;
  onPianoRoll?: () => void;
}

function IconStop() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="10" height="10" rx="1" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2 1.5v9l8.5-4.5L2 1.5z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1.5" y="1" width="3" height="10" rx="0.5" />
      <rect x="7.5" y="1" width="3" height="10" rx="0.5" />
    </svg>
  );
}

function IconRecord() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="6" cy="6" r="5" />
    </svg>
  );
}

function IconLoop() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M10.5 3.5H5a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H3.5" />
      <path d="M8.5 1.5l2 2-2 2" />
      <path d="M5.5 12.5l-2-2 2-2" />
    </svg>
  );
}

export default function TransportBar({
  activePanel,
  onTogglePanel,
  showAI,
  onToggleAI,
  onExport,
  onHistory,
  onPianoRoll,
}: TransportBarProps) {
  const {
    state, bpm, loopEnabled,
    play, pause, stop, toggleRecord, setBpm, toggleLoop,
  } = useTransportStore();

  const undoCount = useHistoryStore((s) => s.undoCount);
  const redoCount = useHistoryStore((s) => s.redoCount);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

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
    <div className="flex items-center h-11 px-3 gap-2 bg-daw-transport-bg
                    border-b border-daw-border/60 select-none shrink-0">
      {/* Transport controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={stop}
          className={`w-8 h-7 flex items-center justify-center rounded
                     transition-all duration-75
                     ${state === 'stopped'
              ? 'text-daw-text bg-daw-panel'
              : 'text-daw-text-muted hover:text-daw-text-dim'}`}
          title="Stop"
        >
          <IconStop />
        </button>
        <button
          onClick={isPlaying ? pause : play}
          className={`w-8 h-7 flex items-center justify-center rounded
                     transition-all duration-75
                     ${isPlaying
              ? 'text-daw-transport-play bg-daw-transport-play/10'
              : 'text-daw-text-muted hover:text-daw-text-dim'}`}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <button
          onClick={toggleRecord}
          className={`w-8 h-7 flex items-center justify-center rounded
                     transition-all duration-75
                     ${isRecording
              ? 'text-daw-transport-record bg-daw-transport-record/10 animate-pulse'
              : 'text-daw-text-muted hover:text-daw-transport-record/60'}`}
          title="Record"
        >
          <IconRecord />
        </button>
      </div>

      <div className="daw-divider mx-1" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={undo}
          disabled={undoCount === 0}
          className="w-7 h-7 flex items-center justify-center rounded
                     text-daw-text-muted hover:text-daw-text-dim transition-all
                     disabled:opacity-20"
          title="Undo"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 4l-2 2 2 2" />
            <path d="M1 6h7a3 3 0 010 6H6" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={redoCount === 0}
          className="w-7 h-7 flex items-center justify-center rounded
                     text-daw-text-muted hover:text-daw-text-dim transition-all
                     disabled:opacity-20"
          title="Redo"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 4l2 2-2 2" />
            <path d="M11 6H4a3 3 0 000 6h2" />
          </svg>
        </button>
      </div>

      <div className="daw-divider mx-1" />

      {/* Position displays */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center min-w-[70px]">
          <span className="text-xxs text-daw-text-muted leading-none mb-0.5">
            TIME
          </span>
          <span className="text-sm font-mono tabular-nums text-daw-text leading-none">
            {formatSeconds(position)}
          </span>
        </div>

        <div className="flex flex-col items-center min-w-[60px]">
          <span className="text-xxs text-daw-text-muted leading-none mb-0.5">
            BARS
          </span>
          <span className="text-sm font-mono tabular-nums text-daw-text leading-none">
            {formatBarsBeats(position, bpm, 4)}
          </span>
        </div>
      </div>

      <div className="daw-divider mx-1" />

      {/* BPM */}
      <div className="flex flex-col items-center">
        <span className="text-xxs text-daw-text-muted leading-none mb-0.5">
          BPM
        </span>
        <input
          type="number"
          value={bpmInput}
          onChange={(e) => setBpmInput(e.target.value)}
          onBlur={handleBpmChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="w-12 text-center text-sm font-mono bg-daw-bg
                     border border-daw-border/60 rounded px-1 py-0
                     text-daw-accent focus:outline-none focus:border-daw-accent/50
                     leading-tight"
          min={20}
          max={999}
        />
      </div>

      {/* Loop */}
      <button
        onClick={toggleLoop}
        className={`w-8 h-7 flex items-center justify-center rounded
                   transition-all duration-75
                   ${loopEnabled
            ? 'text-daw-accent bg-daw-accent/10'
            : 'text-daw-text-muted hover:text-daw-text-dim'}`}
        title="Toggle Loop"
      >
        <IconLoop />
      </button>

      <div className="flex-1" />

      {/* Panel toggles */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onTogglePanel('mixer')}
          className={`daw-button text-xxs px-2 py-0.5
                     ${activePanel === 'mixer' ? 'daw-button-active' : ''}`}
        >
          Mixer
        </button>
        <button
          onClick={() => onTogglePanel('instrument')}
          className={`daw-button text-xxs px-2 py-0.5
                     ${activePanel === 'instrument' ? 'daw-button-active' : ''}`}
        >
          Inst
        </button>
        <button
          onClick={() => onTogglePanel('effects')}
          className={`daw-button text-xxs px-2 py-0.5
                     ${activePanel === 'effects' ? 'daw-button-active' : ''}`}
        >
          FX
        </button>
        <button
          onClick={onPianoRoll}
          className={`daw-button text-xxs px-2 py-0.5
                     ${activePanel === 'piano-roll' ? 'daw-button-active' : ''}`}
          title="Piano Roll"
        >
          Roll
        </button>

        <div className="daw-divider mx-0.5" />

        <button
          onClick={onExport}
          className="daw-button text-xxs px-2 py-0.5"
          title="Export / Bounce"
        >
          Export
        </button>
        <button
          onClick={onHistory}
          className="daw-button text-xxs px-2 py-0.5"
          title="History"
        >
          Hist
        </button>
        <button
          onClick={onToggleAI}
          className={`daw-button text-xxs px-2 py-0.5
                     ${showAI
              ? 'bg-daw-ai-suggestion text-white border-daw-ai-suggestion'
              : ''}`}
        >
          AI
        </button>
      </div>
    </div>
  );
}
