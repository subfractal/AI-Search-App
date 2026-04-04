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
import RoutingPanel from '@/components/RoutingPanel';
import ExportDialog from '@/components/ExportDialog';
import HistoryPanel from '@/components/HistoryPanel';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useSessionStore } from '@/stores/session-store';
import { isMidiClip } from '@/types/audio';
import type { MidiClip } from '@/types/audio';

export type BottomPanel = 'mixer' | 'instrument' | 'effects' | 'piano-roll' | 'routing' | null;

function useScreenSize() {
  const [size, setSize] = useState({
    isMobile: window.innerWidth < 768,
    height: window.innerHeight,
    width: window.innerWidth,
  });
  useEffect(() => {
    const handler = () => setSize({
      isMobile: window.innerWidth < 768,
      height: window.innerHeight,
      width: window.innerWidth,
    });
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);
  return size;
}

export default function App() {
  useKeyboardShortcuts();
  const { isMobile, height: screenH } = useScreenSize();
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

  // Dynamic panel height: 35% of screen on mobile, fixed on desktop
  const panelHeight = isMobile
    ? Math.min(Math.max(160, Math.floor(screenH * 0.35)), 280)
    : undefined; // use CSS classes on desktop

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

  const panelStyle = isMobile && panelHeight
    ? { height: panelHeight } : undefined;
  const panelClass = `bg-daw-surface border-t border-daw-border/40 shrink-0
                      overflow-auto ${!isMobile ? 'h-52' : ''}`;

  return (
    <FileDropZone>
      <div className="h-screen h-[100dvh] flex flex-col bg-daw-bg overflow-hidden">
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

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {showTracks && <TrackList />}

          <div className="flex-1 min-w-0">
            <Timeline />
          </div>

          {showAI && (
            <div className={`border-l border-daw-border/30 shrink-0 overflow-y-auto
                            ${isMobile
                ? 'absolute right-0 top-[68px] bottom-0 w-64 z-30 bg-daw-ai-bg shadow-xl'
                : 'w-60'}`}
            >
              <AISidebar />
            </div>
          )}
        </div>

        {/* Bottom panels — dynamic height on mobile */}
        {bottomPanel === 'mixer' && (
          <div style={panelStyle}>
            <MixerPanel />
          </div>
        )}
        {bottomPanel === 'instrument' && (
          <div className={panelClass} style={panelStyle}>
            <InstrumentRack />
          </div>
        )}
        {bottomPanel === 'effects' && selectedTrackId && (
          <div className={panelClass} style={panelStyle}>
            <EffectsRack
              trackId={selectedTrackId}
              trackName={tracks.find((t) => t.id === selectedTrackId)?.name ?? ''}
            />
          </div>
        )}
        {bottomPanel === 'routing' && (
          <div className={panelClass} style={panelStyle}>
            <RoutingPanel selectedTrackId={selectedTrackId} />
          </div>
        )}
        {bottomPanel === 'piano-roll' && pianoRollClip && (
          <div
            className="bg-daw-surface border-t border-daw-border/40 shrink-0 overflow-hidden"
            style={isMobile ? { height: Math.min(300, Math.floor(screenH * 0.4)) } : { height: 288 }}
          >
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

        <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
        <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
      </div>
    </FileDropZone>
  );
}
