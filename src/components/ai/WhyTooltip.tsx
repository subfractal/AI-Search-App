import { useState, type ReactNode } from 'react';
import type { AIExplanation } from '@/services/ai/explanation-engine';

interface WhyTooltipProps {
  explanation: AIExplanation;
  children: ReactNode;
  onRevert?: () => void;
}

export default function WhyTooltip({ explanation, children, onRevert }: WhyTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => { setVisible(false); setShowAlternatives(false); }}
    >
      {children}

      {visible && (
        <div
          className="absolute z-50 bottom-full left-0 mb-1 w-72
                     bg-daw-surface border border-white/10 shadow-xl p-3
                     text-xxs font-mono"
        >
          {/* What */}
          <div className="mb-2">
            <span className="text-daw-accent font-bold">What: </span>
            <span className="text-daw-text">{explanation.what}</span>
          </div>

          {/* Why */}
          <div className="mb-2">
            <span className="text-yellow-400 font-bold">Why: </span>
            <span className="text-daw-text-muted">{explanation.why}</span>
          </div>

          {/* How */}
          <div className="mb-2">
            <span className="text-green-400 font-bold">How: </span>
            <span className="text-daw-text-muted">{explanation.how}</span>
          </div>

          {/* Alternatives */}
          {explanation.alternatives.length > 0 && (
            <div>
              <button
                onClick={() => setShowAlternatives(!showAlternatives)}
                className="text-daw-text-dim hover:text-daw-text underline"
              >
                {showAlternatives ? 'Hide' : 'Show'} alternatives
              </button>
              {showAlternatives && (
                <ul className="mt-1 space-y-0.5 text-daw-text-muted">
                  {explanation.alternatives.map((alt, i) => (
                    <li key={i} className="pl-2 border-l border-white/10">
                      {alt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Revert button */}
          {onRevert && (
            <button
              onClick={onRevert}
              className="mt-2 w-full py-1 text-xxs font-mono bg-red-600/20
                         border border-red-500/30 text-red-400
                         hover:bg-red-600/30"
            >
              Revert this
            </button>
          )}
        </div>
      )}
    </div>
  );
}
