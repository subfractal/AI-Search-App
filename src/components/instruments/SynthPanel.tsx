import { useRef, useEffect } from 'react';
import { useInstrumentStore } from '@/stores/instrument-store';
import { triggerNote, getAnalyserNode } from '@/services/instrument-service';
import type { OscillatorType, FilterType } from '@/types/instruments';
import Knob from '@/components/ui/Knob';

interface SynthPanelProps {
  trackId: string;
}

const OSC_TYPES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
const FILTER_TYPES: FilterType[] = ['lowpass', 'highpass', 'bandpass'];

function Oscilloscope({ trackId }: { trackId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 160 * dpr;
    canvas.height = 64 * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const w = 160;
      const h = 64;
      const mid = h / 2;

      // Dark background
      ctx.fillStyle = '#060810';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = '#1a1a28';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(w, mid);
      ctx.moveTo(w / 4, 0);
      ctx.lineTo(w / 4, h);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.moveTo(3 * w / 4, 0);
      ctx.lineTo(3 * w / 4, h);
      ctx.stroke();

      const analyser = getAnalyserNode(trackId);
      if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(dataArray);

        // Check if there's actual signal
        let hasSignal = false;
        for (let i = 0; i < bufferLength; i++) {
          if (Math.abs(dataArray[i] ?? 0) > 0.001) {
            hasSignal = true;
            break;
          }
        }

        if (hasSignal) {
          ctx.strokeStyle = '#3dd68c';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = '#3dd68c';
          ctx.shadowBlur = 4;
          ctx.beginPath();

          const sliceWidth = w / bufferLength;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
            const v = (dataArray[i] ?? 0) * mid * 0.8;
            const y = mid + v;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          // Flat line when idle
          ctx.strokeStyle = '#1e3028';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, mid);
          ctx.lineTo(w, mid);
          ctx.stroke();
        }
      } else {
        // No analyser — flat idle line
        ctx.strokeStyle = '#1e3028';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, mid);
        ctx.lineTo(w, mid);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trackId]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded border border-daw-border/20"
      style={{
        width: 160,
        height: 64,
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)',
      }}
    />
  );
}

