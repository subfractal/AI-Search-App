import React from 'react';

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsOverlay({ isOpen, onClose }: KeyboardShortcutsOverlayProps) {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-daw-surface border border-daw-border rounded-lg shadow-2xl max-w-2xl max-h-[80vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-daw-surface border-b border-daw-border px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-daw-text">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="text-daw-text-muted hover:text-daw-text transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Transport */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Transport</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['Space']} action="Play / Pause" />
                <ShortcutRow keys={['Home']} action="Go to start" />
                <ShortcutRow keys={['End']} action="Go to end of last clip" />
                <ShortcutRow keys={['Enter']} action="Stop" />
                <ShortcutRow keys={['R']} action="Record" />
                <ShortcutRow keys={['L']} action="Loop" />
                <ShortcutRow keys={['K']} action="Metronome" />
              </div>
            </section>

            {/* Clips & Selection */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Clips & Selection</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['Ctrl', 'C']} action="Copy selected clip" />
                <ShortcutRow keys={['Ctrl', 'V']} action="Paste clip" />
                <ShortcutRow keys={['Ctrl', 'X']} action="Cut clip" />
                <ShortcutRow keys={['Ctrl', 'D']} action="Duplicate clip" />
                <ShortcutRow keys={['Delete']} action="Delete selected clips" />
                <ShortcutRow keys={['S']} action="Split clip at playhead" />
                <ShortcutRow keys={['Ctrl', 'A']} action="Select all clips on track" />
                <ShortcutRow keys={['Esc']} action="Deselect clips" />
              </div>
            </section>

            {/* Clip Navigation */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Clip Navigation</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['←']} action="Nudge selected clip left by 1 beat" />
                <ShortcutRow keys={['→']} action="Nudge selected clip right by 1 beat" />
                <ShortcutRow keys={['↑', '↓']} action="Select previous / next track" />
              </div>
            </section>

            {/* Edit */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Edit</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['Ctrl', 'Z']} action="Undo" />
                <ShortcutRow keys={['Ctrl', 'Y']} action="Redo" />
              </div>
            </section>

            {/* Track Control */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Track Control</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['M']} action="Mute selected track" />
                <ShortcutRow keys={['Alt', 'O']} action="Solo selected track" />
              </div>
            </section>

            {/* Zoom & View */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Zoom & View</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['+']} action="Zoom in" />
                <ShortcutRow keys={['-']} action="Zoom out" />
                <ShortcutRow keys={['Shift', '+']} action="Zoom in by 10" />
                <ShortcutRow keys={['Shift', '-']} action="Zoom out by 10" />
              </div>
            </section>

            {/* Project */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Project</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['Ctrl', 'S']} action="Save project (.dkst)" />
                <ShortcutRow keys={['Ctrl', 'O']} action="Open project file" />
                <ShortcutRow keys={['Ctrl', 'N']} action="New project" />
              </div>
            </section>

            {/* Help */}
            <section>
              <h3 className="text-xs font-bold text-daw-text-muted uppercase mb-3 tracking-wider">Help</h3>
              <div className="space-y-2">
                <ShortcutRow keys={['?']} action="Show this overlay" />
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="bg-daw-bg border-t border-daw-border px-6 py-3 text-center text-xs text-daw-text-muted">
            Press Escape to close
          </div>
        </div>
      </div>
    </>
  );
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-daw-text-muted text-xs">+</span>}
            <kbd className="px-2 py-1 bg-daw-bg border border-daw-border rounded text-xs text-daw-text font-semibold">
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </div>
      <span className="text-xs text-daw-text-muted">{action}</span>
    </div>
  );
}
