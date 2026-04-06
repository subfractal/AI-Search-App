/**
 * Voice Controller — Web Speech API integration for voice commands.
 * Feeds recognized text to nl-command-parser for execution.
 */

type VoiceCallback = (transcript: string, isFinal: boolean) => void;
type ErrorCallback = (error: string) => void;

interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

let recognition: SpeechRecognitionInstance | null = null;
let listening = false;
let currentCallback: VoiceCallback | null = null;
let currentErrorCallback: ErrorCallback | null = null;

/**
 * Check if Web Speech API is available.
 */
export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && (
    'SpeechRecognition' in window ||
    'webkitSpeechRecognition' in window
  );
}

/**
 * Initialize speech recognition instance.
 */
function getRecognition(): SpeechRecognitionInstance | null {
  if (recognition) return recognition;
  if (!isVoiceSupported()) return null;

  const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition
    ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  recognition = new (SpeechRecognition as new () => SpeechRecognitionInstance)();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i]!;
      const transcript = result[0]!.transcript.trim();
      if (currentCallback) {
        currentCallback(transcript, result.isFinal);
      }
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (currentErrorCallback) {
      currentErrorCallback(event.error);
    }
  };

  recognition.onend = () => {
    // Auto-restart if still supposed to be listening
    if (listening && recognition) {
      try {
        recognition.start();
      } catch {
        listening = false;
      }
    }
  };

  return recognition;
}

/**
 * Start listening for voice commands.
 */
export function startListening(
  onResult: VoiceCallback,
  onError?: ErrorCallback,
): boolean {
  const rec = getRecognition();
  if (!rec) return false;

  currentCallback = onResult;
  currentErrorCallback = onError ?? null;
  listening = true;

  try {
    rec.start();
    return true;
  } catch {
    listening = false;
    return false;
  }
}

/**
 * Stop listening.
 */
export function stopListening(): void {
  listening = false;
  currentCallback = null;
  currentErrorCallback = null;

  if (recognition) {
    try {
      recognition.stop();
    } catch {
      // Already stopped
    }
  }
}

/**
 * Check if currently listening.
 */
export function isListening(): boolean {
  return listening;
}
