import { useState, useCallback, type ReactNode } from 'react';
import { loadAudioFile } from '@/services/audio-engine';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useAIStore } from '@/stores/ai-store';
import { generateId } from '@/utils/id';
import { autoAnalyzeClip } from '@/services/ai/auto-analyze';
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
