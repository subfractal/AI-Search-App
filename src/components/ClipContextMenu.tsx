import { useEffect, useRef, useCallback } from 'react';
import type { Clip } from '@/types/audio';
import { isAudioClip, isMidiClip } from '@/types/audio';
import type { AudioClip, MidiClip } from '@/types/audio';
import { useSessionStore } from '@/stores/session-store';
import {
  splitClip,
  duplicateClip,
  reverseClip,
  normalizeClip,
  quantizeNotes,
} from '@/services/clip-editor';

interface ClipContextMenuProps {
  clip: Clip;
  trackId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

interface MenuItem {
  label: string;
  icon: string;
  action: () => void;
  show: boolean;
}

export default function ClipContextMenu({
  clip,
  trackId,
  position,
  onClose,
}: ClipContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const addClipToTrack = useSessionStore((s) => s.addClipToTrack);
  const removeClip = useSessionStore((s) => s.removeClip);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleSplit = useCallback(() => {
    // Split at the midpoint of the clip as a default
    const splitTime = clip.duration / 2;
    const [left, right] = splitClip(clip, splitTime);
    removeClip(trackId, clip.id);
    addClipToTrack(trackId, left);
    addClipToTrack(trackId, right);
    onClose();
  }, [clip, trackId, removeClip, addClipToTrack, onClose]);

  const handleDuplicate = useCallback(() => {
    const dup = duplicateClip(clip);
    addClipToTrack(trackId, dup);
    onClose();
  }, [clip, trackId, addClipToTrack, onClose]);

  const handleReverse = useCallback(() => {
    if (!isAudioClip(clip)) return;
    const reversed = reverseClip(clip as AudioClip);
    removeClip(trackId, clip.id);
    addClipToTrack(trackId, reversed);
    onClose();
  }, [clip, trackId, removeClip, addClipToTrack, onClose]);

  const handleNormalize = useCallback(() => {
    if (!isAudioClip(clip)) return;
    const normalized = normalizeClip(clip as AudioClip);
    removeClip(trackId, clip.id);
    addClipToTrack(trackId, normalized);
    onClose();
  }, [clip, trackId, removeClip, addClipToTrack, onClose]);

  const handleQuantize = useCallback(() => {
    if (!isMidiClip(clip)) return;
    // Default to 16th notes at 120 BPM = 0.125s
    const quantized = quantizeNotes(clip as MidiClip, 0.125);
    removeClip(trackId, clip.id);
    addClipToTrack(trackId, quantized);
    onClose();
  }, [clip, trackId, removeClip, addClipToTrack, onClose]);

  const handleDelete = useCallback(() => {
    removeClip(trackId, clip.id);
    onClose();
  }, [clip.id, trackId, removeClip, onClose]);

  const items: MenuItem[] = [
    {
      label: 'Split at Playhead',
      icon: '\u2702',
      action: handleSplit,
      show: true,
    },
    {
      label: 'Duplicate',
      icon: '\u2398',
      action: handleDuplicate,
      show: true,
    },
    {
      label: 'Reverse',
      icon: '\u21C4',
      action: handleReverse,
      show: isAudioClip(clip),
    },
    {
      label: 'Normalize',
      icon: '\u2195',
      action: handleNormalize,
      show: isAudioClip(clip),
    },
    {
      label: 'Quantize Notes',
      icon: '\u2630',
      action: handleQuantize,
      show: isMidiClip(clip),
    },
    {
      label: 'Delete',
      icon: '\u2715',
      action: handleDelete,
      show: true,
    },
  ];

  const visibleItems = items.filter((i) => i.show);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] py-1
                 bg-daw-panel border border-daw-border/60
                 shadow-lg shadow-black/40"
      style={{ left: position.x, top: position.y }}
    >
      {visibleItems.map((item, idx) => (
        <button
          key={idx}
          onClick={item.action}
          className="w-full flex items-center gap-2 px-3 py-1.5
                     text-daw-text-dim text-xs text-left
                     hover:bg-daw-accent/20 hover:text-daw-text
                     transition-colors"
        >
          <span className="w-4 text-center text-sm leading-none">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
