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
      <div className="h-screen flex flex-col bg-daw-bg">
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
            <div className="w-60 border-l border-daw-border/30 shrink-0">
              <AISidebar />
            </div>
          )}
        </div>

        {showMixer && <MixerPanel />}
      </div>
    </FileDropZone>
  );
}
