export type AssetType = 'clip' | 'sample' | 'pattern' | 'preset' | 'template' | 'kit';
export type AssetSource = 'factory' | 'user' | 'ai-generated' | 'project-local';

export interface LibraryAsset {
  id: string;
  name: string;
  type: AssetType;
  source: AssetSource;
  tags: string[];
  createdByAI: boolean;
  instrumentFamily?: string;
  genre?: string;
  tempoHint?: number;
  keyHint?: string;
  lengthBars?: number;
  favorite: boolean;
  createdAt: number;
  data: unknown;
}

export interface LibraryFilter {
  type: AssetType | 'all';
  source: AssetSource | 'all';
  searchQuery: string;
  favoritesOnly: boolean;
}
