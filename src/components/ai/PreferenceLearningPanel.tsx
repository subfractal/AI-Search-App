/**
 * Preference Learning Panel — inspect, export, and reset learned user preferences.
 */

import { useState, useEffect } from 'react';
import {
  loadPreferences,
  resetPreferences,
  exportPreferences,
  getAcceptanceRate,
} from '@/services/ai/preference-learning';
import type { UserPreferences } from '@/services/ai/preference-learning';

export default function PreferenceLearningPanel() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  const handleReset = () => {
    resetPreferences();
    setPrefs(loadPreferences());
  };

  const handleExport = () => {
    const json = exportPreferences();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dkst-preferences.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setPrefs(loadPreferences());
  };

  if (!prefs) return null;

  const acceptRate = getAcceptanceRate();
  const totalSuggestions = prefs.suggestionsAccepted + prefs.suggestionsRejected;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button onClick={handleRefresh}
          className="flex-1 text-[8px] py-1 font-mono uppercase bg-daw-bg/60 text-daw-text-dim hover:bg-daw-panel">
          Refresh
        </button>
        <button onClick={handleExport}
          className="flex-1 text-[8px] py-1 font-mono uppercase bg-daw-bg/60 text-daw-text-dim hover:bg-daw-panel">
          Export
        </button>
        <button onClick={handleReset}
          className="flex-1 text-[8px] py-1 font-mono uppercase bg-red-500/10 text-red-400 hover:bg-red-500/20">
          Reset
        </button>
      </div>

      <div className="space-y-1">
        <StatRow label="Sessions" value={prefs.sessionCount} />
        <StatRow label="Avg Tracks" value={prefs.avgTrackCount || '—'} />
        {prefs.targetLoudnessLufs !== null && (
          <StatRow label="Target LUFS" value={`${prefs.targetLoudnessLufs.toFixed(1)}`} />
        )}
        {prefs.commonBpm.length > 0 && (
          <StatRow label="Common BPM" value={
            [...new Set(prefs.commonBpm)].slice(0, 4).join(', ')
          } />
        )}
        {prefs.commonKeys.length > 0 && (
          <StatRow label="Common Keys" value={prefs.commonKeys.slice(0, 5).join(', ')} />
        )}
        {prefs.commonGenres.length > 0 && (
          <StatRow label="Genres" value={prefs.commonGenres.join(', ')} />
        )}
        {totalSuggestions > 0 && (
          <StatRow label="Accept Rate" value={`${Math.round(acceptRate * 100)}% (${totalSuggestions} total)`} />
        )}
        {Object.keys(prefs.commonEffectChains).length > 0 && (
          <div className="bg-daw-bg/60 p-1.5">
            <div className="text-[7px] text-daw-text-muted font-mono uppercase">Effect Chains</div>
            {Object.entries(prefs.commonEffectChains).map(([role, chain]) => (
              <div key={role} className="text-[8px] text-daw-text-dim mt-0.5">
                <span className="text-daw-text-muted">{role}:</span> {chain.join(' → ')}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[7px] text-daw-text-muted text-center">
        All data stored locally — never sent to any server
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between bg-daw-bg/60 px-1.5 py-1">
      <span className="text-[8px] text-daw-text-muted font-mono">{label}</span>
      <span className="text-[8px] text-daw-text-dim font-mono">{value}</span>
    </div>
  );
}
