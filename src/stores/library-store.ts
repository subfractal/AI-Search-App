import { create } from 'zustand';
import type { LibraryAsset, LibraryFilter } from '@/types/library';
import type { Clip } from '@/types/audio';
import { generateId } from '@/utils/id';

interface LibraryStore {
  assets: Record<string, LibraryAsset>;
  filter: LibraryFilter;

  addAsset: (asset: Omit<LibraryAsset, 'id' | 'createdAt'>) => string;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<LibraryAsset>) => void;
  toggleFavorite: (id: string) => void;
  setFilter: (updates: Partial<LibraryFilter>) => void;

  saveClipAsAsset: (
    clip: Clip,
    name: string,
    tags?: string[],
    createdByAI?: boolean,
  ) => string;

  getFilteredAssets: () => LibraryAsset[];
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  assets: {},
  filter: {
    type: 'all',
    source: 'all',
    searchQuery: '',
    favoritesOnly: false,
  },

  addAsset: (partial) => {
    const id = generateId('asset');
    const asset: LibraryAsset = {
      ...partial,
      id,
      createdAt: Date.now(),
    };
    set((state) => ({
      assets: { ...state.assets, [id]: asset },
    }));
    return id;
  },

  removeAsset: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.assets;
      return { assets: rest };
    }),

  updateAsset: (id, updates) =>
    set((state) => {
      const asset = state.assets[id];
      if (!asset) return state;
      return {
        assets: { ...state.assets, [id]: { ...asset, ...updates } },
      };
    }),

  toggleFavorite: (id) =>
    set((state) => {
      const asset = state.assets[id];
      if (!asset) return state;
      return {
        assets: {
          ...state.assets,
          [id]: { ...asset, favorite: !asset.favorite },
        },
      };
    }),

  setFilter: (updates) =>
    set((state) => ({
      filter: { ...state.filter, ...updates },
    })),

  saveClipAsAsset: (clip, name, tags = [], createdByAI = false) => {
    const id = generateId('asset');
    const asset: LibraryAsset = {
      id,
      name,
      type: 'clip',
      source: createdByAI ? 'ai-generated' : 'user',
      tags,
      createdByAI,
      favorite: false,
      createdAt: Date.now(),
      data: clip,
    };
    set((state) => ({
      assets: { ...state.assets, [id]: asset },
    }));
    return id;
  },

  getFilteredAssets: () => {
    const { assets, filter } = get();
    let result = Object.values(assets);

    if (filter.type !== 'all') {
      result = result.filter((a) => a.type === filter.type);
    }
    if (filter.source !== 'all') {
      result = result.filter((a) => a.source === filter.source);
    }
    if (filter.favoritesOnly) {
      result = result.filter((a) => a.favorite);
    }
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  },
}));
