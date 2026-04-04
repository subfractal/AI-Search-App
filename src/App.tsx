import { useState } from 'react';
import TransportBar from '@/components/TransportBar';
import TrackList from '@/components/TrackList';
import Timeline from '@/components/Timeline';
import MixerPanel from '@/components/MixerPanel';
import AISidebar from '@/components/ai/AISidebar';
import FileDropZone from '@/components/FileDropZone';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

export default function App() {
  useKeyboardShortcuts();
  const [showMixer, setShowMixer] = useState(true);
  const [showAI, setShowAI] = useState(true);

  return (
    <FileDropZone>
      <div className="h-screen flex flex-col">
        <TransportBar
          showMixer={showMixer}
          onToggleMixer={() => setShowMixer((v) => !v)}
          showAI={showAI}
          onToggleAI={() => setShowAI((v) => !v)}
        />

        <div className="flex flex-1 min-h-0">
          <TrackList />

          <div className="flex-1 min-w-0">
            <Timeline />
          </div>

          {showAI && (
            <div className="w-72 border-l border-daw-grid/30">
              <AISidebar />
            </div>
          )}
        </div>

        {showMixer && <MixerPanel />}
      </div>
    </FileDropZone>
  );
}
