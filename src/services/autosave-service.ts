import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useEffectsStore } from '@/stores/effects-store';
import { useAutomationStore } from '@/stores/automation-store';
import { toast } from '@/stores/toast-store';

const DB_NAME = 'de-konstrukt-autosave';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';
const AUTOSAVE_KEY = 'last-session';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

let db: IDBDatabase | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

interface SerializedSession {
  timestamp: number;
  config: ReturnType<typeof useSessionStore.getState>['config'];
  tracks: Array<{
    id: string;
    name: string;
    type: string;
    color: string;
    volume: number;
    pan: number;
    mute: boolean;
    solo: boolean;
    armed: boolean;
    role?: string;
    clipCount: number;
  }>;
  mixer: ReturnType<typeof useMixerStore.getState>['strips'];
  effects: ReturnType<typeof useEffectsStore.getState>['trackEffects'];
  automation: ReturnType<typeof useAutomationStore.getState>['lanes'];
}

function serializeSession(): SerializedSession {
  const session = useSessionStore.getState();
  const mixer = useMixerStore.getState();
  const effects = useEffectsStore.getState();
  const automation = useAutomationStore.getState();

  return {
    timestamp: Date.now(),
    config: session.config,
    tracks: session.tracks.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      color: t.color,
      volume: t.volume,
      pan: t.pan,
      mute: t.mute,
      solo: t.solo,
      armed: t.armed,
      role: t.role,
      clipCount: t.clips.length,
    })),
    mixer: mixer.strips,
    effects: effects.trackEffects,
    automation: automation.lanes,
  };
}

async function saveSession(): Promise<void> {
  try {
    const database = await openDb();
    const data = serializeSession();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, AUTOSAVE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently fail — autosave is best-effort
  }
}

export async function loadLastSession(): Promise<SerializedSession | null> {
  try {
    const database = await openDb();
    const tx = database.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(AUTOSAVE_KEY);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function startAutosave(): void {
  if (intervalId) return;
  intervalId = setInterval(() => {
    saveSession();
  }, AUTOSAVE_INTERVAL);
  // Also save immediately on first start
  saveSession();
}

export function stopAutosave(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export async function checkForRecovery(): Promise<void> {
  const saved = await loadLastSession();
  if (saved && saved.tracks.length > 0) {
    const age = Date.now() - saved.timestamp;
    const minutes = Math.round(age / 60000);
    if (minutes < 60) {
      toast.info(
        `Recovery data found (${saved.tracks.length} tracks, ${minutes}m ago). Re-import audio to restore.`,
      );
    }
  }
}
