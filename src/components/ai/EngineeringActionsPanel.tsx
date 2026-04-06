/**
 * Engineering Actions Panel — displays and resolves audio engineering issues.
 * Includes quick action buttons for common engineering tasks.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useMixerStore } from '@/stores/mixer-store';
import { useHistoryStore } from '@/stores/history-store';
import {
  runEngineeringScan,
  autoFixIssues,
  detectLeadingSilence,
  detectTrailingSilence,
  detectClicks,
} from '@/services/ai/engineering-actions';
import type { EngineeringReport, EngineeringIssue } from '@/services/ai/engineering-actions';
import { isAudioClip } from '@/types/audio';
import type { AudioClip } from '@/types/audio';

/** Capture volume and timing state for undo */
function captureTrackState() {
  const session = useSessionStore.getState();
  const mixer = useMixerStore.getState();
  return session.tracks.map((t) => ({
    id: t.id,
    volume: t.volume,
    clips: t.clips.map((c) => ({
      id: c.id,
      startTime: c.startTime,
      duration: c.duration,
    })),
    stripVolume: mixer.strips[t.id]?.volume ?? 0,
  }));
}

/** Restore track state from a snapshot */
function restoreTrackState(snapshot: ReturnType<typeof captureTrackState>) {
  const session = useSessionStore.getState();
  const mixer = useMixerStore.getState();
  for (const saved of snapshot) {
    session.updateTrack(saved.id, { volume: saved.volume });
    mixer.setVolume(saved.id, saved.stripVolume);
    for (const clip of saved.clips) {
      session.moveClipTime(saved.id, clip.id, clip.startTime);
      session.resizeClipDuration(saved.id, clip.id, clip.duration);
    }
  }
}

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-400/10',
  warning: 'text-yellow-400 bg-yellow-400/10',
  info: 'text-blue-400 bg-blue-400/10',
} as const;

const TYPE_LABELS: Record<EngineeringIssue['type'], string> = {
  'dc-offset': 'DC Offset',
  'silence-head': 'Leading Silence',
  'silence-tail': 'Trailing Silence',
  'click': 'Clicks/Pops',
  'clipping': 'Clipping',
  'low-level': 'Low Level',
};

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-[8px] py-1 px-1.5 font-mono uppercase tracking-wider
                 bg-daw-bg/60 text-daw-text-dim hover:bg-daw-panel hover:text-amber-400
                 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      {label}
    </button>
  );
}

