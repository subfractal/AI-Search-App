import { useState, useCallback, type ReactNode } from 'react';
import { loadAudioFile } from '@/services/audio-engine';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useAIStore } from '@/stores/ai-store';
import { generateId } from '@/utils/id';
import { classifyTrackAsync } from '@/services/ai/track-classifier';
import { autoAnalyzeClip } from '@/services/ai/auto-analyze';
import { importProgress } from '@/stores/import-progress-store';
import { toast } from '@/stores/toast-store';
import type { AudioClip } from '@/types/audio';

const ACCEPTED_TYPES = [
  'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/mpeg',
  'audio/flac', 'audio/ogg', 'audio/webm',
];

const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.flac', '.ogg', '.webm'];

function isAudioFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return ACCEPTED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  );
}

interface FileDropZoneProps {
  children: ReactNode;
}

export default function FileDropZone({ children }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const addAudioTrack = useSessionStore((s) => s.addAudioTrack);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const initStrip = useMixerStore((s) => s.initStrip);

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        if (!isAudioFile(file)) continue;

        let trackId: string | null = null;
        const name = file.name.replace(/\.[^.]+$/, '');

        try {
          // Show progress via the Zustand import-progress store.
          importProgress.start(name);

          // PHASE 1: Decode audio (with fake progress)
          let fakeProgress = 0;
          let buffer: AudioBuffer | null = null;
          let decodeComplete = false;

          // Simulate progress while decoding (decodeAudioData doesn't expose native progress)
          const progressInterval = setInterval(() => {
            if (!decodeComplete) {
              fakeProgress = Math.min(fakeProgress + Math.random() * 15, 90);
              importProgress.update('decoding', Math.round(fakeProgress));
            }
          }, 200);

          try {
            buffer = await loadAudioFile(file);
            decodeComplete = true;
            clearInterval(progressInterval);
            importProgress.update('decoding', 100);
          } catch (decodeErr) {
            clearInterval(progressInterval);
            decodeComplete = true;
            // GRACEFUL FALLBACK: Import without waveform on decode failure
            console.error(`[DAW] Audio decode failed for "${file.name}":`, decodeErr);

            // Create a silent buffer as placeholder (waveform will render as empty)
            const ctx = (window.AudioContext || (window as any).webkitAudioContext);
            if (!ctx) {
              toast.error(`Failed to decode "${file.name}" — audio context unavailable`);
              importProgress.done();
              continue;
            }

            // Create a 1-second silent buffer to allow clip to be imported
            const audioCtx = new ctx();
            buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
            console.warn(`[DAW] Importing "${file.name}" without audio (decode failed) — clip created as silent placeholder`);
            toast.error(`Could not decode "${file.name}" — imported as silent clip`);
          }

          // Safety check: buffer must be valid
          if (!buffer || buffer.length === 0) {
            console.warn(`[DAW] Skipping "${file.name}" — invalid or empty buffer`);
            importProgress.done();
            continue;
          }

          // PHASE 2: Create track and clip (fast, UI immediately visible)
          try {
            trackId = addAudioTrack(name);
            initStrip(trackId);

            const clip: AudioClip = {
              id: generateId('clip'),
              trackId,
              name,
              buffer,
              startTime: 0,
              duration: buffer.duration,
              offset: 0,
            };

            addClipToTrack(trackId, clip);
            toast.success(`Imported "${name}"`);
            importProgress.update('decoding', 100);
          } catch (clipErr) {
            console.error(`[DAW] Failed to create clip for "${file.name}":`, clipErr);
            toast.error(`Failed to create clip for "${file.name}"`);
            importProgress.done();
            continue;
          }

          // Yield to let the UI render the new track + waveform and let the
          // deferred Tone.js player creation run (setTimeout(0) in addClipToTrack)
          await new Promise<void>((r) => setTimeout(r, 100));
          importProgress.update('classifying', 30);

          // PHASE 3: Auto gain staging on import (fast — strided peak scan, main thread OK)
          try {
            if (useAIStore.getState().autoGainStagingOnImport) {
              const data = buffer.getChannelData(0);
              let peak = 0;
              const stride = Math.max(1, Math.floor(data.length / 10000));
              for (let i = 0; i < data.length; i += stride) {
                const abs = Math.abs(data[i]!);
                if (abs > peak) peak = abs;
              }
              const peakDb = 20 * Math.log10(Math.max(peak, 1e-10));
              const targetPeakDb = -6;
              const adjustment = targetPeakDb - peakDb;
              if (Math.abs(adjustment) > 1) {
                const session = useSessionStore.getState();
                const track = session.tracks.find((t) => t.id === trackId);
                if (track) {
                  const newVol = Math.round((track.volume + adjustment) * 10) / 10;
                  useMixerStore.getState().setVolume(trackId, newVol);
                  session.updateTrack(trackId, { volume: newVol });
                }
              }
            }
          } catch (err) {
            console.warn(`[DAW] Auto gain staging failed for "${name}":`, err);
            // Continue — gain staging is optional
          }

          // PHASE 4: Classification + analysis on the main thread (async-yielding)
          (async () => {
            try {
              // Classify track type
              const classification = await classifyTrackAsync(trackId!, buffer, file.name);

              if (classification.confidence > 0.4
                  && useAIStore.getState().autoOrganizeEnabled) {
                const session = useSessionStore.getState();
                session.updateTrack(trackId!, {
                  name: classification.suggestedName,
                  color: classification.suggestedColor,
                  role: classification.suggestedRole as string,
                });
                useAIStore.getState().logActivity({
                  id: `log-${Date.now()}`,
                  description: `Auto-classified "${name}" as ${classification.suggestedRole} (${Math.round(classification.confidence * 100)}%)`,
                  trackId: trackId!,
                  timestamp: Date.now(),
                  undoable: false,
                });
              }

              // BPM + Key analysis
              const analysisResult = await autoAnalyzeClip(buffer);
              const parts: string[] = [];
              if (analysisResult.bpm) parts.push(`BPM: ${Math.round(analysisResult.bpm.bpm)}`);
              if (analysisResult.key) parts.push(`Key: ${analysisResult.key.key}`);
              if (parts.length > 0) {
                useAIStore.getState().logActivity({
                  id: `log-${Date.now()}`,
                  description: `Auto-analyzed "${name}" — ${parts.join(', ')}`,
                  trackId: trackId!,
                  timestamp: Date.now(),
                  undoable: false,
                });
              }

              importProgress.done();
            } catch (err: unknown) {
              console.warn(`[DAW] Analysis failed for "${name}":`, err);
              importProgress.done();
            }
          })();
        } catch (err) {
          console.error(`[DAW] Fatal error importing "${file.name}":`, err);
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(`Failed to import: ${msg}`);
          importProgress.done();
        }
      }
    },
    [addAudioTrack, addClipToTrack, initStrip],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDragging(false);
    }
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="relative"
    >
      {children}
      {dragging && (
        <div className="absolute inset-0 bg-daw-accent/10 border-2
                        border-dashed border-daw-accent/40 z-50
                        flex items-center justify-center backdrop-blur-sm">
          <div className="bg-daw-surface/90 px-6 py-4
                          border border-daw-accent/30 shadow-xl">
            <span className="text-daw-accent text-sm font-medium">
              Drop audio files to import
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
