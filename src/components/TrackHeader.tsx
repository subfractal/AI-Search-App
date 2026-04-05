import { useState, useEffect } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useKeyStore } from '@/stores/key-store';
import { useWarpStore } from '@/stores/warp-store';
import { useInstrumentStore } from '@/stores/instrument-store';
import { isAudioClip, TRACK_COLORS } from '@/types/audio';
import { bounceSession } from '@/services/export-service';
import { toast } from '@/stores/toast-store';

interface TrackHeaderProps {
  trackId: string;
}

export default function TrackHeader({ trackId }: TrackHeaderProps) {
  const track = useSessionStore(
    (s) => s.tracks.find((t) => t.id === trackId),
  );
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const selectTrack = useSessionStore((s) => s.selectTrack);
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const removeTrack = useSessionStore((s) => s.removeTrack);
  const setTrackSequencer = useSessionStore((s) => s.setTrackSequencer);
  const toggleFolderCollapse = useSessionStore((s) => s.toggleFolderCollapse);
  const toggleMute = useMixerStore((s) => s.toggleMute);
  const toggleSolo = useMixerStore((s) => s.toggleSolo);

  // Key detection for audio clips
  const firstAudioClip = track?.clips.find(isAudioClip);
  const keyResult = useKeyStore((s) =>
    firstAudioClip ? s.keys[firstAudioClip.id] : undefined,
  );
  const detectKey = useKeyStore((s) => s.detectKey);

  // Warp status
  const warpConfig = useWarpStore((s) => {
    if (!firstAudioClip) return undefined;
    return s.configs[firstAudioClip.id];
  });

  // Instrument name for MIDI tracks
  const instrument = useInstrumentStore((s) =>
    track?.type === 'midi' ? s.instruments[trackId] : undefined,
  );

  const [showColorPicker, setShowColorPicker] = useState(false);

  // Auto-detect key when audio clip exists — deferred to useEffect to avoid blocking render
  useEffect(() => {
    if (firstAudioClip && !keyResult) {
      detectKey(firstAudioClip.id, firstAudioClip.buffer);
    }
  }, [firstAudioClip, keyResult, detectKey]);

  if (!track) return null;

  const isSelected = selectedTrackId === trackId;

  return (
    <div
      role="listitem"
      aria-label={`Track ${track.name}, ${track.type}${isSelected ? ', selected' : ''}`}
      className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors min-h-[72px]
                  ${isSelected
      ? 'bg-daw-track-selected'
      : 'bg-daw-track hover:bg-daw-surface-alt'}`}
      style={{ borderBottom: '2px solid #111113' }}
      onClick={() => selectTrack(trackId)}
    >
      {/* Color bar — click to pick color */}
      <div className="relative shrink-0 self-stretch flex items-center">
        <div
          className="w-1 self-stretch cursor-pointer hover:w-1.5 transition-all"
          style={{ backgroundColor: track.color }}
          onClick={(e) => {
            e.stopPropagation();
            setShowColorPicker((v) => !v);
          }}
          title="Change track color"
        />
        {showColorPicker && (
          <div
            className="absolute top-0 left-3 z-30 bg-daw-panel border border-daw-border/40
                       p-1.5 grid grid-cols-4 gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {TRACK_COLORS.map((c) => (
              <button
                key={c}
                className={`w-4 h-4 border transition-all
                           ${c === track.color
                ? 'border-white scale-110'
                : 'border-transparent hover:border-white/40'}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  updateTrack(trackId, { color: c });
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        {/* Track number + name */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-mono uppercase text-daw-text-muted/50 shrink-0" style={{ letterSpacing: '1px' }}>
            {(() => {
              const trackIndex = useSessionStore.getState().tracks.findIndex((t) => t.id === trackId);
              const typePrefix = track.type === 'audio' ? 'AUD'
                : track.type === 'folder' ? 'FLD'
                : track.type === 'group' ? 'GRP'
                : track.type === 'return' ? 'RTN'
                : 'SEQ';
              const catalogId = `${typePrefix}-${String(trackIndex + 1).padStart(2, '0')}`;
              return catalogId;
            })()}
          </span>
          <input
            className="bg-transparent text-[11px] font-semibold w-full truncate
                       text-daw-text focus:outline-none focus:bg-daw-bg/60
                       px-1 -ml-0.5 leading-tight"
            value={track.name}
            onChange={(e) => updateTrack(trackId, { name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex items-center gap-1 mt-1 flex-wrap ml-5">
          {/* Type badge — color coded by track type */}
          {/* Folder collapse toggle */}
          {track.type === 'folder' && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleFolderCollapse(trackId); }}
              className="text-[9px] font-mono text-daw-text-muted hover:text-daw-text px-0.5"
              title={track.folderConfig?.collapsed ? 'Expand folder' : 'Collapse folder'}
            >
              {track.folderConfig?.collapsed ? '▶' : '▼'}
            </button>
          )}
          <span
            className={`text-[9px] uppercase tracking-wide px-1.5 py-px border leading-none font-medium
                       ${track.type === 'audio' ? 'daw-type-audio'
                         : track.type === 'folder' ? 'text-amber-400/80 border-amber-400/30 bg-amber-400/10'
                         : track.type === 'group' ? 'text-emerald-400/80 border-emerald-400/30 bg-emerald-400/10'
                         : track.type === 'return' ? 'text-purple-400/80 border-purple-400/30 bg-purple-400/10'
                         : 'daw-type-midi'}
                       ${track.name.startsWith('AI ') ? 'daw-type-ai' : ''}`}
          >
            {track.type === 'audio' ? 'AUD'
              : track.type === 'folder' ? 'FLD'
              : track.type === 'group' ? 'GRP'
              : track.type === 'return' ? 'RTN'
              : 'MID'}
          </span>

          {/* Instrument badge for MIDI */}
          {instrument && (
            <span className="text-xxs px-1 py-px bg-daw-accent/10
                           text-daw-accent leading-none">
              {instrument.name}
            </span>
          )}

          {/* Key badge for audio */}
          {keyResult && (
            <span
              className="text-xxs px-1 py-px leading-none font-medium"
              style={{
                backgroundColor: 'rgba(209, 209, 209, 0.08)',
                color: '#D1D1D1',
              }}
              title={`${keyResult.fullName} (${keyResult.camelotCode})`}
            >
              {keyResult.key}{keyResult.scale === 'minor' ? 'm' : ''}
            </span>
          )}

          {/* Warp indicator — click to open warp panel */}
          {warpConfig?.enabled && (
            <button
              className="text-xxs px-1 py-px bg-amber-500/15
                         text-amber-400 leading-none hover:bg-amber-500/25 transition-colors"
              title={`Warped from ${warpConfig.originalBpm.toFixed(0)} BPM — click to open warp panel`}
              onClick={(e) => {
                e.stopPropagation();
                selectTrack(trackId);
                window.dispatchEvent(new CustomEvent('daw:open-panel', { detail: 'warp' }));
              }}
            >
              W
            </button>
          )}

          {/* Freeze badge */}
          {(track.type === 'audio' || track.type === 'midi') && (
            <button
              className={`text-[8px] uppercase tracking-wide px-1 py-px border leading-none font-mono
                         ${track.frozen
                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                : 'bg-daw-bg/40 text-daw-text-muted/50 border-daw-border/20 hover:text-cyan-400/60'}`}
              title={track.frozen ? 'Unfreeze track' : 'Freeze track (render effects to audio)'}
              aria-label={track.frozen ? `Unfreeze ${track.name}` : `Freeze ${track.name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (track.frozen) {
                  useSessionStore.getState().unfreezeTrack(trackId);
                  toast.info(`Unfroze "${track.name}"`);
                } else {
                  const maxDuration = Math.max(
                    ...track.clips.map((c) => c.startTime + c.duration),
                    1,
                  );
                  toast.info(`Freezing "${track.name}"...`);
                  bounceSession([track], maxDuration).then((buffer) => {
                    useSessionStore.getState().freezeTrack(trackId, buffer);
                    toast.success(`Froze "${track.name}" — effects rendered to audio`);
                  }).catch(() => {
                    toast.error(`Failed to freeze "${track.name}"`);
                  });
                }
              }}
            >
              {track.frozen ? 'FRZ' : 'frz'}
            </button>
          )}

          {/* Sequencer mode badge */}
          {(track.type === 'audio' || track.type === 'midi') && (
            <button
              className={`text-[8px] uppercase tracking-wide px-1 py-px border leading-none font-mono
                         ${track.sequencer?.activeSequencer === 'launcher'
              ? 'bg-green-500/15 text-green-400 border-green-500/30'
              : 'bg-daw-bg/40 text-daw-text-muted/50 border-daw-border/20 hover:text-daw-text-dim'}`}
              title={`Sequencer: ${track.sequencer?.activeSequencer ?? 'arrangement'} — click to toggle`}
              onClick={(e) => {
                e.stopPropagation();
                const current = track.sequencer?.activeSequencer ?? 'arrangement';
                setTrackSequencer(trackId, current === 'arrangement' ? 'launcher' : 'arrangement');
              }}
            >
              {track.sequencer?.activeSequencer === 'launcher' ? 'LAUNCH' : 'ARR'}
            </button>
          )}
        </div>
      </div>

      {/* Controls — vertical layout like Logic Pro */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <div className="flex items-center gap-0.5">
          <button
            aria-label={`Mute ${track.name}`}
            aria-pressed={track.mute}
            className={`w-7 h-6 text-[9px] font-bold font-mono transition-all
                       flex items-center justify-center
                       ${track.mute
      ? 'bg-[#F77F00]/90 text-black'
      : 'daw-hw-btn text-daw-text-muted/60 hover:text-daw-text-dim'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleMute(trackId);
              updateTrack(trackId, { mute: !track.mute });
            }}
          >
            M
          </button>
          <button
            aria-label={`Solo ${track.name}`}
            aria-pressed={track.solo}
            className={`w-7 h-6 text-[9px] font-bold font-mono transition-all
                       flex items-center justify-center
                       ${track.solo
      ? 'bg-[#E63946]/90 text-white'
      : 'daw-hw-btn text-daw-text-muted/60 hover:text-daw-text-dim'}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleSolo(trackId);
              updateTrack(trackId, { solo: !track.solo });
            }}
          >
            S
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          {/* Record arm */}
          <button
            aria-label={`Record arm ${track.name}`}
            aria-pressed={track.armed}
            className={`w-6 h-6 text-[9px] font-bold transition-all
                       flex items-center justify-center
                       ${track.armed
      ? 'bg-[#E63946]/90 text-white'
      : 'bg-daw-bg/60 text-daw-text-muted/40 hover:text-[#E63946]/60'}`}
            onClick={(e) => {
              e.stopPropagation();
              updateTrack(trackId, { armed: !track.armed });
            }}
            title="Record Arm"
          >
            R
          </button>
          {/* Delete */}
          <button
            aria-label={`Delete ${track.name}`}
            className="w-6 h-6 text-xxs bg-daw-bg/60
                       text-daw-text-muted/40 hover:text-red-400
                       transition-all flex items-center justify-center
                       opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              removeTrack(trackId);
            }}
            title="Delete track"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="7" y2="7" />
              <line x1="7" y1="1" x2="1" y2="7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
