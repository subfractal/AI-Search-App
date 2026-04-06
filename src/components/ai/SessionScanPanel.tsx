/**
 * Session Scan Panel — displays unified project analysis:
 * tempo, key, sections, track roles, energy curve.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { runSessionScan } from '@/services/ai/session-scanner';
import type { EnrichedScanResult, TrackRoleGuess } from '@/types/session-scan';

export default function SessionScanPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const updateTrack = useSessionStore((s) => s.updateTrack);
  const setConfig = useSessionStore((s) => s.setConfig);
  const [scanResult, setScanResult] = useState<EnrichedScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = () => {
    if (tracks.length === 0) return;
    setScanning(true);
    try {
      const result = runSessionScan();
      setScanResult(result);
    } finally {
      setScanning(false);
    }
  };

  const acceptTempo = () => {
    if (!scanResult) return;
    setConfig({ bpm: scanResult.tempo.bpm });
  };

  const acceptRoles = () => {
    if (!scanResult) return;
    for (const tr of scanResult.trackRoles) {
      updateTrack(tr.trackId, { role: tr.role });
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleScan}
        disabled={scanning || tracks.length === 0}
        className="w-full text-xxs py-1.5 font-bold font-mono uppercase tracking-wider
                   bg-[#E63946]/20 text-[#E63946] hover:bg-[#E63946]/30
                   disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        {scanning ? 'Scanning...' : 'Scan Project'}
      </button>

      {scanResult && (
        <div className="space-y-2">
          {/* Tempo & Key */}
          <div className="flex gap-2">
            <div className="flex-1 bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-daw-text-muted uppercase">Tempo</div>
              <div className="text-xs font-mono text-daw-text-dim">
                {scanResult.tempo.bpm} BPM
                <span className="text-[8px] text-daw-text-muted ml-1">
                  ({Math.round(scanResult.tempo.confidence * 100)}%)
                </span>
              </div>
              <button onClick={acceptTempo}
                className="text-[8px] text-[#E63946] hover:underline mt-0.5">
                Apply
              </button>
            </div>
            <div className="flex-1 bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-daw-text-muted uppercase">Key</div>
              <div className="text-xs font-mono text-daw-text-dim">
                {scanResult.key.key} {scanResult.key.scale}
                <span className="text-[8px] text-daw-text-muted ml-1">
                  ({Math.round(scanResult.key.confidence * 100)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Sections */}
          {scanResult.sections.length > 0 && (
            <div className="bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-daw-text-muted uppercase mb-1">Sections</div>
              <div className="flex flex-wrap gap-1">
                {scanResult.sections.map((s, i) => (
                  <span key={i} className="text-[8px] px-1.5 py-0.5 bg-daw-panel text-daw-text-dim">
                    {s.label} ({s.start.toFixed(1)}s–{s.end.toFixed(1)}s)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Track Roles */}
          <div className="bg-daw-bg/60 p-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-daw-text-muted uppercase">Track Roles</span>
              <button onClick={acceptRoles}
                className="text-[8px] text-[#E63946] hover:underline">
                Apply All
              </button>
            </div>
            {scanResult.trackRoles.map((tr) => (
              <RoleRow key={tr.trackId} role={tr} />
            ))}
          </div>

          {/* Energy Curve */}
          {scanResult.energyCurve.length > 0 && (
            <div className="bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-daw-text-muted uppercase mb-1">Energy Curve</div>
              <div className="flex items-end gap-px h-8">
                {scanResult.energyCurve.map((e, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#E63946]/40"
                    style={{ height: `${e * 100}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Chords */}
          {scanResult.chords.length > 0 && (
            <div className="bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-daw-text-muted uppercase mb-1">Detected Chords</div>
              <div className="flex flex-wrap gap-1">
                {scanResult.chords.slice(0, 16).map((c, i) => (
                  <span key={i} className="text-[8px] px-1 py-0.5 bg-daw-panel text-daw-text-dim font-mono">
                    {c.root}{c.quality}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Overall Health Score */}
          <div className="bg-daw-bg/60 p-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-daw-text-muted uppercase">Mix Health</span>
              <span className={`text-xs font-mono font-bold ${
                scanResult.overallHealth >= 80 ? 'text-green-400' :
                scanResult.overallHealth >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {scanResult.overallHealth}/100
              </span>
            </div>
            <div className="w-full h-1 bg-daw-bg rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  scanResult.overallHealth >= 80 ? 'bg-green-400' :
                  scanResult.overallHealth >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${scanResult.overallHealth}%` }}
              />
            </div>
          </div>

          {/* Clipping Issues */}
          {scanResult.clippingIssues.length > 0 && (
            <div className="bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-red-400 uppercase mb-1">
                Clipping ({scanResult.clippingIssues.length})
              </div>
              {scanResult.clippingIssues.slice(0, 5).map((ci, i) => {
                const t = tracks.find(tr => tr.id === ci.trackId);
                return (
                  <div key={i} className="text-[8px] text-daw-text-dim py-0.5">
                    <span className="text-red-400">{t?.name ?? 'Track'}</span>
                    {' '}{ci.peakDb.toFixed(1)} dB at {ci.regionStart.toFixed(1)}s–{ci.regionEnd.toFixed(1)}s
                  </div>
                );
              })}
            </div>
          )}

          {/* Phase Issues */}
          {scanResult.phaseIssues.length > 0 && (
            <div className="bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-yellow-400 uppercase mb-1">
                Phase Issues ({scanResult.phaseIssues.length})
              </div>
              {scanResult.phaseIssues.map((pi, i) => {
                const t = tracks.find(tr => tr.id === pi.trackId);
                return (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span className="text-[8px] text-daw-text-dim">{t?.name ?? 'Track'}</span>
                    <span className={`text-[7px] px-1 py-0.5 font-mono ${
                      pi.severity === 'high' ? 'text-red-400 bg-red-400/10' :
                      'text-yellow-400 bg-yellow-400/10'
                    }`}>
                      r={pi.correlation.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Masking Hotspots */}
          {scanResult.maskingHotspots.length > 0 && (
            <div className="bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-orange-400 uppercase mb-1">
                Masking ({scanResult.maskingHotspots.length})
              </div>
              {scanResult.maskingHotspots.slice(0, 4).map((mh, i) => {
                const tA = tracks.find(tr => tr.id === mh.trackAId);
                const tB = tracks.find(tr => tr.id === mh.trackBId);
                return (
                  <div key={i} className="text-[8px] text-daw-text-dim py-0.5">
                    {tA?.name} vs {tB?.name}
                    <span className="text-orange-400 ml-1">
                      {Math.round(mh.severity * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Gain Staging Issues */}
          {scanResult.gainStagingIssues.length > 0 && (
            <div className="bg-daw-bg/60 p-1.5">
              <div className="text-[8px] text-amber-400 uppercase mb-1">
                Gain Staging ({scanResult.gainStagingIssues.length})
              </div>
              {scanResult.gainStagingIssues.map((gs, i) => {
                const t = tracks.find(tr => tr.id === gs.trackId);
                return (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span className="text-[8px] text-daw-text-dim truncate flex-1">{t?.name}</span>
                    <span className="text-[8px] font-mono text-amber-400">
                      {gs.suggestedAdjustment > 0 ? '+' : ''}{gs.suggestedAdjustment.toFixed(1)} dB
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RoleRow({ role }: { role: TrackRoleGuess }) {
  const track = useSessionStore((s) => s.tracks.find((t) => t.id === role.trackId));
  if (!track) return null;

  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[9px] text-daw-text-dim truncate flex-1">{track.name}</span>
      <span className="text-[8px] px-1.5 py-0.5 bg-[#E63946]/10 text-[#E63946] font-mono">
        {role.role}
      </span>
      <span className="text-[8px] text-daw-text-muted ml-1 w-8 text-right">
        {Math.round(role.confidence * 100)}%
      </span>
    </div>
  );
}
