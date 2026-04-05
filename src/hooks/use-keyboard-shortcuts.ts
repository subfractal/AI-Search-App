import { useEffect } from 'react';
import { useTransportStore } from '@/stores/transport-store';
import { useHistoryStore } from '@/stores/history-store';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';

export function useKeyboardShortcuts(): void {
  const play = useTransportStore((s) => s.play);
  const pause = useTransportStore((s) => s.pause);
  const stop = useTransportStore((s) => s.stop);
  const state = useTransportStore((s) => s.state);
  const toggleRecord = useTransportStore((s) => s.toggleRecord);
  const toggleLoop = useTransportStore((s) => s.toggleLoop);
  const toggleMetronome = useTransportStore((s) => s.toggleMetronome);
  const setBpm = useTransportStore((s) => s.setBpm);
  const bpm = useTransportStore((s) => s.bpm);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // --- Undo / Redo ---
      if (mod && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // --- Clipboard: Copy / Paste / Cut selected clips ---
      if (mod && e.key === 'c') {
        e.preventDefault();
        useSessionStore.getState().copySelectedClips();
        return;
      }
      if (mod && e.key === 'v') {
        e.preventDefault();
        useSessionStore.getState().pasteClips();
        return;
      }
      if (mod && e.key === 'x') {
        e.preventDefault();
        useSessionStore.getState().copySelectedClips();
        useSessionStore.getState().deleteSelectedClips();
        return;
      }

      // --- Select All clips on selected track ---
      if (mod && e.key === 'a') {
        e.preventDefault();
        const session = useSessionStore.getState();
        const track = session.tracks.find((t) => t.id === session.selectedTrackId);
        if (track) {
          track.clips.forEach((clip) => {
            session.selectClip(track.id, clip.id, true);
          });
        }
        return;
      }

      // --- Duplicate selection ---
      if (mod && e.key === 'd') {
        e.preventDefault();
        const session = useSessionStore.getState();
        session.copySelectedClips();
        session.pasteClips();
        return;
      }

      // --- Delete selected clips ---
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useSessionStore.getState().deleteSelectedClips();
        return;
      }

      // --- Split clip at playhead ---
      if (e.key === 's' && !mod) {
        // Only split if we have selected clips
        const session = useSessionStore.getState();
        if (session.selectedClips.length > 0) {
          e.preventDefault();
          const position = useTransportStore.getState().position;
          session.selectedClips.forEach((sc) => {
            session.splitClipAtTime(sc.trackId, sc.clipId, position);
          });
        }
        return;
      }

      // --- Escape: clear selection ---
      if (e.key === 'Escape') {
        useSessionStore.getState().clearClipSelection();
        return;
      }

      // --- BPM adjustment ---
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setBpm(Math.min(999, bpm + (e.shiftKey ? 10 : 1)));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setBpm(Math.max(20, bpm - (e.shiftKey ? 10 : 1)));
        return;
      }

      // --- Track navigation (up/down arrows) ---
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const session = useSessionStore.getState();
        const tracks = session.tracks;
        const currentIdx = tracks.findIndex((t) => t.id === session.selectedTrackId);
        const nextIdx = e.key === 'ArrowUp'
          ? Math.max(0, currentIdx - 1)
          : Math.min(tracks.length - 1, currentIdx + 1);
        const nextTrack = tracks[nextIdx];
        if (nextTrack) {
          session.selectTrack(nextTrack.id);
        }
        return;
      }

      // --- Mute / Solo selected track ---
      if (e.key === 'm' && !mod) {
        const trackId = useSessionStore.getState().selectedTrackId;
        if (trackId) {
          e.preventDefault();
          useMixerStore.getState().toggleMute(trackId);
          const track = useSessionStore.getState().tracks.find((t) => t.id === trackId);
          if (track) {
            useSessionStore.getState().updateTrack(trackId, { mute: !track.mute });
          }
        }
        return;
      }

      // --- Solo ---
      if (e.key === 'o' && !mod) {
        const trackId = useSessionStore.getState().selectedTrackId;
        if (trackId) {
          e.preventDefault();
          useMixerStore.getState().toggleSolo(trackId);
          const track = useSessionStore.getState().tracks.find((t) => t.id === trackId);
          if (track) {
            useSessionStore.getState().updateTrack(trackId, { solo: !track.solo });
          }
        }
        return;
      }

      // --- Home: go to start ---
      if (e.key === 'Home') {
        e.preventDefault();
        useTransportStore.getState().setPosition(0);
        return;
      }

      // --- Transport shortcuts ---
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (state === 'playing') {
            pause();
          } else {
            play();
          }
          break;
        case 'Enter':
          e.preventDefault();
          stop();
          break;
        case 'KeyR':
          if (!mod) {
            e.preventDefault();
            toggleRecord();
          }
          break;
        case 'KeyL':
          if (!mod) {
            e.preventDefault();
            toggleLoop();
          }
          break;
        case 'KeyK':
          if (!mod) {
            e.preventDefault();
            toggleMetronome();
          }
          break;
        case 'Numpad0':
        case 'Period':
          // Numpad 0 or . — return to zero
          if (!mod) {
            e.preventDefault();
            stop();
            useTransportStore.getState().setPosition(0);
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, play, pause, stop, undo, redo, toggleRecord, toggleLoop, toggleMetronome, setBpm, bpm]);
}
