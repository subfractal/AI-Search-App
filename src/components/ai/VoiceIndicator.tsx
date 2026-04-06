import { useState, useCallback } from 'react';
import { useCommandStore } from '@/stores/command-store';
import {
  isVoiceSupported,
  startListening,
  stopListening,
  isListening,
} from '@/services/ai/voice-controller';
import { toast } from '@/stores/toast-store';

export default function VoiceIndicator() {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState('');
  const executeTextCommand = useCommandStore((s) => s.executeTextCommand);

  const toggle = useCallback(() => {
    if (!isVoiceSupported()) {
      toast.warning('Voice commands not supported in this browser');
      return;
    }

    if (isListening()) {
      stopListening();
      setActive(false);
      setInterim('');
    } else {
      const started = startListening(
        (transcript, isFinal) => {
          if (isFinal) {
            executeTextCommand(transcript);
            setInterim('');
          } else {
            setInterim(transcript);
          }
        },
        (error) => {
          toast.error(`Voice error: ${error}`);
          setActive(false);
        },
      );
      if (started) {
        setActive(true);
        toast.info('Listening for voice commands...');
      }
    }
  }, [executeTextCommand]);

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={toggle}
        className={`w-7 h-7 flex items-center justify-center border
                    text-xxs font-mono transition-colors
                    ${active
                      ? 'bg-red-600/20 border-red-500/40 text-red-400 animate-pulse'
                      : 'bg-daw-bg border-white/10 text-daw-text-muted hover:text-daw-text'
                    }`}
        aria-label={active ? 'Stop voice input' : 'Start voice input'}
        title={active ? 'Listening...' : 'Voice commands'}
      >
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
          <path d="M8 1a2 2 0 0 0-2 2v5a2 2 0 0 0 4 0V3a2 2 0 0 0-2-2z" />
          <path d="M4.5 7a.5.5 0 0 0-1 0 4.5 4.5 0 0 0 4 4.473V13H6a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H8.5v-1.527A4.5 4.5 0 0 0 12.5 7a.5.5 0 0 0-1 0 3.5 3.5 0 1 1-7 0z" />
        </svg>
      </button>

      {/* Interim transcript tooltip */}
      {active && interim && (
        <div className="absolute bottom-full left-0 mb-1 px-2 py-1
                        bg-daw-surface border border-white/10 shadow-lg
                        text-xxs font-mono text-daw-text-muted whitespace-nowrap
                        max-w-48 truncate">
          {interim}
        </div>
      )}
    </div>
  );
}
