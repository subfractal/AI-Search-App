import { useState } from 'react';
import { useLibraryStore } from '@/stores/library-store';
import { FACTORY_TEMPLATES } from '@/services/templates/template-loader';
import { loadTemplate } from '@/services/templates/template-loader';
import type { AssetType, AssetSource } from '@/types/library';

type BrowserTab = 'clips' | 'presets' | 'templates' | 'project';

const TABS: { value: BrowserTab; label: string }[] = [
  { value: 'clips', label: 'Clips' },
  { value: 'presets', label: 'Presets' },
  { value: 'templates', label: 'Templates' },
  { value: 'project', label: 'Project' },
];

const TYPE_FILTERS: { value: AssetType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'clip', label: 'Clips' },
  { value: 'sample', label: 'Samples' },
  { value: 'pattern', label: 'Patterns' },
  { value: 'preset', label: 'Presets' },
  { value: 'kit', label: 'Kits' },
];

const SOURCE_FILTERS: { value: AssetSource | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ai-generated', label: 'AI' },
  { value: 'user', label: 'User' },
  { value: 'factory', label: 'Factory' },
];

export default function BrowserPanel() {
  const [tab, setTab] = useState<BrowserTab>('clips');
  const assets = useLibraryStore((s) => s.getFilteredAssets());
  const filter = useLibraryStore((s) => s.filter);
  const setFilter = useLibraryStore((s) => s.setFilter);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const removeAsset = useLibraryStore((s) => s.removeAsset);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-daw-border/20 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`text-[9px] uppercase tracking-wide px-2 py-1 font-medium transition-all
                       ${tab === t.value
                ? 'bg-daw-accent/15 text-daw-accent border border-daw-accent/30'
                : 'text-daw-text-muted hover:text-daw-text-dim border border-transparent'}`}
          >
            {t.label}
          </button>
        ))}

        {/* Search */}
        <div className="flex-1" />
        <input
          type="text"
          placeholder="Search..."
          value={filter.searchQuery}
          onChange={(e) => setFilter({ searchQuery: e.target.value })}
          className="text-xxs bg-daw-bg/50 text-daw-text px-2 py-1
                     border border-daw-border/20 placeholder:text-daw-text-muted/40
                     focus:outline-none focus:border-daw-accent/40 w-32"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'clips' && <ClipsTab assets={assets} filter={filter} setFilter={setFilter} toggleFavorite={toggleFavorite} removeAsset={removeAsset} />}
        {tab === 'presets' && <PresetsTab assets={assets} filter={filter} setFilter={setFilter} />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'project' && <ProjectTab assets={assets} toggleFavorite={toggleFavorite} removeAsset={removeAsset} />}
      </div>
    </div>
  );
}

function ClipsTab({ assets, filter, setFilter, toggleFavorite, removeAsset }: {
  assets: ReturnType<typeof useLibraryStore.getState>['getFilteredAssets'] extends () => infer R ? R : never;
  filter: { type: string; source: string; favoritesOnly: boolean };
  setFilter: (u: Record<string, unknown>) => void;
  toggleFavorite: (id: string) => void;
  removeAsset: (id: string) => void;
}) {
  const clipAssets = assets.filter((a) => a.type === 'clip' || a.type === 'sample' || a.type === 'pattern');

  return (
    <div className="p-2 space-y-2">
      {/* Filters */}
      <div className="flex items-center gap-1 flex-wrap">
        {SOURCE_FILTERS.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setFilter({ source: sf.value })}
            className={`text-[8px] uppercase px-1.5 py-0.5 transition-all
                       ${filter.source === sf.value
                ? 'bg-daw-accent/15 text-daw-accent'
                : 'text-daw-text-muted/50 hover:text-daw-text-dim'}`}
          >
            {sf.label}
          </button>
        ))}
        <button
          onClick={() => setFilter({ favoritesOnly: !filter.favoritesOnly })}
          className={`text-[8px] px-1.5 py-0.5 transition-all
                     ${filter.favoritesOnly
              ? 'bg-amber-500/15 text-amber-400'
              : 'text-daw-text-muted/50 hover:text-daw-text-dim'}`}
        >
          Fav
        </button>
      </div>

      {/* Asset list */}
      {clipAssets.length === 0 ? (
        <div className="text-xxs text-daw-text-muted/50 text-center py-6">
          No clips yet. Generate MIDI with the AI Composer to populate this library.
        </div>
      ) : (
        <div className="space-y-px">
          {clipAssets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} toggleFavorite={toggleFavorite} removeAsset={removeAsset} />
          ))}
        </div>
      )}
    </div>
  );
}

