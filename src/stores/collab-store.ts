/**
 * Collaboration Store — manages collaboration session state,
 * presence indicators, and track locks for multi-user editing.
 */

import { create } from 'zustand';
import type { CollaboratorPresence, CollabSession } from '@/types/session-scan';
import { generateId } from '@/utils/id';

const COLLABORATOR_COLORS = [
  '#E63946', '#4ade80', '#818cf8', '#facc15',
  '#f472b6', '#2dd4bf', '#fb923c', '#53c0f0',
];

interface CollabStore {
  session: CollabSession | null;
  trackLocks: Record<string, string>; // trackId → userId

  startSession: (displayName: string) => void;
  endSession: () => void;
  addCollaborator: (name: string) => void;
  removeCollaborator: (userId: string) => void;
  updatePresence: (userId: string, updates: Partial<CollaboratorPresence>) => void;
  lockTrack: (trackId: string, userId: string) => boolean;
  unlockTrack: (trackId: string, userId: string) => void;
  isTrackLocked: (trackId: string) => boolean;
  getTrackLockOwner: (trackId: string) => string | null;
}

export const useCollabStore = create<CollabStore>((set, get) => ({
  session: null,
  trackLocks: {},

  startSession: (displayName) => {
    const session: CollabSession = {
      sessionId: generateId('collab'),
      projectId: generateId('proj'),
      collaborators: [
        {
          userId: 'local',
          displayName,
          color: COLLABORATOR_COLORS[0]!,
          cursorPosition: 0,
          activeTrackId: null,
          lastSeen: Date.now(),
        },
      ],
      isHost: true,
      status: 'connected',
    };
    set({ session });
  },

  endSession: () => set({ session: null, trackLocks: {} }),

  addCollaborator: (name) =>
    set((s) => {
      if (!s.session) return s;
      const idx = s.session.collaborators.length;
      const newCollab: CollaboratorPresence = {
        userId: generateId('user'),
        displayName: name,
        color: COLLABORATOR_COLORS[idx % COLLABORATOR_COLORS.length]!,
        cursorPosition: 0,
        activeTrackId: null,
        lastSeen: Date.now(),
      };
      return {
        session: {
          ...s.session,
          collaborators: [...s.session.collaborators, newCollab],
        },
      };
    }),

  removeCollaborator: (userId) =>
    set((s) => {
      if (!s.session) return s;
      // Release locks held by this user
      const newLocks = { ...s.trackLocks };
      for (const [trackId, lockOwner] of Object.entries(newLocks)) {
        if (lockOwner === userId) delete newLocks[trackId];
      }
      return {
        session: {
          ...s.session,
          collaborators: s.session.collaborators.filter((c) => c.userId !== userId),
        },
        trackLocks: newLocks,
      };
    }),

  updatePresence: (userId, updates) =>
    set((s) => {
      if (!s.session) return s;
      return {
        session: {
          ...s.session,
          collaborators: s.session.collaborators.map((c) =>
            c.userId === userId ? { ...c, ...updates, lastSeen: Date.now() } : c,
          ),
        },
      };
    }),

  lockTrack: (trackId, userId) => {
    const state = get();
    const existing = state.trackLocks[trackId];
    if (existing && existing !== userId) return false; // Already locked by someone else
    set((s) => ({
      trackLocks: { ...s.trackLocks, [trackId]: userId },
    }));
    return true;
  },

  unlockTrack: (trackId, userId) =>
    set((s) => {
      if (s.trackLocks[trackId] !== userId) return s;
      const newLocks = { ...s.trackLocks };
      delete newLocks[trackId];
      return { trackLocks: newLocks };
    }),

  isTrackLocked: (trackId) => !!get().trackLocks[trackId],

  getTrackLockOwner: (trackId) => get().trackLocks[trackId] ?? null,
}));