export default function EngineeringActionsPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const [report, setReport] = useState<EngineeringReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleScan = () => {
    if (tracks.length === 0) return;
    setScanning(true);
    try {
      const result = runEngineeringScan();
      setReport(result);
    } finally {
      setScanning(false);
    }
  };

  const handleAutoFix = () => {
    if (!report) return;
    const before = captureTrackState();
    const fixed = autoFixIssues(report);
    if (fixed > 0) {
      const after = captureTrackState();
      useHistoryStore.getState().pushAction(
        `Auto-fix ${fixed} engineering issue(s)`,
        () => restoreTrackState(before),
        () => restoreTrackState(after),
      );
    }
    const newReport = runEngineeringScan();
    setReport(newReport);
    showStatus(`Auto-fixed ${fixed} issue${fixed !== 1 ? 's' : ''}`);
  };

  const handleFixSingle = (issue: EngineeringIssue) => {
    if (issue.fixAction) {
      const before = captureTrackState();
      issue.fixAction();
      const after = captureTrackState();
      useHistoryStore.getState().pushAction(
        `Fix ${issue.type} on "${issue.trackName}"`,
        () => restoreTrackState(before),
        () => restoreTrackState(after),
      );
      const newReport = runEngineeringScan();
      setReport(newReport);
    }
  };

  const handleTrimSilence = () => {
    const before = captureTrackState();
    const session = useSessionStore.getState();
    let trimmedCount = 0;

    for (const track of session.tracks) {
      if (track.mute) continue;
      const audioClip = track.clips.find(isAudioClip) as AudioClip | undefined;
      if (!audioClip) continue;

      const leadSilence = detectLeadingSilence(audioClip.buffer);
      const tailSilence = detectTrailingSilence(audioClip.buffer);
      let changed = false;

      if (leadSilence > 0.5) {
        // Shift the clip start time forward by the leading silence amount
        // and adjust the duration accordingly
        const newStartTime = audioClip.startTime + leadSilence;
        const newDuration = audioClip.duration - leadSilence;
        if (newDuration > 0.1) {
          session.moveClipTime(track.id, audioClip.id, newStartTime);
          session.resizeClipDuration(track.id, audioClip.id, newDuration);
          changed = true;
        }
      }

      if (tailSilence > 0.5) {
        // Re-read the clip after potential leading trim
        const updatedTrack = useSessionStore.getState().tracks.find(
          (t) => t.id === track.id
        );
        const updatedClip = updatedTrack?.clips.find(
          (c) => c.id === audioClip.id
        );
        if (updatedClip) {
          const newDuration = updatedClip.duration - tailSilence;
          if (newDuration > 0.1) {
            session.resizeClipDuration(track.id, audioClip.id, newDuration);
            changed = true;
          }
        }
      }

      if (changed) trimmedCount++;
    }

    if (trimmedCount > 0) {
      const after = captureTrackState();
      useHistoryStore.getState().pushAction(
        `Trim silence from ${trimmedCount} track(s)`,
        () => restoreTrackState(before),
        () => restoreTrackState(after),
      );
    }

    const newReport = runEngineeringScan();
    setReport(newReport);
    showStatus(
      trimmedCount > 0
        ? `Trimmed silence from ${trimmedCount} track${trimmedCount !== 1 ? 's' : ''}`
        : 'No significant silence found'
    );
  };

  const handleFixClipping = () => {
    const before = captureTrackState();
    const session = useSessionStore.getState();
    const mixer = useMixerStore.getState();
    let fixedCount = 0;

    for (const track of session.tracks) {
      if (track.mute) continue;
      const audioClip = track.clips.find(isAudioClip) as AudioClip | undefined;
      if (!audioClip) continue;

      const data = audioClip.buffer.getChannelData(0);
      const stride = Math.max(1, Math.floor(data.length / 20000));
      let clipCount = 0;
      for (let i = 0; i < data.length; i += stride) {
        if (Math.abs(data[i]!) >= 0.999) clipCount++;
      }

      if (clipCount > 0) {
        const newVol = track.volume - 3;
        mixer.setVolume(track.id, newVol);
        session.updateTrack(track.id, { volume: newVol });
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      const after = captureTrackState();
      useHistoryStore.getState().pushAction(
        `Fix clipping on ${fixedCount} track(s)`,
        () => restoreTrackState(before),
        () => restoreTrackState(after),
      );
    }

    const newReport = runEngineeringScan();
    setReport(newReport);
    showStatus(
      fixedCount > 0
        ? `Fixed clipping on ${fixedCount} track${fixedCount !== 1 ? 's' : ''}`
        : 'No clipping detected'
    );
  };

  const handleNormalize = () => {
    const before = captureTrackState();
    const session = useSessionStore.getState();
    const mixer = useMixerStore.getState();
    const TARGET_DB = -6;
    let normalizedCount = 0;

    for (const track of session.tracks) {
      if (track.mute) continue;
      const audioClip = track.clips.find(isAudioClip) as AudioClip | undefined;
      if (!audioClip) continue;

      const data = audioClip.buffer.getChannelData(0);
      const stride = Math.max(1, Math.floor(data.length / 20000));
      let peak = 0;
      for (let i = 0; i < data.length; i += stride) {
        const abs = Math.abs(data[i]!);
        if (abs > peak) peak = abs;
      }

      const peakDb = 20 * Math.log10(Math.max(peak, 1e-10));
      const adjustment = TARGET_DB - peakDb;

      // Only normalize if there is a meaningful difference (> 0.5 dB)
      if (Math.abs(adjustment) > 0.5) {
        const newVol = Math.round((track.volume + adjustment) * 10) / 10;
        mixer.setVolume(track.id, newVol);
        session.updateTrack(track.id, { volume: newVol });
        normalizedCount++;
      }
    }

    if (normalizedCount > 0) {
      const after = captureTrackState();
      useHistoryStore.getState().pushAction(
        `Normalize ${normalizedCount} track(s) to ${TARGET_DB} dBFS`,
        () => restoreTrackState(before),
        () => restoreTrackState(after),
      );
    }

    const newReport = runEngineeringScan();
    setReport(newReport);
    showStatus(
      normalizedCount > 0
        ? `Normalized ${normalizedCount} track${normalizedCount !== 1 ? 's' : ''} to ${TARGET_DB} dBFS`
        : 'All tracks already near target level'
    );
  };

  const handleDetectClicks = () => {
    const session = useSessionStore.getState();
    let totalClicks = 0;
    let tracksWithClicks = 0;

    for (const track of session.tracks) {
      if (track.mute) continue;
      const audioClip = track.clips.find(isAudioClip) as AudioClip | undefined;
      if (!audioClip) continue;

      const clicks = detectClicks(audioClip.buffer);
      if (clicks.length > 0) {
        totalClicks += clicks.length;
        tracksWithClicks++;
      }
    }

    // Run a full scan to update the report view
    const newReport = runEngineeringScan();
    setReport(newReport);
    showStatus(
      totalClicks > 0
        ? `Found ${totalClicks} click${totalClicks !== 1 ? 's' : ''} across ${tracksWithClicks} track${tracksWithClicks !== 1 ? 's' : ''}`
        : 'No clicks detected'
    );
  };

  const handleFixAll = () => {
    const before = captureTrackState();

    // Run scan first
    const scanReport = runEngineeringScan();

    // Auto-fix all fixable issues from the scan
    const fixed = autoFixIssues(scanReport);

    // Also trim silence (not covered by auto-fix)
    const session = useSessionStore.getState();
    let trimmedCount = 0;

    for (const track of session.tracks) {
      if (track.mute) continue;
      const audioClip = track.clips.find(isAudioClip) as AudioClip | undefined;
      if (!audioClip) continue;

      const leadSilence = detectLeadingSilence(audioClip.buffer);
      const tailSilence = detectTrailingSilence(audioClip.buffer);
      let changed = false;

      if (leadSilence > 0.5) {
        const newStartTime = audioClip.startTime + leadSilence;
        const newDuration = audioClip.duration - leadSilence;
        if (newDuration > 0.1) {
          session.moveClipTime(track.id, audioClip.id, newStartTime);
          session.resizeClipDuration(track.id, audioClip.id, newDuration);
          changed = true;
        }
      }

      if (tailSilence > 0.5) {
        const updatedTrack = useSessionStore.getState().tracks.find(
          (t) => t.id === track.id
        );
        const updatedClip = updatedTrack?.clips.find(
          (c) => c.id === audioClip.id
        );
        if (updatedClip) {
          const newDuration = updatedClip.duration - tailSilence;
          if (newDuration > 0.1) {
            session.resizeClipDuration(track.id, audioClip.id, newDuration);
            changed = true;
          }
        }
      }

      if (changed) trimmedCount++;
    }

    if (fixed > 0 || trimmedCount > 0) {
      const after = captureTrackState();
      useHistoryStore.getState().pushAction(
        `Fix All: ${fixed} issue(s), ${trimmedCount} trim(s)`,
        () => restoreTrackState(before),
        () => restoreTrackState(after),
      );
    }

    // Re-scan to show final state
    const newReport = runEngineeringScan();
    setReport(newReport);

    const parts: string[] = [];
    if (fixed > 0) parts.push(`${fixed} issue${fixed !== 1 ? 's' : ''} fixed`);
    if (trimmedCount > 0) parts.push(`silence trimmed on ${trimmedCount} track${trimmedCount !== 1 ? 's' : ''}`);
    showStatus(
      parts.length > 0
        ? `Fix All: ${parts.join(', ')}`
        : 'No issues to fix'
    );
  };

  const fixableCount = report?.issues.filter(i => i.fixable).length ?? 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleScan}
        disabled={scanning || tracks.length === 0}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-amber-500/20 text-amber-400 hover:bg-amber-500/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {scanning ? 'Scanning...' : 'Engineering Scan'}
      </button>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-1">
        <ActionButton
          label="Trim Silence"
          onClick={handleTrimSilence}
          disabled={tracks.length === 0}
        />
        <ActionButton
          label="Fix Clipping"
          onClick={handleFixClipping}
          disabled={tracks.length === 0}
        />
        <ActionButton
          label="Normalize"
          onClick={handleNormalize}
          disabled={tracks.length === 0}
        />
        <ActionButton
          label="Detect Clicks"
          onClick={handleDetectClicks}
          disabled={tracks.length === 0}
        />
      </div>
      <ActionButton
        label="Fix All"
        onClick={handleFixAll}
        disabled={tracks.length === 0}
      />

      {/* Status Message */}
      {statusMessage && (
        <div className="text-[9px] text-amber-400/80 text-center py-1 px-2
                        bg-amber-500/10 font-mono">
          {statusMessage}
        </div>
      )}

      {report && (
        <div className="space-y-2">
          {/* Summary */}
          <div className="flex items-center justify-between bg-daw-bg/60 p-1.5">
            <div>
              <div className="text-[9px] text-daw-text-dim font-mono">
                {report.issueCount} issue{report.issueCount !== 1 ? 's' : ''} found
                {report.criticalCount > 0 && (
                  <span className="text-red-400 ml-1">
                    ({report.criticalCount} critical)
                  </span>
                )}
              </div>
              <div className="text-[8px] text-daw-text-muted">
                {report.trackCount} tracks scanned
              </div>
            </div>
            {fixableCount > 0 && (
              <button
                onClick={handleAutoFix}
                className="text-[8px] px-2 py-0.5 bg-amber-500/20 text-amber-400
                           hover:bg-amber-500/30 font-mono uppercase"
              >
                Auto-fix ({fixableCount})
              </button>
            )}
          </div>

          {/* Issues list */}
          {report.issues.length === 0 ? (
            <div className="text-[9px] text-green-400/70 text-center py-2 font-mono">
              All clear — no issues detected
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {report.issues.map((issue, i) => (
                <div key={i} className="bg-daw-bg/60 p-1.5 flex items-start gap-1.5">
                  <span className={`text-[7px] px-1 py-0.5 font-mono uppercase shrink-0 ${SEVERITY_COLORS[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[8px] text-daw-text-muted font-mono">
                      {TYPE_LABELS[issue.type]} — {issue.trackName}
                    </div>
                    <div className="text-[9px] text-daw-text-dim">
                      {issue.description}
                    </div>
                  </div>
                  {issue.fixable && issue.fixAction && (
                    <button
                      onClick={() => handleFixSingle(issue)}
                      className="text-[7px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400
                                 hover:bg-amber-500/30 font-mono uppercase shrink-0"
                    >
                      Fix
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
