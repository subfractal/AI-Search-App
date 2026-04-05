import { useState, useCallback } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useMidiEffectsStore } from '@/stores/midi-effects-store';
import PianoRoll from '@/components/PianoRoll';
import WarpPanel from '@/components/WarpPanel';
import { isMidiClip, isAudioClip } from '@/types/audio';
import type { Clip, MidiClip, AudioClip } from '@/types/audio';
import type { MidiEffectType } from '@/types/midi-effects';
import { MIDI_EFFECT_LABELS } from '@/types/midi-effects';
import {
  applyArpeggiator,
  applyChord,
  applyScale,
  applyTransposer,
  applyVelocityProcessor,
  applyNoteRepeat,
  applyHumanize,
  applyMidiDelay,
} from '@/services/midi-effects-service';
import type { MidiNote } from '@/types/audio';
import type { MidiEffectParams, ArpeggiatorParams, ChordParams, ScaleParams, TransposerParams, VelocityParams, NoteRepeatParams, HumanizeParams, MidiDelayParams } from '@/types/midi-effects';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2);
  return `${m}:${s.padStart(5, '0')}`;
}

function applyMidiEffect(notes: MidiNote[], type: MidiEffectType, params: MidiEffectParams): MidiNote[] {
  switch (type) {
    case 'arpeggiator': return applyArpeggiator(notes, params as ArpeggiatorParams);
    case 'chord': return applyChord(notes, params as ChordParams);
    case 'scale': return applyScale(notes, params as ScaleParams);
    case 'transposer': return applyTransposer(notes, params as TransposerParams);
    case 'velocity': return applyVelocityProcessor(notes, params as VelocityParams);
    case 'noteRepeat': return applyNoteRepeat(notes, params as NoteRepeatParams);
    case 'humanize': return applyHumanize(notes, params as HumanizeParams);
    case 'midiDelay': return applyMidiDelay(notes, params as MidiDelayParams);
  }
}

interface ClipPropertiesProps {
  clip: Clip;
  trackId: string;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  onLoopToggle: () => void;
  onLoopStartChange: (v: number) => void;
  onLoopEndChange: (v: number) => void;
}

