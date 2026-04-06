import { useLibraryStore } from '@/stores/library-store';

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

export default function ProjectAssetsPanel() {
  const assets = useLibraryStore((s) => s.getFilteredAssets());
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const removeAsset = useLibraryStore((s) => s.removeAsset);

  const projectAssets = assets.filter(
    (a) => a.source === 'project-local' || a.source === 'ai-generated',
  );

  return (
    <div className="p-2">
      {projectAssets.length === 0 ? (
        <div className="text-xxs text-daw-text-muted/50 text-center py-6">
          No project assets yet. AI-generated clips will appear here.
        </div>
      ) : (
        <div className="space-y-px">
          {projectAssets.map((asset) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              toggleFavorite={toggleFavorite}
              removeAsset={removeAsset}
            />
          ))}
        </div>
      )}
    </div>
  );
}
