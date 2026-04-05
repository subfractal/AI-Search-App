import { useState, useRef, useEffect, useCallback } from 'react';
import { useCommandStore } from '@/stores/command-store';
import { useAIStore } from '@/stores/ai-store';

export default function CommandBar() {
  const commandBarOpen = useAIStore((s) => s.commandBarOpen);
  const toggleCommandBar = useAIStore((s) => s.toggleCommandBar);
  const inputText = useCommandStore((s) => s.inputText);
  const setInputText = useCommandStore((s) => s.setInputText);
  const executeTextCommand = useCommandStore((s) => s.executeTextCommand);
  const commandHistory = useCommandStore((s) => s.commandHistory);
  const lastResult = useCommandStore((s) => s.lastResult);
  const inputRef = useRef<HTMLInputElement>(null);
  const [historyIdx, setHistoryIdx] = useState(-1);

  useEffect(() => {
    if (commandBarOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [commandBarOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && inputText.trim()) {
        e.preventDefault();
        executeTextCommand(inputText.trim());
        setHistoryIdx(-1);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        toggleCommandBar();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextIdx = Math.min(historyIdx + 1, commandHistory.length - 1);
        setHistoryIdx(nextIdx);
        const cmd = commandHistory[nextIdx];
        if (cmd) setInputText(cmd.raw);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = Math.max(historyIdx - 1, -1);
        setHistoryIdx(nextIdx);
        if (nextIdx < 0) {
          setInputText('');
        } else {
          const cmd = commandHistory[nextIdx];
          if (cmd) setInputText(cmd.raw);
        }
      }
    },
    [inputText, executeTextCommand, toggleCommandBar, historyIdx, commandHistory, setInputText],
  );

  if (!commandBarOpen) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 p-2">
      <div className="bg-daw-surface border border-daw-accent/30 shadow-xl
                      max-w-lg mx-auto">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-daw-accent text-xxs font-mono">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => { setInputText(e.target.value); setHistoryIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command... (e.g. 'add reverb to vocals')"
            className="flex-1 bg-transparent text-daw-text text-xs font-mono
                       outline-none placeholder:text-daw-text-muted"
            aria-label="Command input"
          />
          <button
            onClick={toggleCommandBar}
            className="text-daw-text-muted hover:text-daw-text text-xxs"
            aria-label="Close command bar"
          >
            ESC
          </button>
        </div>

        {lastResult && (
          <div className={`px-3 py-1 border-t border-white/5 text-xxs font-mono
            ${lastResult.success ? 'text-green-400' : 'text-red-400'}`}>
            {lastResult.description}
          </div>
        )}

        {commandHistory.length > 0 && (
          <div className="border-t border-white/5 max-h-32 overflow-y-auto">
            {commandHistory.slice(0, 5).map((cmd, i) => (
              <button
                key={`${cmd.raw}-${i}`}
                onClick={() => { setInputText(cmd.raw); inputRef.current?.focus(); }}
                className="w-full text-left px-3 py-1 text-xxs font-mono
                           text-daw-text-muted hover:bg-white/5 hover:text-daw-text"
              >
                <span className="text-daw-text-dim mr-1">{cmd.intent}</span>
                {cmd.raw}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
