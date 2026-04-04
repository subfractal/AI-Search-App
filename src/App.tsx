import { useState, useEffect } from 'react';
import TransportBar from '@/components/TransportBar';
import TrackList from '@/components/TrackList';
import Timeline from '@/components/Timeline';
import MixerPanel from '@/components/MixerPanel';
import AISidebar from '@/components/ai/AISidebar';
import FileDropZone from '@/components/FileDropZone';
import InstrumentRack from '@/components/instruments/InstrumentRack';
import EffectsRack from '@/components/effects/EffectsRack';
import PianoRoll from '@/components/PianoRoll';
import ExportDialog from '@/components/ExportDialog';
import HistoryPanel from '@/components/HistoryPanel';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useSessionStore } from '@/stores/session-store';
import { isMidiClip } from '@/types/audio';
import type { MidiClip } from '@/types/audio';

export type BottomPanel = 'mixer' | 'instrument' | 'effects' | 'piano-roll' | null;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function App() {
  useKeyboardShortcuts();
  const isMobile = useIsMobile();
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('mixer');
  const [showAI, setShowAI] = useState(!isMobile);
  const [showTracks, setShowTracks] = useState(!isMobile);
  const [showExport, setShowExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pianoRollClip, setPianoRollClip] = useState<{
    trackId: string;
    clip: MidiClip;
  } | null>(null);

  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);

  const togglePanel = (panel: BottomPanel) => {
    setBottomPanel((current) => (current === panel ? null : panel));
  };

  const openPianoRoll = () => {
    if (!selectedTrackId) return;
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;
    const midiClip = track.clips.find(isMidiClip);
    if (midiClip) {
      setPianoRollClip({ trackId: selectedTrackId, clip: midiClip });
      setBottomPanel('piano-roll');
    }
  };

  return (
    <FileDropZone>
      <div className="h-screen flex flex-col bg-daw-bg">
        <TransportBar
          activePanel={bottomPanel}
          onTogglePanel={togglePanel}
          showAI={showAI}
          onToggleAI={() => setShowAI((v) => !v)}
          showTracks={showTracks}
          onToggleTracks={() => setShowTracks((v) => !v)}
          onExport={() => setShowExport(true)}
          onHistory={() => setShowHistory((v) => !v)}
          onPianoRoll={openPianoRoll}
        />

        <div className="flex flex-1 min-h-0">
          {/* Track list — collapsible, narrower on mobile */}
          {showTracks && (
            <TrackList />
          )}

          {/* Timeline — always visible, takes remaining space */}
          <div className="flex-1 min-w-0">
            <Timeline />
          </div>

          {/* AI Sidebar — hidden on mobile by default */}
          {showAI && (
            <div className={`border-l border-daw-border/30 shrink-0
                            ${isMobile
                ? 'absolute right-0 top-[68px] bottom-0 w-64 z-30 bg-daw-ai-bg shadow-xl'
                : 'w-60'}`}
            >
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
        {bottomPanel === 'effects' && selectedTrackId && (
          <div className="bg-daw-surface border-t border-daw-border/40 h-56
                          shrink-0 overflow-hidden">
            <EffectsRack
              trackId={selectedTrackId}
              trackName={tracks.find((t) => t.id === selectedTrackId)?.name ?? ''}
            />
          </div>
        )}
        {bottomPanel === 'piano-roll' && pianoRollClip && (
          <div className="bg-daw-surface border-t border-daw-border/40 h-72
                          shrink-0 overflow-hidden">
            <PianoRoll
              trackId={pianoRollClip.trackId}
              clip={pianoRollClip.clip}
              onClose={() => {
                setPianoRollClip(null);
                setBottomPanel('mixer');
              }}
            />
          </div>
        )}

        {/* Modals */}
        <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
        <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
      </div>
    </FileDropZone>
  );
}
