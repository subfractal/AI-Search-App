import { useEffect, useState } from 'react';
import {
  acceptSuggestion,
  rejectSuggestion,
} from '@/services/ai/suggestion-engine';
import type { AISuggestion } from '@/types/ai';

const TYPE_COLORS: Record<string, string> = {
  clipping: '#ef4444',
  level: '#f59e0b',
  eq: '#38bdf8',
  masking: '#f97316',
  loudness: '#a78bfa',
  'gain-staging': '#4ade80',
  pan: '#34d399',
  compression: '#8b5cf6',
  noise: '#fb923c',
};

interface InlineSuggestionProps {
  suggestion: AISuggestion;
  style: React.CSSProperties;
}

export default function InlineSuggestion({
  suggestion,
  style,
}: InlineSuggestionProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 15000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const color = TYPE_COLORS[suggestion.type] ?? '#a78bfa';

  return (
    <div
      style={style}
      className="absolute z-20 pointer-events-auto"
    >
      <div
        className="bg-[#1e1e1e] border rounded shadow-lg
                   max-w-[200px] p-1.5 animate-in fade-in slide-in-from-right-2"
        style={{ borderColor: color + '60' }}
      >
        <div className="flex items-start gap-1">
          <div
            className="w-1 self-stretch rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color }}
            >
              {suggestion.type}
            </div>
            <div className="text-[10px] text-[#ccc] leading-tight mt-0.5 line-clamp-2">
              {suggestion.title}
            </div>
          </div>
        </div>
        <div className="flex gap-1 mt-1.5">
          {suggestion.action && (
            <button
              onClick={() => {
                acceptSuggestion(suggestion.id);
                setVisible(false);
              }}
              className="flex-1 text-[9px] py-0.5 rounded font-medium
                         bg-green-600/25 text-green-400
                         hover:bg-green-600/40 transition-colors"
            >
              Fix
            </button>
          )}
          <button
            onClick={() => {
              rejectSuggestion(suggestion.id);
              setVisible(false);
            }}
            className="flex-1 text-[9px] py-0.5 rounded font-medium
                       bg-white/5 text-[#888]
                       hover:bg-white/10 transition-colors"
          >
            X
          </button>
        </div>
      </div>
    </div>
  );
}
