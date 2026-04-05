import { useState, useMemo, useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import {
  bounceSession,
  audioBufferToWav,
  downloadBlob,
  exportStem,
} from '@/services/export-service';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ExportType = 'full' | 'stems' | 'selected';

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const bpm = useTransportStore((s) => s.bpm);

  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [exportType, setExportType] = useState<ExportType>('full');
  const [filename, setFilename] = useState('');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  // Auto-detect duration from last clip end
  const autoDuration = useMemo(() => {
    let maxEnd = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) maxEnd = end;
      }
    }
    return Math.max(1, maxEnd);
  }, [tracks]);

  const [duration, setDuration] = useState<string>('');
  const effectiveDuration = duration ? parseFloat(duration) : autoDuration;

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedTrackId),
    [tracks, selectedTrackId],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      if (exportType === 'full') {
        setProgress('Bouncing full mix...');
        const buffer = await bounceSession(tracks, effectiveDuration, sampleRate);
        setProgress('Encoding WAV...');
        const wav = audioBufferToWav(buffer);
        const name = filename || `mix-export-${Date.now()}.wav`;
        downloadBlob(wav, name);
      } else if (exportType === 'stems') {
        for (let i = 0; i < tracks.length; i++) {
          const track = tracks[i]!;
          setProgress(`Exporting stem ${i + 1}/${tracks.length}: ${track.name}`);
          await exportStem(track, effectiveDuration);
        }
      } else if (exportType === 'selected' && selectedTrack) {
        setProgress(`Exporting: ${selectedTrack.name}`);
        const name = filename || `${selectedTrack.name}-${Date.now()}.wav`;
        await exportStem(selectedTrack, effectiveDuration, name);
      }
      setProgress('Done!');
      setTimeout(() => {
        setExporting(false);
        setProgress('');
        onClose();
      }, 800);
    } catch (err) {
      setProgress(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      setExporting(false);
    }
  }, [
    exportType, tracks, effectiveDuration, sampleRate,
    filename, selectedTrack, onClose,
  ]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-[90vw] max-w-[380px] rounded-lg
                      bg-daw-surface border border-daw-border
                      shadow-xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3
                        border-b border-daw-border/40">
          <h2 className="text-sm font-semibold text-daw-text">
            Export / Bounce
          </h2>
          <button
            onClick={onClose}
            className="text-daw-text-muted hover:text-daw-text
                       transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-4">
          {/* Format */}
          <Field label="Format">
            <div className="text-xs text-daw-text-dim bg-daw-bg/50
                            rounded px-2 py-1.5 border border-daw-border/30">
              WAV (16-bit PCM)
            </div>
          </Field>

          {/* Sample rate */}
          <Field label="Sample Rate">
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(Number(e.target.value))}
              className="w-full text-xs text-daw-text bg-daw-bg/50
                         rounded px-2 py-1.5 border border-daw-border/30
                         focus:outline-none focus:border-daw-accent/50"
            >
              <option value={44100}>44,100 Hz</option>
              <option value={48000}>48,000 Hz</option>
            </select>
          </Field>

          {/* Export type */}
          <Field label="Export Type">
            <div className="flex gap-1">
              {([
                ['full', 'Full Mix'],
                ['stems', 'Individual Stems'],
                ['selected', 'Selected Track'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setExportType(val)}
                  disabled={val === 'selected' && !selectedTrack}
                  className={`flex-1 text-xxs py-1.5 rounded font-medium
                             transition-all border
                             ${exportType === val
                      ? 'bg-daw-accent/20 text-daw-accent border-daw-accent/40'
                      : 'bg-daw-bg/40 text-daw-text-muted border-daw-border/30 hover:text-daw-text-dim'}
                             disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* Duration */}
          <Field label="Duration (seconds)">
            <input
              type="number"
              min={0.1}
              step={0.1}
              placeholder={autoDuration.toFixed(1)}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full text-xs text-daw-text bg-daw-bg/50
                         rounded px-2 py-1.5 border border-daw-border/30
                         placeholder:text-daw-text-muted/50
                         focus:outline-none focus:border-daw-accent/50"
            />
            <span className="text-xxs text-daw-text-muted mt-0.5 block">
              Auto-detected: {autoDuration.toFixed(1)}s
              {bpm > 0 && ` \u00b7 ${bpm} BPM`}
            </span>
          </Field>

          {/* Filename */}
          <Field label="Filename">
            <input
              type="text"
              placeholder={`mix-export-${Date.now()}.wav`}
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full text-xs text-daw-text bg-daw-bg/50
                         rounded px-2 py-1.5 border border-daw-border/30
                         placeholder:text-daw-text-muted/50
                         focus:outline-none focus:border-daw-accent/50"
            />
          </Field>

          {/* Progress */}
          {progress && (
            <div className="text-xxs text-daw-accent bg-daw-accent/10
                            rounded px-2 py-1.5 text-center">
              {progress}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3
                        border-t border-daw-border/40">
          <button
            onClick={onClose}
            disabled={exporting}
            className="text-xs px-3 py-1.5 rounded
                       bg-daw-bg/50 text-daw-text-muted
                       border border-daw-border/30
                       hover:text-daw-text-dim transition-colors
                       disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || tracks.length === 0}
            className="text-xs px-4 py-1.5 rounded font-medium
                       bg-daw-accent/80 text-white
                       hover:bg-daw-accent transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xxs text-daw-text-muted mb-1 font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
