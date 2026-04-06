import * as Tone from 'tone';
import { getTrackNodes } from './track-manager';
import { generateId } from '@/utils/id';

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let userMedia: Tone.UserMedia | null = null;
let chunks: Blob[] = [];
let currentTrackId: string | null = null;
let recording = false;

export async function requestMicrophoneAccess(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaStream = stream;
  return stream;
}

export function startRecording(trackId: string): void {
  if (recording) {
    throw new Error('Already recording');
  }

  if (!mediaStream) {
    throw new Error(
      'Microphone access not granted. Call requestMicrophoneAccess() first.',
    );
  }

  currentTrackId = trackId;
  chunks = [];
  recording = true;

  // Set up monitoring through the track's channel
  const trackNode = getTrackNodes(trackId);
  if (trackNode) {
    userMedia = new Tone.UserMedia();
    userMedia.open().then(() => {
      if (userMedia && trackNode) {
        userMedia.connect(trackNode.channel);
      }
    }).catch(() => {
      // Monitoring is optional; recording proceeds without it
    });
  }

  // Create MediaRecorder
  mediaRecorder = new MediaRecorder(mediaStream, {
    mimeType: getSupportedMimeType(),
  });

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  mediaRecorder.start(100); // Collect data every 100ms
}

export function stopRecording(): Promise<{
  buffer: AudioBuffer;
  blob: Blob;
}> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || !recording) {
      reject(new Error('Not currently recording'));
      return;
    }

    mediaRecorder.onstop = async () => {
      // Clean up monitoring
      if (userMedia) {
        userMedia.close();
        userMedia.dispose();
        userMedia = null;
      }

      recording = false;
      currentTrackId = null;

      const mimeType = mediaRecorder?.mimeType ?? 'audio/webm';
      const blob = new Blob(chunks, { type: mimeType });
      chunks = [];
      mediaRecorder = null;

      try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = Tone.getContext().rawContext as AudioContext;
        const buffer = await audioCtx.decodeAudioData(arrayBuffer);
        resolve({ buffer, blob });
      } catch (err) {
        reject(
          new Error(
            `Failed to decode recorded audio: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
      }
    };

    mediaRecorder.onerror = () => {
      recording = false;
      currentTrackId = null;
      reject(new Error('MediaRecorder error'));
    };

    mediaRecorder.stop();
  });
}

export function isRecording(): boolean {
  return recording;
}

export function getRecordingTrackId(): string | null {
  return currentTrackId;
}

export function createClipFromRecording(
  trackId: string,
  buffer: AudioBuffer,
  startTime: number,
): {
  id: string;
  trackId: string;
  name: string;
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
  offset: number;
} {
  return {
    id: generateId('clip'),
    trackId,
    name: `Recording ${new Date().toLocaleTimeString()}`,
    buffer,
    startTime,
    duration: buffer.duration,
    offset: 0,
  };
}

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'audio/webm';
}
