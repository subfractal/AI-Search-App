import { useState } from 'react';
import { FACTORY_TEMPLATES, loadTemplate } from '@/services/templates/template-loader';

export default function TemplatesPanel() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleLoad = (templateId: string) => {
    setLoading(templateId);
    loadTemplate(templateId);
    setTimeout(() => setLoading(null), 500);
  };

  return (
    <div className="p-2 grid grid-cols-2 gap-2">
      {FACTORY_TEMPLATES.map((tpl) => (
        <div
          key={tpl.id}
          className="bg-daw-bg/40 border border-daw-border/20 p-2 flex flex-col gap-1"
        >
          <span className="text-xxs font-semibold text-daw-text">{tpl.name}</span>
          <span className="text-[9px] text-daw-text-muted/60 leading-tight">{tpl.description}</span>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[8px] text-daw-text-muted/40">
              {tpl.tracks.length} tracks
            </span>
            {tpl.genre && (
              <span className="text-[8px] text-daw-accent/50">{tpl.genre}</span>
            )}
            <div className="flex-1" />
            <button
              onClick={() => handleLoad(tpl.id)}
              disabled={loading === tpl.id}
              className="text-[9px] px-2 py-0.5 bg-daw-accent/15 text-daw-accent
                         hover:bg-daw-accent/25 transition-all disabled:opacity-40"
            >
              {loading === tpl.id ? 'Loading...' : 'Load'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
