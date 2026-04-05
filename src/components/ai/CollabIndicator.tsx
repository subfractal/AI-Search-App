/**
 * Collaboration Indicator — shows active collaborators,
 * connection status, and track lock indicators.
 */

import { useCollabStore } from '@/stores/collab-store';

export default function CollabIndicator() {
  const session = useCollabStore((s) => s.session);
  const startSession = useCollabStore((s) => s.startSession);
  const endSession = useCollabStore((s) => s.endSession);

  if (!session) {
    return (
      <button
        onClick={() => startSession('You')}
        className="w-full text-[8px] py-1 font-mono text-daw-text-muted
                   bg-daw-bg/40 hover:bg-daw-bg/60 transition-all"
      >
        Start Collaboration Session
      </button>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    connected: '#4ade80',
    disconnected: '#E63946',
    reconnecting: '#facc15',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[session.status] ?? '#6b7280' }}
          />
          <span className="text-[8px] text-daw-text-muted uppercase font-mono">
            {session.status}
          </span>
        </div>
        <button
          onClick={endSession}
          className="text-[7px] px-1 py-0.5 bg-daw-bg/60 text-daw-text-muted hover:text-daw-text-dim"
        >
          Leave
        </button>
      </div>

      {/* Collaborators */}
      <div className="flex gap-1">
        {session.collaborators.map((c) => (
          <div
            key={c.userId}
            className="flex items-center gap-1 bg-daw-bg/40 px-1.5 py-0.5"
            title={c.displayName}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            <span className="text-[8px] text-daw-text-dim truncate max-w-12">
              {c.displayName}
            </span>
          </div>
        ))}
      </div>

      <div className="text-[7px] text-daw-text-muted/60">
        Session: {session.sessionId.slice(0, 8)}...
      </div>
    </div>
  );
}