export default function SynthPanel({ trackId }: SynthPanelProps) {
  const config = useInstrumentStore((s) => s.instruments[trackId]);
  const updateSynth = useInstrumentStore((s) => s.updateSynth);

  if (!config?.synthParams) return null;
  const params = config.synthParams;

  const playTestNote = () => {
    triggerNote(trackId, 'C4', '8n');
  };

  return (
    <div className="flex flex-wrap gap-3 p-3 items-start">
      {/* Oscillator section */}
      <div className="flex flex-col gap-1.5 min-w-[100px]">
        <div className="flex items-center justify-between">
          <span className="daw-section-label">OSC</span>
          <button
            onClick={playTestNote}
            className="daw-button text-[8px] px-1.5 py-0"
          >
            Test
          </button>
        </div>
        <div className="flex gap-0.5">
          {OSC_TYPES.map((osc) => (
            <button
              key={osc}
              onClick={() => updateSynth(trackId, { oscillator: osc })}
              className={`flex-1 text-[8px] py-1 rounded transition-all
                         ${params.oscillator === osc
                  ? 'bg-daw-accent/20 text-daw-accent border border-daw-accent/30'
                  : 'bg-daw-bg text-daw-text-muted/50 border border-daw-border/20 hover:border-daw-border/40'}`}
            >
              {osc.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>

        {/* Oscilloscope */}
        <Oscilloscope trackId={trackId} />
      </div>

      {/* Filter section */}
      <div className="flex flex-col gap-1.5 min-w-[120px]">
        <span className="daw-section-label">FILTER</span>
        <div className="flex gap-0.5">
          {FILTER_TYPES.map((f) => (
            <button
              key={f}
              onClick={() => updateSynth(trackId, { filterType: f })}
              className={`flex-1 text-[8px] py-1 rounded transition-all
                         ${params.filterType === f
                  ? 'bg-daw-accent/20 text-daw-accent border border-daw-accent/30'
                  : 'bg-daw-bg text-daw-text-muted/50 border border-daw-border/20 hover:border-daw-border/40'}`}
            >
              {f === 'lowpass' ? 'LP' : f === 'highpass' ? 'HP' : 'BP'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-center">
          <Knob
            value={Math.log2(params.filterFrequency / 20) / Math.log2(20000 / 20)}
            min={0}
            max={1}
            onChange={(v) => {
              const freq = 20 * Math.pow(20000 / 20, v);
              updateSynth(trackId, { filterFrequency: Math.round(freq) });
            }}
            label="Freq"
            size={26}
            showValue
          />
          <Knob
            value={params.filterResonance}
            min={0}
            max={20}
            onChange={(v) => updateSynth(trackId, { filterResonance: v })}
            label="Res"
            size={26}
            showValue
          />
        </div>
      </div>

      {/* ADSR Envelope section */}
      <div className="flex flex-col gap-1.5 min-w-[140px]">
        <span className="daw-section-label">ENVELOPE</span>
        <div className="flex gap-1.5 justify-center">
          <Knob
            value={params.attack}
            min={0.001}
            max={2}
            onChange={(v) => updateSynth(trackId, { attack: v })}
            label="A"
            size={24}
            showValue
          />
          <Knob
            value={params.decay}
            min={0.01}
            max={2}
            onChange={(v) => updateSynth(trackId, { decay: v })}
            label="D"
            size={24}
            showValue
          />
          <Knob
            value={params.sustain}
            min={0}
            max={1}
            onChange={(v) => updateSynth(trackId, { sustain: v })}
            label="S"
            size={24}
            showValue
          />
          <Knob
            value={params.release}
            min={0.01}
            max={4}
            onChange={(v) => updateSynth(trackId, { release: v })}
            label="R"
            size={24}
            showValue
          />
        </div>
      </div>

      {/* Mini keyboard */}
      <div className="flex flex-col gap-1 min-w-[140px] flex-1">
        <span className="daw-section-label">KEYBOARD</span>
        <MiniKeyboard trackId={trackId} />
      </div>
    </div>
  );
}

function MiniKeyboard({ trackId }: { trackId: string }) {
  const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const blackKeys = [
    { note: 'C#', offset: 1 },
    { note: 'D#', offset: 2 },
    { note: 'F#', offset: 4 },
    { note: 'G#', offset: 5 },
    { note: 'A#', offset: 6 },
  ];

  const play = (note: string) => {
    triggerNote(trackId, `${note}4`, '8n');
  };

  return (
    <div className="relative h-10">
      <div className="flex gap-px h-full">
        {whiteKeys.map((note) => (
          <button
            key={note}
            onMouseDown={() => play(note)}
            onTouchStart={() => play(note)}
            className="flex-1 rounded-b-sm text-[7px]
                       font-medium flex items-end justify-center
                       pb-0.5 transition-colors touch-none"
            style={{
              background: 'linear-gradient(to bottom, #d0d0d8 0%, #b8b8c0 100%)',
              color: '#1a1a22',
            }}
          >
            {note}
          </button>
        ))}
      </div>
      <div className="absolute top-0 left-0 right-0 h-[60%] flex">
        {blackKeys.map(({ note, offset }) => (
          <button
            key={note}
            onMouseDown={() => play(note)}
            onTouchStart={() => play(note)}
            className="absolute w-[12%] h-full rounded-b-sm
                       border border-daw-border/20
                       hover:bg-daw-surface-alt active:bg-daw-panel
                       transition-colors z-10 touch-none"
            style={{
              left: `${(offset / 7) * 100 + 100 / 14 - 6}%`,
              background: 'linear-gradient(to bottom, #2a2a35 0%, #18181e 100%)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
