/**
 * Co-Composer Panel — UI for harmonic analysis, style transfer,
 * reharmonization, and phrasing assistant.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useTransportStore } from '@/stores/transport-store';
import { analyzeHarmonicTopography } from '@/services/ai/harmonic-analyzer';
import { reharmonize, getAvailableStyles } from '@/services/ai/style-transfer';
import { analyzePhrasing, humanizeTiming } from '@/services/ai/phrasing-assistant';
import { isMidiClip } from '@/types/audio';
import { toast } from '@/stores/toast-store';
import type { HarmonicTopography, ReharmonizationStyle } from '@/types/harmony';

export default function CoComposerPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const bpm = useTransportStore((s) => s.bpm);
  const [topography, setTopography] = useState<HarmonicTopography | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ReharmonizationStyle>('neo-soul');
  const [humanizeAmount, setHumanizeAmount] = useState(0.3);

  const styles = getAvailableStyles();

  const handleAnalyze = () => {
    const result = analyzeHarmonicTopography(tracks, bpm);
    setTopography(result);
    toast.success(`Detected key: ${result.key} ${result.scale}, ${result.chordProgression.length} chords`);
  };

  const handleReharmonize = () => {
    if (!selectedTrackId) {
      toast.warning('Select a track with MIDI clips');
      return;
    }
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    const midiClip = track.clips.find(isMidiClip);
    if (!midiClip) {
      toast.warning('Selected track has no MIDI clips');
      return;
    }

    const reharmonized = reharmonize(midiClip, selectedStyle);
    const session = useSessionStore.getState();
    session.removeClip(selectedTrackId, midiClip.id);
    session.addClipToTrack(selectedTrackId, reharmonized);
    toast.success(`Reharmonized in ${selectedStyle} style (+${reharmonized.notes.length - midiClip.notes.length} notes)`);
  };

  const handleHumanize = () => {
    if (!selectedTrackId) {
      toast.warning('Select a track with MIDI clips');
      return;
    }
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    const midiClip = track.clips.find(isMidiClip);
    if (!midiClip) {
      toast.warning('Selected track has no MIDI clips');
      return;
    }

    const humanized = humanizeTiming(midiClip.notes, humanizeAmount);
    const humanizedClip = { ...midiClip, notes: humanized };
    const session = useSessionStore.getState();
    session.removeClip(selectedTrackId, midiClip.id);
    session.addClipToTrack(selectedTrackId, humanizedClip);
    toast.success(`Humanized ${humanized.length} notes (amount: ${Math.round(humanizeAmount * 100)}%)`);
  };

  const handleAnalyzePhrasing = () => {
    if (!selectedTrackId) return;
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;
    const midiClip = track.clips.find(isMidiClip);
    if (!midiClip) {
      toast.warning('No MIDI clip found');
      return;
    }
    const analysis = analyzePhrasing(midiClip);
    toast.info(`${analysis.phrases.length} phrases detected, density: ${analysis.overallDensity}`);
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-daw-text">Co-Composer</h3>
        <button
          onClick={handleAnalyze}
          className="px-2 py-1 text-xxs font-mono bg-daw-accent/20
                     border border-daw-accent/30 text-daw-accent
                     hover:bg-daw-accent/30"
        >
          Analyze Harmony
        </button>
      </div>

      {/* Harmonic topography display */}
      {topography && (
        <div className="space-y-2">
          <div className="flex gap-3 text-xxs font-mono">
            <span className="text-daw-text-muted">Key:</span>
            <span className="text-daw-accent font-bold">
              {topography.key} {topography.scale}
            </span>
            <span className="text-daw-text-muted">Consistency:</span>
            <span className="text-daw-text">
              {Math.round(topography.scaleConsistency * 100)}%
            </span>
          </div>

          {/* Chord progression */}
          {topography.chordProgression.length > 0 && (
            <div className="space-y-1">
              <span className="text-xxs font-mono text-daw-text-muted">Chords:</span>
              <div className="flex flex-wrap gap-1">
                {topography.chordProgression.map((chord, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-daw-accent/10 border border-daw-accent/20
                               text-xxs font-mono text-daw-text"
                    title={`Beat ${chord.startBeat}-${chord.endBeat}`}
                  >
                    {chord.root}{chord.quality === 'major' ? '' : chord.quality}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tension curve (simple text visualization) */}
          {topography.tensionCurve.length > 0 && (
            <div className="space-y-1">
              <span className="text-xxs font-mono text-daw-text-muted">Tension:</span>
              <div className="flex items-end gap-px h-8">
                {topography.tensionCurve.map((t, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-daw-accent/60"
                    style={{ height: `${Math.max(2, t * 100)}%` }}
                    title={`${Math.round(t * 100)}%`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Suggested next chords */}
          <div className="space-y-1">
            <span className="text-xxs font-mono text-daw-text-muted">Suggested next:</span>
            <div className="flex gap-1">
              {topography.suggestedNextChords.map((chord, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-white/5 border border-white/10
                             text-xxs font-mono text-daw-text-muted"
                >
                  {chord}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reharmonization */}
      <div className="space-y-2 border-t border-white/5 pt-2">
        <h4 className="text-xxs font-mono text-daw-text-muted">Style Transfer</h4>
        <div className="flex gap-2 items-center">
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value as ReharmonizationStyle)}
            className="bg-daw-bg border border-white/10 text-daw-text text-xxs
                       font-mono px-2 py-1 flex-1"
            aria-label="Reharmonization style"
          >
            {styles.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={handleReharmonize}
            className="px-2 py-1 text-xxs font-mono bg-daw-bg
                       border border-white/10 text-daw-text-muted
                       hover:text-daw-text hover:border-daw-accent/40"
          >
            Reharmonize
          </button>
        </div>
      </div>

      {/* Humanization */}
      <div className="space-y-2 border-t border-white/5 pt-2">
        <h4 className="text-xxs font-mono text-daw-text-muted">Phrasing</h4>
        <div className="flex gap-2 items-center">
          <label className="text-xxs font-mono text-daw-text-muted">Humanize:</label>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(humanizeAmount * 100)}
            onChange={(e) => setHumanizeAmount(parseInt(e.target.value, 10) / 100)}
            className="flex-1 h-1 accent-daw-accent"
            aria-label="Humanize amount"
          />
          <span className="text-xxs font-mono text-daw-text-dim w-8 text-right">
            {Math.round(humanizeAmount * 100)}%
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleHumanize}
            className="px-2 py-1 text-xxs font-mono bg-daw-bg
                       border border-white/10 text-daw-text-muted
                       hover:text-daw-text hover:border-daw-accent/40"
          >
            Humanize
          </button>
          <button
            onClick={handleAnalyzePhrasing}
            className="px-2 py-1 text-xxs font-mono bg-daw-bg
                       border border-white/10 text-daw-text-muted
                       hover:text-daw-text hover:border-daw-accent/40"
          >
            Analyze Phrasing
          </button>
        </div>
      </div>
    </div>
  );
}
