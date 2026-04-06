import { useEffect, useRef, useState } from 'react';
import { useTransportStore } from '@/stores/transport-store';
import { useSessionStore } from '@/stores/session-store';
import { useHistoryStore } from '@/stores/history-store';
import { getPositionSeconds } from '@/services/transport-service';
import { formatBarsBeats } from '@/utils/format-time';

import type { BottomPanel } from '@/App';

// Global ref to store timeline container for scroll synchronization
export const timelineContainerRef = { current: null as HTMLDivElement | null };

interface TransportBarProps {
  activePanel: BottomPanel;
  onTogglePanel: (panel: BottomPanel) => void;
  showAI: boolean;
  onToggleAI: () => void;
  showTracks?: boolean;
  onToggleTracks?: () => void;
  onExport?: () => void;
  onHistory?: () => void;
  onPianoRoll?: () => void;
}

/* ── SVG Icons ── */

function IconRewind() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M7 3v8L1 7l6-4z" />
      <path d="M13 3v8L7 7l6-4z" />
    </svg>
  );
}

function IconForward() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M1 3v8l6-4-6-4z" />
      <path d="M7 3v8l6-4-6-4z" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="2" y="2" width="8" height="8" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1v12l10-6L3 1z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="3" height="10" />
      <rect x="8" y="1" width="3" height="10" />
    </svg>
  );
}

function IconRecord() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="7" cy="7" r="5" />
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

function IconMetronome() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M3 13L5 1h2l2 12H3z" />
      <line x1="6" y1="4" x2="9" y2="2" />
    </svg>
  );
}

/* ── Master Meter (simple canvas-based) ── */
function MasterMeter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDrawRef = useRef(0);
  const transportState = useTransportStore((s) => s.state);

  useEffect(() => {
    let raf: number;
    const isActive = transportState === 'playing' || transportState === 'recording';

    const draw = (now: number) => {
      // Throttle to ~15fps (66ms) — meters don't need 60fps
      if (now - lastDrawRef.current < 66) {
        if (isActive) raf = requestAnimationFrame(draw);
        return;
      }
      lastDrawRef.current = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Simulated meter levels (would connect to real audio analysis)
      const levelL = isActive ? 0.3 + Math.random() * 0.15 : 0;
      const levelR = isActive ? 0.3 + Math.random() * 0.12 : 0;
      const barH = (h - 2) / 2;

      // Left channel
      const lW = levelL * w;
      ctx.fillStyle = lW > w * 0.85 ? '#E63946' : lW > w * 0.7 ? '#F77F00' : '#D1D1D1';
      ctx.fillRect(0, 0, lW, barH);
      ctx.fillStyle = '#222224';
      ctx.fillRect(lW, 0, w - lW, barH);

      // Right channel
      const rW = levelR * w;
      ctx.fillStyle = rW > w * 0.85 ? '#E63946' : rW > w * 0.7 ? '#F77F00' : '#D1D1D1';
      ctx.fillRect(0, barH + 2, rW, barH);
      ctx.fillStyle = '#222224';
      ctx.fillRect(rW, barH + 2, w - rW, barH);

      if (isActive) raf = requestAnimationFrame(draw);
    };

    // Draw once immediately (shows cleared state when stopped)
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [transportState]);

  return <canvas ref={canvasRef} width={80} height={14} className="shrink-0" />;
}

