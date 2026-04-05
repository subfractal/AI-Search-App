import { useRef, useState, useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { loadAudioFile, initAudioContext } from '@/services/audio-engine';
import { generateId } from '@/utils/id';
import type { AudioClip } from '@/types/audio';
import TrackHeader from './TrackHeader';

export default function TrackList() {
  const tracks = useSessionStore((s) => s.tracks);
  const addAudioTrack = useSessionStore((s) => s.addAudioTrack);
  const addMidiTrack = useSessionStore((s) => s.addMidiTrack);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const initStrip = useMixerStore((s) => s.initStrip);
  const addFolderTrack = useSessionStore((s) => s.addFolderTrack);
  const reorderTracks = useSessionStore((s) => s.reorderTracks);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      reorderTracks(fromIndex, toIndex);
    }
    setDragOverIndex(null);
  }, [reorderTracks]);

  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleAddAudioClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Capture files immediately — some browsers clear the FileList on input reset
    const fileList = Array.from(files);

    // Reset input immediately so it can be re-triggered even if loading is slow
    e.target.value = '';

    for (const file of fileList) {
      try {
        const buffer = await loadAudioFile(file);
        if (!buffer || buffer.length === 0) {
          console.warn(`[DAW] Skipping "${file.name}" — decoded buffer is empty`);
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
      } catch (err) {
        console.error(`[DAW] Failed to load "${file.name}":`, err);
      }
    }
  };

  const handleAddMidi = () => {
    initAudioContext();
    const id = addMidiTrack();
    initStrip(id);
  };

  const handleAddFolder = () => {
    addFolderTrack();
  };

  return (
    <div className="h-full w-full bg-daw-surface flex flex-col overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.flac,.ogg,.webm,audio/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 h-7 border-b
                      border-daw-border/20 shrink-0">
        <span className="daw-section-label flex-1">Tracks</span>
        <button
          onClick={handleAddAudioClick}
          className="text-xxs text-daw-text-muted hover:text-daw-accent
                     transition-colors px-1"
          title="Import audio file"
        >
          +Aud
        </button>
        <span className="text-daw-border">|</span>
        <button
          onClick={handleAddMidi}
          className="text-xxs text-daw-text-muted hover:text-daw-midi
                     transition-colors px-1"
          title="Add MIDI track"
        >
          +Mid
        </button>
        <span className="text-daw-border">|</span>
        <button
          onClick={handleAddFolder}
          className="text-xxs text-daw-text-muted hover:text-daw-text-dim
                     transition-colors px-1"
          title="Add folder track"
        >
          +Fld
        </button>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`${dragOverIndex === index ? 'border-t-2 border-daw-accent' : ''}`}
          >
            <TrackHeader trackId={track.id} />
          </div>
        ))}
        {tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full
                          text-daw-text-muted text-xxs px-6 text-center gap-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"
              stroke="currentColor" strokeWidth="1" className="opacity-30">
              <rect x="4" y="6" width="24" height="4" rx="1" />
              <rect x="4" y="14" width="24" height="4" rx="1" />
              <rect x="4" y="22" width="24" height="4" rx="1" />
            </svg>
            <span>No tracks yet</span>
            <button
              onClick={handleAddAudioClick}
              className="text-daw-accent hover:text-daw-accent-dim
                         transition-colors underline underline-offset-2"
            >
              Import audio file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
