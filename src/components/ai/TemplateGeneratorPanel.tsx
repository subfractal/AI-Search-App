/**
 * Template Generator Panel — create adaptive templates from
 * the current session scan results, or apply saved templates.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { runSessionScan } from '@/services/ai/session-scanner';
import { generateTemplate, applyTemplate } from '@/services/ai/template-generator';
import type { AdaptiveTemplate } from '@/types/session-scan';

export default function TemplateGeneratorPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const [templates, setTemplates] = useState<AdaptiveTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    if (tracks.length === 0) return;
    setGenerating(true);
    try {
      const scan = runSessionScan();
      const template = generateTemplate(scan, templateName || undefined);
      setTemplates((prev) => [...prev, template]);
      setTemplateName('');
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = (template: AdaptiveTemplate) => {
    applyTemplate(template);
  };

  const handleRemove = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Template name..."
          className="flex-1 text-[9px] bg-daw-bg border border-daw-border/30 px-1.5 py-1
                     text-daw-text-dim placeholder:text-daw-text-muted/50"
        />
        <button
          onClick={handleGenerate}
          disabled={generating || tracks.length === 0}
          className="text-[8px] px-2 py-1 font-bold font-mono uppercase
                     bg-[#E63946]/20 text-[#E63946] hover:bg-[#E63946]/30
                     disabled:opacity-30 transition-all shrink-0"
        >
          {generating ? '...' : 'Create'}
        </button>
      </div>

      {templates.length > 0 && (
        <div className="space-y-1">
          {templates.map((t) => (
            <div key={t.id} className="bg-daw-bg/40 p-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-daw-text-dim font-mono truncate">
                  {t.name}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleApply(t)}
                    className="text-[7px] px-1 py-0.5 bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => handleRemove(t.id)}
                    className="text-[7px] px-1 py-0.5 bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim"
                  >
                    X
                  </button>
                </div>
              </div>
              <div className="text-[8px] text-daw-text-muted mt-0.5">
                {t.genre} · {t.bpm} BPM · {t.key} · {t.trackStack.length} tracks ·
                {t.busStructure.length} buses · {t.suggestedEffects.length} effects
              </div>
            </div>
          ))}
        </div>
      )}

      {templates.length === 0 && (
        <div className="text-[9px] text-daw-text-muted text-center py-1">
          Create templates from your session to reuse track setups, routing, and effects.
        </div>
      )}
    </div>
  );
}