function PresetsTab({ assets, filter, setFilter }: {
  assets: { type: string; name: string; id: string; tags: string[]; source: string; createdAt: number }[];
  filter: { type: string };
  setFilter: (u: Record<string, unknown>) => void;
}) {
  const presetAssets = assets.filter((a) => a.type === 'preset' || a.type === 'kit');

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center gap-1">
        {TYPE_FILTERS.filter((f) => f.value === 'all' || f.value === 'preset' || f.value === 'kit').map((tf) => (
          <button
            key={tf.value}
            onClick={() => setFilter({ type: tf.value })}
            className={`text-[8px] uppercase px-1.5 py-0.5 transition-all
                       ${filter.type === tf.value
                ? 'bg-daw-accent/15 text-daw-accent'
                : 'text-daw-text-muted/50 hover:text-daw-text-dim'}`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {presetAssets.length === 0 ? (
        <div className="text-xxs text-daw-text-muted/50 text-center py-6">
          No saved presets yet.
        </div>
      ) : (
        <div className="space-y-px">
          {presetAssets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between px-2 py-1 bg-daw-bg/30 text-xxs">
              <span className="text-daw-text truncate">{asset.name}</span>
              <span className="text-daw-text-muted/40 shrink-0 ml-2">{asset.source}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplatesTab() {
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

function ProjectTab({ assets, toggleFavorite, removeAsset }: {
  assets: { id: string; name: string; type: string; source: string; createdByAI: boolean; favorite: boolean; createdAt: number; tags: string[] }[];
  toggleFavorite: (id: string) => void;
  removeAsset: (id: string) => void;
}) {
  const projectAssets = assets.filter((a) => a.source === 'project-local' || a.source === 'ai-generated');

  return (
    <div className="p-2">
      {projectAssets.length === 0 ? (
        <div className="text-xxs text-daw-text-muted/50 text-center py-6">
          No project assets yet. AI-generated clips will appear here.
        </div>
      ) : (
        <div className="space-y-px">
          {projectAssets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} toggleFavorite={toggleFavorite} removeAsset={removeAsset} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetRow({ asset, toggleFavorite, removeAsset }: {
  asset: { id: string; name: string; type: string; source: string; createdByAI: boolean; favorite: boolean; tags: string[] };
  toggleFavorite: (id: string) => void;
  removeAsset: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-daw-bg/30 hover:bg-daw-bg/50 transition-colors group">
      <button
        onClick={() => toggleFavorite(asset.id)}
        className={`text-[10px] shrink-0 transition-colors
                   ${asset.favorite ? 'text-amber-400' : 'text-daw-text-muted/30 hover:text-amber-400/50'}`}
      >
        {asset.favorite ? '\u2605' : '\u2606'}
      </button>
      <span className="text-xxs text-daw-text truncate flex-1">{asset.name}</span>
      {asset.createdByAI && (
        <span className="text-[8px] px-1 py-px bg-daw-ai-accent/10 text-daw-ai-accent shrink-0">AI</span>
      )}
      <span className="text-[8px] text-daw-text-muted/40 shrink-0">{asset.type}</span>
      <button
        onClick={() => removeAsset(asset.id)}
        className="text-daw-text-muted/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xxs shrink-0"
      >
        &times;
      </button>
    </div>
  );
}
