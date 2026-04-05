/**
 * Spectral Visualizer — 2D canvas-based spectrogram/waterfall display.
 * Multi-track color coding with masking zone highlights.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useAIStore } from '@/stores/ai-store';
import { computeSpectrogram, formatFrequency, binToFrequency } from '@/services/ai/spectral-data';
import { isAudioClip } from '@/types/audio';
import type { SpectrogramData } from '@/services/ai/spectral-data';

function magnitudeToColor(value: number, min: number, max: number): string {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Cool blue -> warm orange/white (matching daw-accent theme)
  const r = Math.round(normalized * 247);
  const g = Math.round(normalized * 127 * normalized);
  const b = Math.round((1 - normalized) * 200 + normalized * 50);
  return `rgb(${r},${g},${b})`;
}

interface HoverInfo {
  x: number;
  y: number;
  frequency: string;
  magnitude: string;
  time: string;
}

export default function SpectralVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const maskingPairs = useAIStore((s) => s.lastAnalysis?.maskingPairs ?? []);
  const [specData, setSpecData] = useState<SpectrogramData | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Compute spectrogram for selected track
  useEffect(() => {
    if (!selectedTrackId) {
      setSpecData(null);
      return;
    }
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    const audioClip = track.clips.find(isAudioClip);
    if (!audioClip) {
      setSpecData(null);
      return;
    }

    try {
      const data = computeSpectrogram(audioClip.buffer, 1024, 512);
      setSpecData(data);
    } catch {
      setSpecData(null);
    }
  }, [selectedTrackId, tracks]);

  // Render spectrogram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !specData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const frames = specData.data;
    const bins = specData.frequencyBins;
    if (frames.length === 0) return;

    const pixelWidth = Math.max(1, width / frames.length);
    const pixelHeight = height / bins;

    for (let x = 0; x < frames.length; x++) {
      const frame = frames[x]!;
      for (let y = 0; y < bins; y++) {
        const mag = frame[y]!;
        ctx.fillStyle = magnitudeToColor(mag, specData.minMagnitude, specData.maxMagnitude);
        // Flip Y: low frequencies at bottom
        ctx.fillRect(
          x * pixelWidth,
          height - (y + 1) * pixelHeight,
          Math.ceil(pixelWidth),
          Math.ceil(pixelHeight),
        );
      }
    }

    // Draw masking highlights if any
    if (maskingPairs.length > 0 && selectedTrackId) {
      const relevantPairs = maskingPairs.filter(
        (p) => p.trackAId === selectedTrackId || p.trackBId === selectedTrackId,
      );
      if (relevantPairs.length > 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
        for (const pair of relevantPairs) {
          // Highlight affected frequency bands
          for (const band of pair.maskedBands) {
            let lowBin = 0;
            let highBin = bins;
            if (band.includes('20-250')) { lowBin = 0; highBin = Math.floor(bins * 0.05); }
            else if (band.includes('250-1k')) { lowBin = Math.floor(bins * 0.05); highBin = Math.floor(bins * 0.2); }
            else if (band.includes('1k-4k')) { lowBin = Math.floor(bins * 0.2); highBin = Math.floor(bins * 0.4); }
            else if (band.includes('4k-8k')) { lowBin = Math.floor(bins * 0.4); highBin = Math.floor(bins * 0.6); }
            else if (band.includes('8k-20k')) { lowBin = Math.floor(bins * 0.6); highBin = bins; }

            ctx.fillRect(
              0,
              height - highBin * pixelHeight,
              width,
              (highBin - lowBin) * pixelHeight,
            );
          }
        }
      }
    }
  }, [specData, maskingPairs, selectedTrackId]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !specData) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const frameIdx = Math.floor((x / canvas.width) * specData.data.length);
      const binIdx = Math.floor(((canvas.height - y) / canvas.height) * specData.frequencyBins);

      const frame = specData.data[frameIdx];
      if (!frame) return;

      const freq = binToFrequency(binIdx, specData.sampleRate, specData.frequencyBins * 2);
      const mag = frame[binIdx] ?? -100;

      setHover({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        frequency: formatFrequency(freq),
        magnitude: `${mag.toFixed(1)} dB`,
        time: `${(frameIdx * specData.timeStep).toFixed(2)}s`,
      });
    },
    [specData],
  );

  const trackName = tracks.find((t) => t.id === selectedTrackId)?.name ?? 'No track';

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-daw-text">Spectral View</h3>
        <span className="text-xxs font-mono text-daw-text-muted">{trackName}</span>
      </div>

      <div className="relative bg-daw-bg border border-white/10">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-48"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        />

        {/* Hover tooltip */}
        {hover && (
          <div
            className="absolute pointer-events-none px-2 py-1
                       bg-daw-surface/90 border border-white/10
                       text-xxs font-mono text-daw-text"
            style={{ left: hover.x + 10, top: hover.y - 30 }}
          >
            {hover.frequency} | {hover.magnitude} | {hover.time}
          </div>
        )}
      </div>

      {!specData && (
        <p className="text-xxs font-mono text-daw-text-muted text-center">
          Select a track with audio to view spectrogram
        </p>
      )}
    </div>
  );
}