export default function TransportBar({
  activePanel,
  onTogglePanel,
  showAI,
  onToggleAI,
  showTracks,
  onToggleTracks,
  onExport,
  onHistory,
  onPianoRoll,
}: TransportBarProps) {
  const {
    state, bpm, loopEnabled, metronomeEnabled, punchInEnabled,
    play, pause, stop, toggleRecord, setBpm, toggleLoop, toggleMetronome, togglePunchIn,
  } = useTransportStore();

  const timeSignature = useSessionStore((s) => s.config.timeSignature);
  const setConfig = useSessionStore((s) => s.setConfig);

  const TIME_SIGS: [number, number][] = [[4, 4], [3, 4], [6, 8], [5, 4], [7, 8]];
  const cycleTimeSig = () => {
    const currentIdx = TIME_SIGS.findIndex(
      ([n, d]) => n === timeSignature.numerator && d === timeSignature.denominator,
    );
    const next = TIME_SIGS[(currentIdx + 1) % TIME_SIGS.length]!;
    setConfig({ timeSignature: { numerator: next[0], denominator: next[1] } });
  };

  const undoCount = useHistoryStore((s) => s.undoCount);
  const redoCount = useHistoryStore((s) => s.redoCount);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  const beatsPerBar = timeSignature.numerator;

  // Use refs for position display to avoid 60fps store re-renders
  const positionRef = useRef(0);
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const barsRef = useRef<HTMLSpanElement>(null);
  const [bpmInput, setBpmInput] = useState(String(bpm));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      const pos = getPositionSeconds();
      positionRef.current = pos;

      // Direct DOM updates — bypasses React render cycle entirely
      if (timecodeRef.current) {
        const ms = Math.floor(pos * 1000);
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const f = Math.floor((ms % 1000) / (1000 / 30));
        timecodeRef.current.textContent =
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
      }
      if (barsRef.current) {
        barsRef.current.textContent = `${formatBarsBeats(pos, bpm, beatsPerBar)}:000`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [bpm, beatsPerBar]);

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

  const PanelBtn = ({ panel, label }: { panel: BottomPanel; label: string }) => (
    <button
      onClick={() => panel ? onTogglePanel(panel) : undefined}
      className={`text-[10px] font-medium px-2 py-0.5 transition-all duration-75
                 ${activePanel === panel
      ? 'bg-daw-accent/15 text-daw-accent border border-daw-accent/30'
      : 'text-daw-text-muted hover:text-daw-text-dim bg-daw-panel/50 border border-transparent hover:border-daw-border/30'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-daw-transport-bg select-none shrink-0"
      style={{ borderBottom: '2px solid #1a1a1c' }}>
      {/* Row 1: Branding + Transport + LCD + Meter */}
      <div className="flex items-center h-16 px-3 gap-3">

        {/* ── DKT Branding + Logo ── */}
        <div className="shrink-0 flex items-center gap-2.5 mr-2">
          {/* Logo mark — DKT block icon */}
          <div className="w-10 h-10 shrink-0 flex items-center justify-center daw-bezel bg-daw-bg">
            <svg width="24" height="24" viewBox="0 0 32 32">
              <rect x="4" y="4" width="10" height="24" fill="#E63946" />
              <rect x="18" y="4" width="10" height="10" fill="#E63946" />
              <rect x="18" y="18" width="10" height="10" fill="#F77F00" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[8px] font-mono uppercase tracking-[4px] text-[#E63946]/90">
              WORKSTATION PRO
            </span>
            <span className="text-[16px] font-bold tracking-tight text-daw-text leading-none mt-0.5">
              de-konstrukt
            </span>
          </div>
        </div>

        {/* ── Transport Buttons ── */}
        <div className="flex items-center gap-0.5 daw-inset p-1 shrink-0">
          {/* Rewind */}
          <button
            onClick={stop}
            className="daw-hw-btn w-9 h-9 flex items-center justify-center
                       text-daw-text-muted/60 hover:text-daw-text-dim"
            title="Rewind"
            aria-label="Rewind to start"
          >
            <IconRewind />
          </button>
          {/* Forward */}
          <button
            onClick={() => {
              const currentPos = getPositionSeconds();
              const barDurationSecs = (60 / bpm) * beatsPerBar;
              seekTo(Math.max(0, currentPos + barDurationSecs));
            }}
            className="daw-hw-btn w-9 h-9 flex items-center justify-center
                       text-daw-text-muted/60 hover:text-daw-text-dim"
            title="Forward (>> advance by one bar)"
          >
            <IconForward />
          </button>
          {/* Play */}
          <button
            onClick={isPlaying ? pause : play}
            className={`daw-hw-btn w-10 h-9 flex items-center justify-center
                       ${isPlaying
      ? 'text-daw-transport-play !bg-daw-transport-play/15 !border-daw-transport-play/30'
      : 'text-daw-text-muted/60 hover:text-daw-text'}`}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>
          {/* Stop */}
          <button
            onClick={stop}
            className={`daw-hw-btn w-9 h-9 flex items-center justify-center
                       ${state === 'stopped'
      ? 'text-daw-text !bg-daw-surface'
      : 'text-daw-text-muted/60 hover:text-daw-text-dim'}`}
            title="Stop"
          >
            <IconStop />
          </button>
          {/* Pause */}
          <button
            onClick={pause}
            className={`daw-hw-btn w-9 h-9 flex items-center justify-center
                       ${state === 'paused'
      ? 'text-daw-text !bg-daw-surface'
      : 'text-daw-text-muted/60 hover:text-daw-text-dim'}`}
            title="Pause"
          >
            <IconPause />
          </button>
          {/* Record */}
          <button
            onClick={toggleRecord}
            className={`daw-hw-btn w-10 h-9 flex items-center justify-center
                       ${isRecording
      ? 'text-daw-transport-record !bg-daw-transport-record/20 !border-daw-transport-record/40 animate-blink-signal'
      : 'text-daw-text-muted/40 hover:text-daw-transport-record/70'}`}
            title="Record"
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            aria-pressed={isRecording}
          >
            <IconRecord />
          </button>
        </div>

        {/* ── Large LCD Timecode Display ── */}
        <div className="daw-lcd px-4 py-2 flex flex-col items-start min-w-[230px] shrink-0">
          <span
            ref={timecodeRef}
            className="text-[26px] font-mono leading-none text-daw-lcd-text tracking-wider font-medium"
            style={{ textShadow: '0 0 12px rgba(230,57,70,0.3)' }}
          >
            00:00:00:00
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span ref={barsRef} className="text-[9px] font-mono text-daw-lcd-dim">
              1.1.000:000
            </span>
            <span className="text-[9px] font-mono text-daw-lcd-text/80">
              {bpm}.00 BPM
            </span>
            <span className="text-[9px] font-mono text-daw-lcd-dim">
              {timeSignature.numerator}/{timeSignature.denominator}
            </span>
          </div>
        </div>

        {/* ── BPM Input ── */}
        <div className="daw-lcd px-3 py-1.5 flex flex-col items-center min-w-[64px] shrink-0">
          <span className="text-[7px] text-daw-lcd-dim uppercase tracking-widest leading-none mb-0.5">
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
            className="w-14 text-center text-base font-mono bg-transparent
                       border-none text-daw-lcd-text focus:outline-none
                       leading-none tabular-nums font-medium"
            style={{ textShadow: '0 0 8px rgba(230,57,70,0.25)' }}
            min={20}
            max={999}
          />
        </div>

        {/* ── Loop / Metronome / Time Sig ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={toggleLoop}
            className={`daw-hw-btn w-9 h-9 flex items-center justify-center
                       ${loopEnabled
      ? 'text-daw-accent !bg-daw-accent/15 !border-daw-accent/30'
      : 'text-daw-text-muted/40 hover:text-daw-text-dim'}`}
            title="Toggle Loop"
            aria-label="Toggle loop"
            aria-pressed={loopEnabled}
          >
            <IconLoop />
          </button>
          <button
            onClick={toggleMetronome}
            className={`daw-hw-btn w-9 h-9 flex items-center justify-center
                       ${metronomeEnabled
      ? 'text-daw-accent !bg-daw-accent/15 !border-daw-accent/30'
      : 'text-daw-text-muted/40 hover:text-daw-text-dim'}`}
            title="Toggle Metronome"
            aria-label="Toggle metronome"
            aria-pressed={metronomeEnabled}
          >
            <IconMetronome />
          </button>
          <button
            onClick={togglePunchIn}
            className={`daw-hw-btn w-9 h-9 flex items-center justify-center text-[8px] font-bold font-mono
                       ${punchInEnabled
      ? 'text-[#E63946] !bg-[#E63946]/15 !border-[#E63946]/30'
      : 'text-daw-text-muted/40 hover:text-daw-text-dim'}`}
            title="Toggle Punch In/Out"
            aria-label="Toggle punch in/out recording"
            aria-pressed={punchInEnabled}
          >
            P/I
          </button>
          <button
            onClick={cycleTimeSig}
            className="daw-hw-btn h-9 px-2.5 flex items-center justify-center
                       text-[10px] font-mono text-daw-text-muted/50 hover:text-daw-text-dim"
            title="Cycle Time Signature"
            aria-label={`Time signature ${timeSignature.numerator}/${timeSignature.denominator}`}
          >
            {timeSignature.numerator}/{timeSignature.denominator}
          </button>
        </div>

        {/* ── Undo / Redo ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={undo}
            disabled={undoCount === 0}
            className="w-7 h-8 flex items-center justify-center
                       text-daw-text-muted/50 hover:text-daw-text-dim transition-all
                       disabled:opacity-15"
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
            className="w-7 h-8 flex items-center justify-center
                       text-daw-text-muted/50 hover:text-daw-text-dim transition-all
                       disabled:opacity-15"
            title="Redo"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 4l2 2-2 2" />
              <path d="M11 6H4a3 3 0 000 6h2" />
            </svg>
          </button>
        </div>

        <div className="flex-1" />

        {/* ── Master Meter ── */}
        <div className="flex items-center gap-2 shrink-0 daw-inset px-1.5 py-1">
          <span className="text-[7px] font-mono text-daw-text-muted/40 uppercase tracking-wider">OUT</span>
          <MasterMeter />
        </div>
      </div>

      {/* Row 2: Panel toggles */}
      <div className="flex items-center h-7 px-3 gap-1 overflow-x-auto scrollbar-none"
        style={{ borderTop: '1px solid #1a1a1c', background: '#080808' }}>
        <button
          onClick={onToggleTracks}
          className={`text-[10px] font-medium px-2 py-0.5 transition-all duration-75 shrink-0
                     ${showTracks
      ? 'bg-daw-accent/15 text-daw-accent border border-daw-accent/30'
      : 'text-daw-text-muted hover:text-daw-text-dim bg-daw-panel/50 border border-transparent hover:border-daw-border/30'}`}
        >
          Trk
        </button>
        <PanelBtn panel="mixer" label="Mix" />
        <PanelBtn panel="instrument" label="Inst" />
        <PanelBtn panel="effects" label="FX" />
        <PanelBtn panel="clip-view" label="Clip" />
        <PanelBtn panel="automation" label="Auto" />
        <PanelBtn panel="routing" label="Rte" />
        <PanelBtn panel="warp" label="Wrp" />
        <PanelBtn panel="browser" label="Lib" />
        <button
          onClick={onPianoRoll}
          className={`text-[10px] font-medium px-2 py-0.5 transition-all duration-75 shrink-0
                     ${activePanel === 'piano-roll'
      ? 'bg-daw-accent/15 text-daw-accent border border-daw-accent/30'
      : 'text-daw-text-muted hover:text-daw-text-dim bg-daw-panel/50 border border-transparent hover:border-daw-border/30'}`}
        >
          Roll
        </button>

        <div className="daw-divider mx-0.5 shrink-0" />

        <button
          onClick={onExport}
          className="text-[10px] font-medium px-2 py-0.5 text-daw-text-muted
                     hover:text-daw-text-dim bg-daw-panel/50 border border-transparent
                     hover:border-daw-border/30 transition-all duration-75 shrink-0"
        >
          Exp
        </button>
        <button
          onClick={onHistory}
          className="text-[10px] font-medium px-2 py-0.5 text-daw-text-muted
                     hover:text-daw-text-dim bg-daw-panel/50 border border-transparent
                     hover:border-daw-border/30 transition-all duration-75 shrink-0"
        >
          Hist
        </button>

        <div className="flex-1" />

        {/* de-konstrukt sparkle logo */}
        <span className="text-[10px] text-daw-text-muted/30 font-mono mr-1 shrink-0">dkst</span>

        <button
          onClick={onToggleAI}
          className={`text-[10px] font-medium px-2.5 py-0.5 transition-all duration-75 shrink-0
                     ${showAI
      ? 'bg-daw-ai-accent/15 text-daw-ai-accent border border-daw-ai-accent/30'
      : 'text-daw-text-muted hover:text-daw-ai-accent/60 bg-daw-panel/50 border border-transparent'}`}
        >
          AI
        </button>
      </div>
    </div>
  );
}
