import { useEffect } from 'react';
import { useTransportStore } from '@/stores/transport-store';

export function useKeyboardShortcuts(): void {
  const play = useTransportStore((s) => s.play);
  const pause = useTransportStore((s) => s.pause);
  const stop = useTransportStore((s) => s.stop);
  const state = useTransportStore((s) => s.state);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

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
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, play, pause, stop]);
}
