import { generateId } from '@/utils/id';

export interface HistoryEntry {
  id: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}

const MAX_HISTORY = 100;

const history: HistoryEntry[] = [];
let pointer = -1;

export function pushAction(
  description: string,
  undo: () => void,
  redo: () => void
): void {
  // Clear any redo entries beyond current pointer
  if (pointer < history.length - 1) {
    history.splice(pointer + 1);
  }

  const entry: HistoryEntry = {
    id: generateId('hist'),
    description,
    timestamp: Date.now(),
    undo,
    redo,
  };

  history.push(entry);

  // Enforce max history limit
  if (history.length > MAX_HISTORY) {
    history.shift();
  } else {
    pointer += 1;
  }
}

export function undo(): boolean {
  if (!canUndo()) return false;
  const entry = history[pointer];
  if (!entry) return false;
  entry.undo();
  pointer -= 1;
  return true;
}

export function redo(): boolean {
  if (!canRedo()) return false;
  pointer += 1;
  const entry = history[pointer];
  if (!entry) return false;
  entry.redo();
  return true;
}

export function canUndo(): boolean {
  return pointer >= 0;
}

export function canRedo(): boolean {
  return pointer < history.length - 1;
}

export function getHistory(): HistoryEntry[] {
  return history.slice(0, pointer + 1);
}

export function getRedoStack(): HistoryEntry[] {
  return history.slice(pointer + 1);
}

export function clearHistory(): void {
  history.length = 0;
  pointer = -1;
}
