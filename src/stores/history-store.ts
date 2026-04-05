import { create } from 'zustand';
import * as historyService from '@/services/history-service';

interface HistoryStore {
  undoCount: number;
  redoCount: number;
  lastAction: string | null;

  undo: () => void;
  redo: () => void;
  pushAction: (description: string, undo: () => void, redo: () => void) => void;
  batchAction: (description: string, actions: Array<{ undo: () => void; redo: () => void }>) => void;
  clearHistory: () => void;
  refresh: () => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  undoCount: 0,
  redoCount: 0,
  lastAction: null,

  undo: () => {
    const success = historyService.undo();
    if (success) {
      set({
        undoCount: historyService.getHistory().length,
        redoCount: historyService.getRedoStack().length,
        lastAction: (() => {
          const h = historyService.getHistory();
          return h.length > 0 ? h[h.length - 1]!.description : null;
        })(),
      });
    }
  },

  redo: () => {
    const success = historyService.redo();
    if (success) {
      set({
        undoCount: historyService.getHistory().length,
        redoCount: historyService.getRedoStack().length,
        lastAction: (() => {
          const h = historyService.getHistory();
          return h.length > 0 ? h[h.length - 1]!.description : null;
        })(),
      });
    }
  },

  pushAction: (description, undo, redo) => {
    historyService.pushAction(description, undo, redo);
    set({
      undoCount: historyService.getHistory().length,
      redoCount: historyService.getRedoStack().length,
      lastAction: description,
    });
  },

  batchAction: (description, actions) => {
    const batchUndo = () => {
      for (let i = actions.length - 1; i >= 0; i--) {
        actions[i]!.undo();
      }
    };
    const batchRedo = () => {
      for (const action of actions) {
        action.redo();
      }
    };
    historyService.pushAction(description, batchUndo, batchRedo);
    set({
      undoCount: historyService.getHistory().length,
      redoCount: historyService.getRedoStack().length,
      lastAction: description,
    });
  },

  clearHistory: () => {
    historyService.clearHistory();
    set({
      undoCount: 0,
      redoCount: 0,
      lastAction: null,
    });
  },

  refresh: () => {
    set({
      undoCount: historyService.getHistory().length,
      redoCount: historyService.getRedoStack().length,
      lastAction: (() => {
          const h = historyService.getHistory();
          return h.length > 0 ? h[h.length - 1]!.description : null;
        })(),
    });
  },
}));
