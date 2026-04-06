/**
 * Engineering Actions Panel — displays and resolves audio engineering issues.
 */

import { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { runEngineeringScan, autoFixIssues } from '@/services/ai/engineering-actions';
import type { EngineeringReport, EngineeringIssue } from '@/services/ai/engineering-actions';

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

export default function EngineeringActionsPanel() {
  const tracks = useSessionStore((s) => s.tracks);
  const [report, setReport] = useState<EngineeringReport | null>(null);
  const [scanning, setScanning] = useState(false);

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
    autoFixIssues(report);
    // Re-scan after fixing
    const newReport = runEngineeringScan();
    setReport(newReport);
  };

  const handleFixSingle = (issue: EngineeringIssue) => {
    if (issue.fixAction) {
      issue.fixAction();
      // Re-scan
      const newReport = runEngineeringScan();
      setReport(newReport);
    }
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
