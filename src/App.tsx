import { useState } from 'react';
import TransportBar from '@/components/TransportBar';
import TrackList from '@/components/TrackList';
import Timeline from '@/components/Timeline';
import MixerPanel from '@/components/MixerPanel';
import AISidebar from '@/components/ai/AISidebar';
import FileDropZone from '@/components/FileDropZone';
import InstrumentRack from '@/components/instruments/InstrumentRack';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

export type BottomPanel = 'mixer' | 'instrument' | null;

export default function App() {
  useKeyboardShortcuts();
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('mixer');
  const [showAI, setShowAI] = useState(true);

  const togglePanel = (panel: BottomPanel) => {
    setBottomPanel((current) => (current === panel ? null : panel));
  };

  return (
    <FileDropZone>
      <div className="h-screen flex flex-col bg-daw-bg">
        <TransportBar
          activePanel={bottomPanel}
          onTogglePanel={togglePanel}
          showAI={showAI}
          onToggleAI={() => setShowAI((v) => !v)}
        />

        <div className="flex flex-1 min-h-0">
          <TrackList />

          <div className="flex-1 min-w-0">
            <Timeline />
          </div>

          {showAI && (
            <div className="w-60 border-l border-daw-border/30 shrink-0">
              <AISidebar />
            </div>
          )}
        </div>

        {bottomPanel === 'mixer' && <MixerPanel />}
        {bottomPanel === 'instrument' && (
          <div className="bg-daw-surface border-t border-daw-border/40 h-56
                          shrink-0 overflow-hidden">
            <InstrumentRack />
          </div>
        )}
      </div>
    </FileDropZone>
  );
}
