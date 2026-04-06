import { create } from 'zustand';

export interface ImportProgress {
  fileName: string;
  stage: 'decoding' | 'classifying' | 'analyzing-bpm' | 'analyzing-key' | 'done';
  percent: number;
}

interface ImportProgressStore {
  current: ImportProgress | null;
  set: (progress: ImportProgress | null) => void;
}

export const useImportProgressStore = create<ImportProgressStore>((set) => ({
  current: null,
  set: (progress) => set({ current: progress }),
}));

export const importProgress = {
  start: (fileName: string) =>
    useImportProgressStore.getState().set({ fileName, stage: 'decoding', percent: 0 }),
  update: (stage: ImportProgress['stage'], percent: number) => {
    const current = useImportProgressStore.getState().current;
    if (current) {
      useImportProgressStore.getState().set({ ...current, stage, percent });
    }
  },
  done: () => useImportProgressStore.getState().set(null),
};
