import { useState, useCallback, type ReactNode } from 'react';
import { loadAudioFile } from '@/services/audio-engine';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useAIStore } from '@/stores/ai-store';
import { generateId } from '@/utils/id';
import { autoAnalyzeClip } from '@/services/ai/auto-analyze';
import { classifyTrack } from '@/services/ai/track-classifier';
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

        try {
          const buffer = await loadAudioFile(file);
          if (!buffer || buffer.length === 0) {
            console.warn(`[DAW] Skipping "${file.name}" — empty buffer`);
            continue;
          }
          const name = file.name.replace(/\.[^.]+$/, '');
          const trackId = addAudioTrack(name);
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

          // Auto-classify and organize imported file
          if (useAIStore.getState().autoOrganizeEnabled) {
            try {
              const classification = classifyTrack(trackId, buffer, file.name);
              if (classification.confidence > 0.4) {
                const session = useSessionStore.getState();
                session.updateTrack(trackId, {
                  name: classification.suggestedName,
                  color: classification.suggestedColor,
                  role: classification.suggestedRole,
                });
                useAIStore.getState().logActivity({
                  id: `log-${Date.now()}`,
                  description: `Auto-classified "${name}" as ${classification.suggestedRole} (${Math.round(classification.confidence * 100)}%)`,
                  trackId,
                  timestamp: Date.now(),
                  undoable: false,
                });
              }
            } catch { /* classification failed silently */ }
          }

          // Auto gain staging on import
          if (useAIStore.getState().autoGainStagingOnImport) {
            try {
              const data = buffer.getChannelData(0);
              let peak = 0;
              for (let i = 0; i < data.length; i++) {
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
            } catch { /* gain staging failed silently */ }
          }

          // Auto-analyze BPM and key in background
          autoAnalyzeClip(buffer).then((analysis) => {
            const parts: string[] = [];
            if (analysis.bpm) parts.push(`BPM: ${Math.round(analysis.bpm.bpm)}`);
            if (analysis.key) parts.push(`Key: ${analysis.key.key}`);
            if (parts.length > 0) {
              useAIStore.getState().logActivity({
                id: `log-${Date.now()}`,
                description: `Auto-analyzed "${name}" — ${parts.join(', ')}`,
                trackId,
                timestamp: Date.now(),
                undoable: false,
              });
            }
          }).catch(() => { /* analysis failed silently */ });
        } catch (err) {
          console.error(`[DAW] Failed to load "${file.name}":`, err);
          toast.error(`Failed to load "${file.name}"`);
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