function ClipProperties({
  clip,
  trackId,
  loopEnabled,
  loopStart,
  loopEnd,
  onLoopToggle,
  onLoopStartChange,
  onLoopEndChange,
}: ClipPropertiesProps) {
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const tracks = useSessionStore((s) => s.tracks);
  const track = tracks.find((t) => t.id === trackId);

  const [name, setName] = useState(clip.name);

  const handleNameBlur = useCallback(() => {
    if (!track) return;
    const updatedClips = track.clips.map((c) =>
      c.id === clip.id ? { ...c, name } : c,
    );
    updateTrack(trackId, { clips: updatedClips });
  }, [clip.id, name, track, trackId, updateTrack]);

  const midi = isMidiClip(clip);

  return (
    <div className="w-44 shrink-0 border-r border-daw-border/30 p-2 space-y-2 overflow-y-auto">
      <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#E63946]/90">
        CLIP
      </div>

      {/* Name */}
      <div>
        <label className="text-[7px] font-mono text-daw-text-muted/50 uppercase">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
          className="w-full bg-daw-surface-light/10 border border-daw-border/30 text-[10px] text-daw-text font-mono px-1.5 py-0.5 mt-0.5"
        />
      </div>

      {/* Region */}
      <div>
        <label className="text-[7px] font-mono text-daw-text-muted/50 uppercase">Region</label>
        <div className="text-[9px] font-mono text-daw-text-muted mt-0.5 space-y-0.5">
          <div className="flex justify-between">
            <span>Start</span>
            <span>{formatTime(clip.startTime)}</span>
          </div>
          <div className="flex justify-between">
            <span>Duration</span>
            <span>{formatTime(clip.duration)}</span>
          </div>
          <div className="flex justify-between">
            <span>End</span>
            <span>{formatTime(clip.startTime + clip.duration)}</span>
          </div>
        </div>
      </div>

      {/* Loop */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[7px] font-mono text-daw-text-muted/50 uppercase">Loop</label>
          <button
            onClick={onLoopToggle}
            className={`text-[8px] font-mono px-1.5 py-0.5 border ${
              loopEnabled
                ? 'bg-[#E63946]/20 text-[#E63946] border-[#E63946]/40'
                : 'text-daw-text-muted/40 border-daw-border/30'
            }`}
          >
            {loopEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {loopEnabled && (
          <div className="text-[9px] font-mono text-daw-text-muted mt-1 space-y-1">
            <div className="flex items-center justify-between">
              <span>Start</span>
              <input
                type="number"
                value={loopStart.toFixed(2)}
                onChange={(e) => onLoopStartChange(parseFloat(e.target.value) || 0)}
                className="w-14 bg-daw-surface-light/10 border border-daw-border/30 text-[9px] px-1 py-0 text-right"
                step={0.1}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>End</span>
              <input
                type="number"
                value={loopEnd.toFixed(2)}
                onChange={(e) => onLoopEndChange(parseFloat(e.target.value) || clip.duration)}
                className="w-14 bg-daw-surface-light/10 border border-daw-border/30 text-[9px] px-1 py-0 text-right"
                step={0.1}
              />
            </div>
          </div>
        )}
      </div>

      {/* Type info */}
      <div>
        <label className="text-[7px] font-mono text-daw-text-muted/50 uppercase">Type</label>
        <div className="text-[9px] font-mono text-daw-text-muted mt-0.5">
          {midi ? `MIDI — ${(clip as MidiClip).notes.length} notes` : 'Audio'}
        </div>
      </div>

      {/* MIDI tools */}
      {midi && <MidiToolsSection trackId={trackId} clip={clip as MidiClip} />}
    </div>
  );
}

function MidiToolsSection({ trackId, clip }: { trackId: string; clip: MidiClip }) {
  const midiEffects = useMidiEffectsStore((s) => s.trackMidiEffects[trackId] ?? []);
  const addMidiEffect = useMidiEffectsStore((s) => s.addMidiEffect);
  const removeMidiEffect = useMidiEffectsStore((s) => s.removeMidiEffect);
  const toggleMidiEffect = useMidiEffectsStore((s) => s.toggleMidiEffect);
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const tracks = useSessionStore((s) => s.tracks);

  const handleApply = useCallback(() => {
    let notes = [...clip.notes];
    for (const fx of midiEffects) {
      if (!fx.enabled) continue;
      notes = applyMidiEffect(notes, fx.type, fx.params);
    }
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const updatedClips = track.clips.map((c) =>
      c.id === clip.id ? { ...c, notes } : c,
    );
    updateTrack(trackId, { clips: updatedClips });
  }, [clip, midiEffects, trackId, tracks, updateTrack]);

  const midiTypes: MidiEffectType[] = [
    'arpeggiator', 'chord', 'scale', 'transposer',
    'velocity', 'noteRepeat', 'humanize', 'midiDelay',
  ];

  return (
    <div>
      <label className="text-[7px] font-mono text-daw-text-muted/50 uppercase">MIDI Tools</label>
      <select
        onChange={(e) => {
          if (e.target.value) addMidiEffect(trackId, e.target.value as MidiEffectType);
          e.target.value = '';
        }}
        className="w-full bg-daw-surface-light/10 border border-daw-border/30 text-[9px] text-daw-text font-mono px-1 py-0.5 mt-0.5"
        defaultValue=""
      >
        <option value="" disabled>Add MIDI Effect...</option>
        {midiTypes.map((t) => (
          <option key={t} value={t}>{MIDI_EFFECT_LABELS[t]}</option>
        ))}
      </select>

      {midiEffects.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {midiEffects.map((fx) => (
            <div key={fx.id} className="flex items-center gap-1 text-[8px] font-mono">
              <button
                onClick={() => toggleMidiEffect(trackId, fx.id)}
                className={`w-2.5 h-2.5 rounded-sm border flex-shrink-0 ${
                  fx.enabled ? 'bg-[#E63946] border-[#E63946]/60' : 'border-daw-border'
                }`}
              />
              <span className={`flex-1 truncate ${fx.enabled ? 'text-daw-text' : 'text-daw-text-muted/40'}`}>
                {MIDI_EFFECT_LABELS[fx.type]}
              </span>
              <button
                onClick={() => removeMidiEffect(trackId, fx.id)}
                className="text-daw-text-muted/30 hover:text-[#E63946]"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={handleApply}
            className="w-full text-[8px] font-mono py-0.5 mt-1 bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30 hover:bg-[#E63946]/25"
          >
            Apply to Clip
          </button>
        </div>
      )}
    </div>
  );
}

interface ClipViewProps {
  onClose: () => void;
}

export default function ClipView({ onClose }: ClipViewProps) {
  const selectedTrackId = useSessionStore((s) => s.selectedTrackId);
  const tracks = useSessionStore((s) => s.tracks);
  const selectedClips = useSessionStore((s) => s.selectedClips);

  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(4);

  // Find the active clip
  let activeClip: Clip | null = null;
  let activeTrackId = selectedTrackId;

  if (selectedClips.length > 0) {
    const sel = selectedClips[0]!;
    const track = tracks.find((t) => t.id === sel.trackId);
    activeClip = track?.clips.find((c) => c.id === sel.clipId) ?? null;
    activeTrackId = sel.trackId;
  } else if (selectedTrackId) {
    const track = tracks.find((t) => t.id === selectedTrackId);
    if (track && track.clips.length > 0) {
      activeClip = track.clips[0]!;
    }
  }

  if (!activeClip || !activeTrackId) {
    return (
      <div className="h-full flex items-center justify-center text-xxs text-daw-text-muted">
        Select a clip to edit
      </div>
    );
  }

  const midi = isMidiClip(activeClip);
  const audio = isAudioClip(activeClip);

  return (
    <div className="flex h-full">
      {/* Properties sidebar */}
      <ClipProperties
        clip={activeClip}
        trackId={activeTrackId}
        loopEnabled={loopEnabled}
        loopStart={loopStart}
        loopEnd={loopEnd}
        onLoopToggle={() => setLoopEnabled(!loopEnabled)}
        onLoopStartChange={setLoopStart}
        onLoopEndChange={setLoopEnd}
      />

      {/* Main editor */}
      <div className="flex-1 min-w-0">
        {midi && (
          <PianoRoll
            trackId={activeTrackId}
            clip={activeClip as MidiClip}
            onClose={onClose}
          />
        )}
        {audio && (
          <WarpPanel
            clipId={activeClip.id}
            trackId={activeTrackId}
            buffer={(activeClip as AudioClip).buffer}
          />
        )}
      </div>
    </div>
  );
}
