import { useState, useEffect, useCallback } from 'react';
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
import WarpPanel from '@/components/WarpPanel';
import BrowserPanel from '@/components/browser/BrowserPanel';
import ClipView from '@/components/ClipView';
import InspectorPanel from '@/components/InspectorPanel';
import ExportDialog from '@/components/ExportDialog';
import HistoryPanel from '@/components/HistoryPanel';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { initAudioContext } from '@/services/audio-engine';
import { useSessionStore } from '@/stores/session-store';
import type { BottomPanel } from '@/stores/session-store';
import { isMidiClip, isAudioClip } from '@/types/audio';
import type { MidiClip } from '@/types/audio';

export type { BottomPanel };

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

// Resizable panel height with drag handle
function useResizablePanel(defaultHeight: number, minH: number, maxH: number) {
  const [height, setHeight] = useState(defaultHeight);

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startY = 'touches' in e ? e.touches[0]!.clientY : e.clientY;
    const startH = height;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in ev ? ev.touches[0]!.clientY : (ev as MouseEvent).clientY;
      const delta = startY - clientY;
      setHeight(Math.max(minH, Math.min(maxH, startH + delta)));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  }, [height, minH, maxH]);

  return { height, onDragStart };
}

export default function App() {
  useKeyboardShortcuts();
  const { isMobile, height: screenH } = useScreenSize();

  // iOS WebKit requires AudioContext to be started during a direct user gesture.
  // Eagerly init on first tap/click so file loading and track creation work reliably.
  // Listen on click, pointerdown, AND touchstart — iOS Chrome can be inconsistent.
  useEffect(() => {
    const startAudio = () => {
      initAudioContext();
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('touchstart', startAudio);
      window.removeEventListener('click', startAudio);
    };
    window.addEventListener('pointerdown', startAudio, { once: true });
    window.addEventListener('touchstart', startAudio, { once: true });
    window.addEventListener('click', startAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', startAudio);
      window.removeEventListener('touchstart', startAudio);
      window.removeEventListener('click', startAudio);
    };
  }, []);

  const minPanelH = isMobile ? 100 : 140;
  const maxPanelH = Math.floor(screenH * 0.5);
  const defaultPanelH = isMobile
    ? Math.min(Math.max(140, Math.floor(screenH * 0.25)), 220)
    : 200;

  const { height: panelH, onDragStart } = useResizablePanel(defaultPanelH, minPanelH, maxPanelH);

  const zones = useSessionStore((s) => s.zones);
  const setLowerZonePanel = useSessionStore((s) => s.setLowerZonePanel);
  const toggleZone = useSessionStore((s) => s.toggleZone);

  const bottomPanel = zones.lowerZonePanel;
  const showAI = zones.rightZone;
  const showTracks = zones.leftZone;

  const [showExport, setShowExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pianoRollClip, setPianoRollClip] = useState<{
    trackId: string;
    clip: MidiClip;
  } | null>(null);

  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);

  // Listen for panel-open requests from child components (e.g. TrackHeader W badge)
  useEffect(() => {
    const handler = (e: Event) => {
      const panel = (e as CustomEvent).detail as BottomPanel;
      if (panel) setLowerZonePanel(panel);
    };
    window.addEventListener('daw:open-panel', handler);
    return () => window.removeEventListener('daw:open-panel', handler);
  }, []);

  const togglePanel = (panel: BottomPanel) => {
    setLowerZonePanel(bottomPanel === panel ? null : panel);
  };

  const openPianoRoll = () => {
    if (!selectedTrackId) return;
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;
    const midiClip = track.clips.find(isMidiClip);
    if (midiClip) {
      setPianoRollClip({ trackId: selectedTrackId, clip: midiClip });
      setLowerZonePanel('piano-roll');
    }
  };

  const renderBottomPanel = () => {
    if (!bottomPanel) return null;

    let content: React.ReactNode = null;

    switch (bottomPanel) {
      case 'mixer':
        content = <MixerPanel />;
        break;
      case 'instrument':
        content = <InstrumentRack />;
        break;
      case 'effects':
        if (!selectedTrackId) {
          content = (
            <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
              Select a track to edit effects
            </div>
          );
        } else {
          content = (
            <EffectsRack
              trackId={selectedTrackId}
              trackName={tracks.find((t) => t.id === selectedTrackId)?.name ?? ''}
            />
          );
        }
        break;
      case 'routing':
        content = <RoutingPanel selectedTrackId={selectedTrackId} />;
        break;
      case 'warp': {
        const warpTrack = selectedTrackId
          ? tracks.find((t) => t.id === selectedTrackId)
          : null;
        const warpClip = warpTrack?.clips.find(isAudioClip);
        if (!warpTrack || !warpClip) {
          content = (
            <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
              Select an audio track to warp
            </div>
          );
        } else {
          content = (
            <WarpPanel
              clipId={warpClip.id}
              trackId={warpTrack.id}
              buffer={warpClip.buffer}
            />
          );
        }
        break;
      }
      case 'browser':
        content = <BrowserPanel />;
        break;
      case 'piano-roll':
        if (!pianoRollClip) return null;
        content = (
          <PianoRoll
            trackId={pianoRollClip.trackId}
            clip={pianoRollClip.clip}
            onClose={() => {
              setPianoRollClip(null);
              setLowerZonePanel('mixer');
            }}
          />
        );
        break;
      case 'clip-view':
        content = (
          <ClipView
            onClose={() => setLowerZonePanel('mixer')}
          />
        );
        break;
    }

    return (
      <div
        className="bg-daw-surface shrink-0 flex flex-col"
        style={{ height: panelH, borderTop: '3px solid #1a1a1c' }}
      >
        {/* Drag handle to resize */}
        <div
          className="h-2 cursor-ns-resize flex items-center justify-center
                     shrink-0 hover:bg-daw-accent/10 transition-colors group"
          style={{ background: 'linear-gradient(to bottom, #141416, #0F0F11)' }}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <div className="w-12 h-0.5 bg-daw-border/50 group-hover:bg-daw-accent/50
                          transition-colors" />
        </div>
        {/* Panel content — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {content}
        </div>
      </div>
    );
  };

  return (
    <FileDropZone>
      <div className="daw-grain h-screen h-[100dvh] flex flex-col bg-daw-bg overflow-hidden">
        <TransportBar
          activePanel={bottomPanel}
          onTogglePanel={togglePanel}
          showAI={showAI}
          onToggleAI={() => toggleZone('rightZone')}
          showTracks={showTracks}
          onToggleTracks={() => toggleZone('leftZone')}
          onExport={() => setShowExport(true)}
          onHistory={() => setShowHistory((v) => !v)}
          onPianoRoll={openPianoRoll}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ── Left Zone: Track List + Inspector ── */}
          {showTracks && (
            <>
              <div className="flex flex-col shrink-0 w-40 md:w-52 bg-daw-surface">
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <TrackList />
                </div>
                {!isMobile && (
                  <div className="h-44 shrink-0 overflow-y-auto bg-daw-surface"
                    style={{ borderTop: '2px solid #1a1a1c' }}>
                    <InspectorPanel />
                  </div>
                )}
              </div>
              <div className="daw-zone-border shrink-0" />
            </>
          )}

          {/* ── Center Zone: Timeline ── */}
          <div className="flex-1 min-w-0">
            <Timeline />
          </div>

          {/* ── Right Zone: AI Coproducer + Inspector/Media Bay ── */}
          {showAI && (
            <>
              <div className="daw-zone-border shrink-0" />
              <div className={`shrink-0 flex flex-col
                              ${isMobile
              ? 'absolute right-0 top-[84px] bottom-0 w-72 z-30 bg-daw-ai-bg shadow-xl'
              : 'w-64 bg-daw-ai-bg'}`}
              >
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <AISidebar />
                </div>
              </div>
            </>
          )}
        </div>

        {renderBottomPanel()}

        <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
        <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
      </div>
    </FileDropZone>
  );
}
