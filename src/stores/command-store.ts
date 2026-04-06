import { create } from 'zustand';
import { useSessionStore } from '@/stores/session-store';
import { parseCommand } from '@/services/ai/nl-command-parser';
import { executeNLCommand } from '@/services/ai/nl-command-executor';
import { useAIStore } from '@/stores/ai-store';
import { toast } from '@/stores/toast-store';
import type { ParsedCommand, CommandResult } from '@/types/commands';

interface CommandStore {
  commandHistory: ParsedCommand[];
  lastResult: CommandResult | null;
  isListening: boolean;
  inputText: string;

  setInputText: (text: string) => void;
  executeTextCommand: (text: string) => CommandResult;
  setListening: (listening: boolean) => void;
  clearHistory: () => void;
}

export const useCommandStore = create<CommandStore>((set) => ({
  commandHistory: [],
  lastResult: null,
  isListening: false,
  inputText: '',

  setInputText: (text) => set({ inputText: text }),

  executeTextCommand: (text: string): CommandResult => {
    const tracks = useSessionStore.getState().tracks;
    const parsed = parseCommand(text, tracks);

    if (!parsed || parsed.intent === 'unknown') {
      const result: CommandResult = {
        success: false,
        description: `Could not understand: "${text}"`,
        undoable: false,
        affectedTrackIds: [],
      };
      set({ lastResult: result });
      toast.warning(result.description);
      return result;
    }

    // Log the command
    set((s) => ({
      commandHistory: [parsed, ...s.commandHistory].slice(0, 50),
    }));

    // Execute
    const result = executeNLCommand(parsed);
    set({ lastResult: result, inputText: '' });

    // Show result
    if (result.success) {
      toast.success(result.description);
    } else {
      toast.error(result.description);
    }

    // Log to AI activity
    useAIStore.getState().logActivity({
      id: `cmd-${Date.now()}`,
      description: `Command: "${text}" → ${result.description}`,
      trackId: result.affectedTrackIds[0] ?? null,
      timestamp: Date.now(),
      undoable: result.undoable,
    });

    return result;
  },

  setListening: (listening) => set({ isListening: listening }),

  clearHistory: () => set({ commandHistory: [], lastResult: null }),
}));
