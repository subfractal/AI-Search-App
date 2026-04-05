import { useEffect } from 'react';
import { useKeyStore } from '@/stores/key-store';

interface KeyBadgeProps {
  clipId: string;
  buffer?: AudioBuffer;
  compact?: boolean;
}

const KEY_COLORS: Record<string, string> = {
  'C': '#ff6b6b', 'C#': '#ff8e53', 'D': '#feca57', 'D#': '#48dbfb',
  'E': '#ff9ff3', 'F': '#54a0ff', 'F#': '#5f27cd', 'G': '#01a3a4',
  'G#': '#10ac84', 'A': '#ee5a24', 'A#': '#0abde3', 'B': '#c44569',
};

export default function KeyBadge({ clipId, buffer, compact = false }: KeyBadgeProps) {
  const keyResult = useKeyStore((s) => s.keys[clipId]);
  const detecting = useKeyStore((s) => s.detecting[clipId]);
  const detectKeyAction = useKeyStore((s) => s.detectKey);

  useEffect(() => {
    if (!keyResult && !detecting && buffer) {
      detectKeyAction(clipId, buffer);
    }
  }, [clipId, buffer, keyResult, detecting, detectKeyAction]);

  if (detecting) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5
                       bg-daw-bg/60 text-xxs text-daw-text-muted animate-pulse">
        ...
      </span>
    );
  }

  if (!keyResult) return null;

  const color = KEY_COLORS[keyResult.key] ?? '#888';
  const confidenceColor = keyResult.confidence > 0.7 ? '#4ade80'
    : keyResult.confidence > 0.4 ? '#fbbf24' : '#ef4444';

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5
                   text-xxs font-medium"
        style={{ backgroundColor: color + '20', color }}
        title={`${keyResult.fullName} (${keyResult.camelotCode}) — ${(keyResult.confidence * 100).toFixed(0)}% confidence`}
      >
        <span
          className="w-1 h-1"
          style={{ backgroundColor: confidenceColor }}
        />
        {keyResult.key}{keyResult.scale === 'minor' ? 'm' : ''}
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1
                 border text-xs"
      style={{
        backgroundColor: color + '10',
        borderColor: color + '30',
        color,
      }}
    >
      <span
        className="w-1.5 h-1.5"
        style={{ backgroundColor: confidenceColor }}
      />
      <span className="font-medium">{keyResult.fullName}</span>
      <span className="text-xxs opacity-60">({keyResult.camelotCode})</span>
    </div>
  );
}
