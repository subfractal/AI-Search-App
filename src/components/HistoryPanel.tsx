import { useHistoryStore } from '@/stores/history-store';
import * as historyService from '@/services/history-service';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function HistoryPanel({ open, onClose }: HistoryPanelProps) {
  const { undoCount, redoCount, undo, redo, clearHistory } = useHistoryStore();

  if (!open) return null;

  const doneEntries = historyService.getHistory();
  const redoEntries = historyService.getRedoStack();

  return (
    <div className="absolute right-2 top-[72px] z-50 w-[min(90vw,16rem)] rounded border
                    border-daw-border bg-daw-panel shadow-lg max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5
                      border-b border-daw-border">
        <span className="text-xxs font-semibold text-daw-text-dim uppercase tracking-wide">
          History
        </span>
        <button
          onClick={onClose}
          className="text-daw-text-muted hover:text-daw-text-dim text-xs
                     leading-none px-1"
        >
          x
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-daw-border">
        <button
          onClick={undo}
          disabled={undoCount === 0}
          className="daw-button text-xxs px-2 py-0.5 disabled:opacity-30"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={redoCount === 0}
          className="daw-button text-xxs px-2 py-0.5 disabled:opacity-30"
        >
          Redo
        </button>
        <div className="flex-1" />
        <button
          onClick={clearHistory}
          disabled={undoCount === 0 && redoCount === 0}
          className="text-xxs text-daw-text-muted hover:text-daw-text-dim
                     disabled:opacity-30"
        >
          Clear
        </button>
      </div>

      {/* History list */}
      <div className="max-h-60 overflow-y-auto py-1">
        {doneEntries.length === 0 && redoEntries.length === 0 && (
          <div className="px-3 py-2 text-xxs text-daw-text-muted text-center">
            No actions recorded
          </div>
        )}

        {/* Redo entries (future actions, dimmed) */}
        {[...redoEntries].reverse().map((entry) => (
          <div
            key={entry.id}
            className="px-3 py-0.5 text-xxs text-daw-text-muted/50 truncate"
          >
            {entry.description}
          </div>
        ))}

        {/* Current position indicator */}
        {(doneEntries.length > 0 || redoEntries.length > 0) && (
          <div className="px-3 py-0.5 flex items-center gap-1">
            <div className="flex-1 h-px bg-daw-accent/40" />
            <span className="text-xxs text-daw-accent">current</span>
            <div className="flex-1 h-px bg-daw-accent/40" />
          </div>
        )}

        {/* Done entries (past actions, most recent first) */}
        {[...doneEntries].reverse().map((entry, idx) => (
          <div
            key={entry.id}
            className={`px-3 py-0.5 text-xxs truncate ${
              idx === 0
                ? 'text-daw-text-dim'
                : 'text-daw-text-muted'
            }`}
          >
            {entry.description}
          </div>
        ))}
      </div>
    </div>
  );
}
