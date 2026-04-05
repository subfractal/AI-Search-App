import { useSessionStore } from '@/stores/session-store';
import { useInstrumentStore } from '@/stores/instrument-store';
import { useMixerStore } from '@/stores/mixer-store';
import type { Track } from '@/types/audio';

function TrackInspector({ track }: { track: Track }) {
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const config = useInstrumentStore((s) => s.instruments[track.id]);
  const strip = useMixerStore((s) => s.strips[track.id]);

  return (
    <div className="flex flex-col gap-2">
      {/* Track name */}
      <div className="space-y-1">
        <label className="text-[8px] uppercase text-daw-text-muted/60 font-mono tracking-wider">
          Name
        </label>
        <input
          type="text"
          value={track.name}
          onChange={(e) => updateTrack(track.id, { name: e.target.value })}
          className="w-full text-xxs bg-daw-bg/50 text-daw-text px-2 py-1
                     border border-daw-border/20 focus:outline-none
                     focus:border-daw-accent/40 font-mono"
        />
      </div>

      {/* Track type */}
      <div className="flex items-center justify-between">
        <span className="text-[8px] uppercase text-daw-text-muted/60 font-mono tracking-wider">
          Type
        </span>
        <span className="text-xxs text-daw-text font-mono uppercase">
          {track.type}
        </span>
      </div>

      {/* Color */}
      <div className="flex items-center justify-between">
        <span className="text-[8px] uppercase text-daw-text-muted/60 font-mono tracking-wider">
          Color
        </span>
        <div className="w-4 h-4 border border-daw-border/30" style={{ backgroundColor: track.color }} />
      </div>

      {/* Instrument info */}
      {config && (
        <div className="border-t border-daw-border/20 pt-2 space-y-1">
          <span className="text-[8px] uppercase text-daw-text-muted/60 font-mono tracking-wider">
            Instrument
          </span>
          <div className="text-xxs text-daw-text font-mono">{config.name}</div>
          {config.family && (
            <div className="text-[8px] text-daw-accent/60 font-mono uppercase">{config.family}</div>
          )}
        </div>
      )}

      {/* Mixer info */}
      {strip && (
        <div className="border-t border-daw-border/20 pt-2 space-y-1">
          <span className="text-[8px] uppercase text-daw-text-muted/60 font-mono tracking-wider">
            Channel
          </span>
          <div className="grid grid-cols-2 gap-1 text-xxs text-daw-text-dim">
            <span className="text-daw-text-muted/60">Vol</span>
            <span className="font-mono tabular-nums text-right">{strip.volume.toFixed(1)} dB</span>
            <span className="text-daw-text-muted/60">Pan</span>
            <span className="font-mono tabular-nums text-right">{strip.pan.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Clip count */}
      <div className="border-t border-daw-border/20 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[8px] uppercase text-daw-text-muted/60 font-mono tracking-wider">
            Clips
          </span>
          <span className="text-xxs text-daw-text font-mono tabular-nums">
            {track.clips.length}
          </span>
        </div>
        {track.clips.length > 0 && (
          <div className="mt-1 space-y-px">
            {track.clips.slice(0, 5).map((clip) => (
              <div key={clip.id} className="text-[9px] text-daw-text-muted truncate px-1 py-0.5 bg-daw-bg/30">
                {clip.name}
              </div>
            ))}
            {track.clips.length > 5 && (
              <div className="text-[8px] text-daw-text-muted/40 px-1">
                +{track.clips.length - 5} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sequencer mode */}
      {track.sequencer && (
        <div className="border-t border-daw-border/20 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase text-daw-text-muted/60 font-mono tracking-wider">
              Sequencer
            </span>
            <span className={`text-xxs font-mono uppercase
                            ${track.sequencer.activeSequencer === 'launcher'
                ? 'text-emerald-400'
                : 'text-daw-text-muted'}`}>
              {track.sequencer.activeSequencer === 'launcher' ? 'LAUNCH' : 'ARR'}
            </span>
          </div>
          {track.sequencer.launcherSlots.length > 0 && (
            <div className="text-[9px] text-daw-text-muted mt-0.5">
              {track.sequencer.launcherSlots.length} launcher slot(s)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InspectorPanel() {
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const tracks = useSessionStore((s) => s.tracks);
  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-2.5 h-7 shrink-0" style={{ borderBottom: '2px solid #1a1a1c' }}>
        <span className="text-[9px] font-mono font-bold uppercase tracking-[3px] text-[#E63946]/90">INSPECTOR</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {selectedTrack ? (
          <TrackInspector track={selectedTrack} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full
                          text-daw-text-muted text-xxs text-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1" className="opacity-30">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span>Select a track to inspect</span>
          </div>
        )}
      </div>
    </div>
  );
}
