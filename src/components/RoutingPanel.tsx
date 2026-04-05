import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoutingStore } from '@/stores/routing-store';
import { useSessionStore } from '@/stores/session-store';
import { getBusLevel } from '@/services/routing-service';
import Knob from '@/components/ui/Knob';
import Fader from '@/components/ui/Fader';
import type { BusType } from '@/types/routing';

interface RoutingPanelProps {
  selectedTrackId: string | null;
}

// --- Bus Meter (canvas-based like PeakMeter) ---

function BusMeter({ busId, height = 80 }: { busId: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const peakRef = useRef(0);
  const decayRef = useRef(0);
  const width = 6;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const db = getBusLevel(busId);
    const normalized = Math.max(0, Math.min(1, (db + 60) / 66));

    const segH = 2;
    const gap = 1;
    const total = Math.floor(height / (segH + gap));
    const filled = Math.floor(normalized * total);

    for (let i = 0; i < total; i++) {
      const y = height - (i + 1) * (segH + gap);
      const ratio = i / total;
      if (i < filled) {
        ctx.fillStyle = ratio > 0.92 ? '#E63946'
          : ratio > 0.75 ? '#F77F00' : '#D1D1D1';
      } else {
        ctx.fillStyle = '#1a1a1a';
      }
      ctx.fillRect(1, y, width - 2, segH);
    }

    if (normalized > peakRef.current) {
      peakRef.current = normalized;
      decayRef.current = 60;
    }
    if (decayRef.current > 0) {
      decayRef.current--;
    } else {
      peakRef.current = Math.max(peakRef.current - 0.01, normalized);
    }
    const peakY = height - peakRef.current * height;
    ctx.fillStyle = peakRef.current > 0.92 ? '#ef4444' : '#fff';
    ctx.fillRect(1, peakY, width - 2, 1);

    rafRef.current = requestAnimationFrame(draw);
  }, [busId, height]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className=""
    />
  );
}

// --- Buses Section ---

function BusesSection() {
  const buses = useRoutingStore((s) => s.buses);
  const sends = useRoutingStore((s) => s.sends);
  const addBus = useRoutingStore((s) => s.addBus);
  const removeBus = useRoutingStore((s) => s.removeBus);
  const updateBus = useRoutingStore((s) => s.updateBus);
  const tracks = useSessionStore((s) => s.tracks);

  const busList = Object.values(buses);
  const returnBuses = busList.filter((b) => b.type === 'return');
  const groupBuses = busList.filter((b) => b.type === 'group');

  const handleAddBus = (type: BusType) => {
    const label = type === 'return' ? 'Return' : 'Group';
    const count = busList.filter((b) => b.type === type).length + 1;
    addBus(`${label} ${count}`, type);
  };

  const getSourceTracks = (busId: string): string[] => {
    const sendList = Object.values(sends);
    const trackIds = sendList
      .filter((s) => s.busId === busId)
      .map((s) => s.sourceTrackId);
    return trackIds
      .map((id) => tracks.find((t) => t.id === id)?.name ?? id)
      .filter(Boolean);
  };

  const renderBusStrip = (bus: typeof busList[number]) => (
    <div
      key={bus.id}
      className="flex flex-col items-center gap-1 bg-daw-panel p-2
                 border border-daw-border min-w-[72px]"
    >
      <div
        className="w-3 h-1 mb-0.5"
        style={{ backgroundColor: bus.color }}
      />
      <span className="text-xxs text-daw-text truncate max-w-[64px]">
        {bus.name}
      </span>

      <div className="flex gap-1 items-end">
        <Fader
          value={bus.volume}
          min={-60}
          max={6}
          onChange={(v) => updateBus(bus.id, { volume: v })}
          height={80}
        />
        <BusMeter busId={bus.id} height={80} />
      </div>

      <Knob
        value={bus.pan}
        min={-1}
        max={1}
        onChange={(v) => updateBus(bus.id, { pan: v })}
        label="Pan"
        size={24}
      />

      <div className="flex gap-1">
        <button
          className={`text-xxs px-1 ${
            bus.mute
              ? 'bg-red-600 text-white'
              : 'bg-daw-surface text-daw-text-muted'
          }`}
          onClick={() => updateBus(bus.id, { mute: !bus.mute })}
        >
          M
        </button>
        <button
          className={`text-xxs px-1 ${
            bus.solo
              ? 'bg-yellow-500 text-black'
              : 'bg-daw-surface text-daw-text-muted'
          }`}
          onClick={() => updateBus(bus.id, { solo: !bus.solo })}
        >
          S
        </button>
      </div>

      {/* Source tracks */}
      <div className="text-xxs text-daw-text-muted mt-1 w-full">
        {getSourceTracks(bus.id).map((name, i) => (
          <div key={i} className="truncate">{name}</div>
        ))}
      </div>

      <button
        className="text-xxs text-red-400 hover:text-red-300 mt-1"
        onClick={() => removeBus(bus.id)}
      >
        Remove
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="daw-section-label">Return Buses</span>
          <button
            className="daw-button text-xxs px-2 py-0.5"
            onClick={() => handleAddBus('return')}
          >
            + Return
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {returnBuses.length === 0 && (
            <span className="text-xxs text-daw-text-muted italic">
              No return buses
            </span>
          )}
          {returnBuses.map(renderBusStrip)}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="daw-section-label">Group Buses</span>
          <button
            className="daw-button text-xxs px-2 py-0.5"
            onClick={() => handleAddBus('group')}
          >
            + Group
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {groupBuses.length === 0 && (
            <span className="text-xxs text-daw-text-muted italic">
              No group buses
            </span>
          )}
          {groupBuses.map(renderBusStrip)}
        </div>
      </div>
    </div>
  );
}

// --- Sends Section ---

function SendsSection({ selectedTrackId }: { selectedTrackId: string }) {
  const sends = useRoutingStore((s) => s.sends);
  const buses = useRoutingStore((s) => s.buses);
  const addSend = useRoutingStore((s) => s.addSend);
  const removeSend = useRoutingStore((s) => s.removeSend);
  const updateSend = useRoutingStore((s) => s.updateSend);
  const [showDropdown, setShowDropdown] = useState(false);

  const trackSends = Object.values(sends)
    .filter((s) => s.sourceTrackId === selectedTrackId);

  const availableBuses = Object.values(buses)
    .filter((b) => b.type === 'return');

  const handleAddSend = (busId: string) => {
    addSend(selectedTrackId, busId);
    setShowDropdown(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="daw-section-label">Sends</span>
        <div className="relative">
          <button
            className="daw-button text-xxs px-2 py-0.5"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            + Send
          </button>
          {showDropdown && (
            <div
              className="absolute top-full left-0 mt-1 bg-daw-surface border
                         border-daw-border shadow-lg z-10 min-w-[120px]"
            >
              {availableBuses.length === 0 ? (
                <div className="text-xxs text-daw-text-muted p-2">
                  No return buses
                </div>
              ) : (
                availableBuses.map((bus) => (
                  <button
                    key={bus.id}
                    className="block w-full text-left text-xxs px-3 py-1.5
                               text-daw-text hover:bg-daw-accent/20"
                    onClick={() => handleAddSend(bus.id)}
                  >
                    <span
                      className="inline-block w-2 h-2 mr-1.5"
                      style={{ backgroundColor: bus.color }}
                    />
                    {bus.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {trackSends.length === 0 ? (
        <span className="text-xxs text-daw-text-muted italic">
          No sends on this track
        </span>
      ) : (
        <div className="flex flex-col gap-1">
          {trackSends.map((send) => {
            const bus = buses[send.busId];
            return (
              <div
                key={send.id}
                className="flex items-center gap-2 bg-daw-panel px-2
                           py-1 border border-daw-border"
              >
                <span
                  className="w-2 h-2 shrink-0"
                  style={{ backgroundColor: bus?.color ?? '#888' }}
                />
                <span className="text-xxs text-daw-text min-w-[60px]">
                  {bus?.name ?? 'Unknown'}
                </span>

                <Knob
                  value={send.amount}
                  min={0}
                  max={1}
                  onChange={(v) => updateSend(send.id, { amount: v })}
                  label="Amt"
                  size={22}
                />

                <button
                  className={`text-xxs px-1.5 py-0.5 ${
                    send.enabled
                      ? 'bg-daw-accent text-white'
                      : 'bg-daw-surface text-daw-text-muted'
                  }`}
                  onClick={() =>
                    updateSend(send.id, { enabled: !send.enabled })
                  }
                >
                  {send.enabled ? 'On' : 'Off'}
                </button>

                <button
                  className="text-xxs text-red-400 hover:text-red-300 ml-auto"
                  onClick={() => removeSend(send.id)}
                >
                  X
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Sidechain Section ---

function SidechainSection() {
  const sidechains = useRoutingStore((s) => s.sidechains);
  const addSidechain = useRoutingStore((s) => s.addSidechain);
  const removeSidechain = useRoutingStore((s) => s.removeSidechain);
  const updateSidechain = useRoutingStore((s) => s.updateSidechain);
  const tracks = useSessionStore((s) => s.tracks);

  const [showForm, setShowForm] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');

  const scList = Object.values(sidechains);

  const handleAdd = () => {
    if (sourceId && targetId && sourceId !== targetId) {
      addSidechain(sourceId, targetId);
      setShowForm(false);
      setSourceId('');
      setTargetId('');
    }
  };

  const getTrackName = (id: string): string =>
    tracks.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="daw-section-label">Sidechain</span>
        <button
          className="daw-button text-xxs px-2 py-0.5"
          onClick={() => setShowForm(!showForm)}
        >
          + Sidechain
        </button>
      </div>

      {showForm && (
        <div className="flex items-center gap-2 bg-daw-panel p-2
                        border border-daw-border">
          <div className="flex flex-col gap-1">
            <label className="text-xxs text-daw-text-muted">Source (trigger)</label>
            <select
              className="bg-daw-surface text-daw-text text-xxs px-1
                         py-0.5 border border-daw-border"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Select...</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <span className="text-xxs text-daw-text-muted mt-3">-&gt;</span>
          <div className="flex flex-col gap-1">
            <label className="text-xxs text-daw-text-muted">Target (ducked)</label>
            <select
              className="bg-daw-surface text-daw-text text-xxs px-1
                         py-0.5 border border-daw-border"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select...</option>
              {tracks
                .filter((t) => t.id !== sourceId)
                .map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
            </select>
          </div>
          <button
            className="daw-button text-xxs px-2 py-0.5 mt-3"
            onClick={handleAdd}
            disabled={!sourceId || !targetId}
          >
            Add
          </button>
          <button
            className="text-xxs text-daw-text-muted hover:text-daw-text mt-3"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {scList.length === 0 && !showForm ? (
        <span className="text-xxs text-daw-text-muted italic">
          No sidechains configured
        </span>
      ) : (
        <div className="flex flex-col gap-1">
          {scList.map((sc) => (
            <div
              key={sc.id}
              className="flex items-center gap-3 bg-daw-panel px-2
                         py-1.5 border border-daw-border flex-wrap"
            >
              <div className="flex items-center gap-1 min-w-[120px]">
                <span className="text-xxs text-daw-text">
                  {getTrackName(sc.sourceTrackId)}
                </span>
                <span className="text-xxs text-daw-text-muted">-&gt;</span>
                <span className="text-xxs text-daw-text">
                  {getTrackName(sc.targetTrackId)}
                </span>
              </div>

              <Knob
                value={sc.threshold}
                min={-60}
                max={0}
                onChange={(v) => updateSidechain(sc.id, { threshold: v })}
                label="Thresh"
                size={22}
              />
              <Knob
                value={sc.ratio}
                min={1}
                max={20}
                onChange={(v) => updateSidechain(sc.id, { ratio: v })}
                label="Ratio"
                size={22}
              />
              <Knob
                value={sc.attack}
                min={0}
                max={1}
                onChange={(v) => updateSidechain(sc.id, { attack: v })}
                label="Atk"
                size={22}
              />
              <Knob
                value={sc.release}
                min={0}
                max={1}
                onChange={(v) => updateSidechain(sc.id, { release: v })}
                label="Rel"
                size={22}
              />
              <Knob
                value={sc.amount}
                min={0}
                max={1}
                onChange={(v) => updateSidechain(sc.id, { amount: v })}
                label="Mix"
                size={22}
              />

              <button
                className={`text-xxs px-1.5 py-0.5 ${
                  sc.enabled
                    ? 'bg-daw-accent text-white'
                    : 'bg-daw-surface text-daw-text-muted'
                }`}
                onClick={() =>
                  updateSidechain(sc.id, { enabled: !sc.enabled })
                }
              >
                {sc.enabled ? 'On' : 'Off'}
              </button>

              <button
                className="text-xxs text-red-400 hover:text-red-300 ml-auto"
                onClick={() => removeSidechain(sc.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Group Assignments Section ---

function GroupAssignmentsSection() {
  const buses = useRoutingStore((s) => s.buses);
  const groupAssignments = useRoutingStore((s) => s.groupAssignments);
  const assignToGroup = useRoutingStore((s) => s.assignToGroup);
  const removeFromGroup = useRoutingStore((s) => s.removeFromGroup);
  const tracks = useSessionStore((s) => s.tracks);

  const groupBuses = Object.values(buses).filter((b) => b.type === 'group');

  const getAssignment = (trackId: string): string | null => {
    const assignment = groupAssignments.find((a) => a.trackId === trackId);
    return assignment?.groupBusId ?? null;
  };

  const handleChange = (trackId: string, groupBusId: string) => {
    if (groupBusId === '') {
      removeFromGroup(trackId);
    } else {
      assignToGroup(trackId, groupBusId);
    }
  };

  if (groupBuses.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <span className="daw-section-label">Group Assignments</span>
        <span className="text-xxs text-daw-text-muted italic">
          Create a group bus first
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="daw-section-label">Group Assignments</span>
      <div className="flex flex-col gap-1">
        {tracks.map((track) => {
          const currentGroup = getAssignment(track.id);
          return (
            <div
              key={track.id}
              className="flex items-center gap-2 bg-daw-panel px-2
                         py-1 border border-daw-border"
            >
              <span
                className="w-2 h-2 shrink-0"
                style={{ backgroundColor: track.color }}
              />
              <span className="text-xxs text-daw-text min-w-[80px] truncate">
                {track.name}
              </span>
              <select
                className="bg-daw-surface text-daw-text text-xxs px-1
                           py-0.5 border border-daw-border flex-1"
                value={currentGroup ?? ''}
                onChange={(e) => handleChange(track.id, e.target.value)}
              >
                <option value="">-- Direct Out --</option>
                {groupBuses.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Control Room Section ---

function ControlRoomSection() {
  const controlRoom = useRoutingStore((s) => s.controlRoom);
  const initControlRoom = useRoutingStore((s) => s.initControlRoom);
  const addMonitorPath = useRoutingStore((s) => s.addMonitorPath);
  const removeMonitorPath = useRoutingStore((s) => s.removeMonitorPath);
  const setActiveMonitor = useRoutingStore((s) => s.setActiveMonitor);
  const toggleDim = useRoutingStore((s) => s.toggleDim);
  const toggleMono = useRoutingStore((s) => s.toggleMono);
  const toggleTalkback = useRoutingStore((s) => s.toggleTalkback);

  if (!controlRoom.enabled) {
    return (
      <div className="flex flex-col gap-2">
        <span className="daw-section-label">Control Room</span>
        <button
          className="daw-button text-xxs px-3 py-1"
          onClick={initControlRoom}
        >
          Enable Control Room
        </button>
      </div>
    );
  }

  const activeMonitor = controlRoom.monitorPaths.find(
    (p) => p.id === controlRoom.activeMonitorId,
  );

  return (
    <div className="flex flex-col gap-3">
      <span className="daw-section-label">Control Room</span>

      {/* Monitor paths */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xxs text-daw-text-muted">Monitor Paths</span>
          <button
            className="daw-button text-xxs px-2 py-0.5"
            onClick={() => addMonitorPath(`Monitor ${controlRoom.monitorPaths.length + 1}`)}
          >
            + Monitor
          </button>
        </div>
        {controlRoom.monitorPaths.map((path) => {
          const isActive = path.id === controlRoom.activeMonitorId;
          return (
            <div
              key={path.id}
              className={`flex items-center gap-2 px-2 py-1.5 border transition-colors
                         ${isActive
              ? 'bg-daw-accent/10 border-daw-accent/30'
              : 'bg-daw-panel border-daw-border hover:bg-daw-surface-alt'}`}
            >
              <button
                className="text-xxs text-daw-text flex-1 text-left"
                onClick={() => setActiveMonitor(path.id)}
              >
                {path.name}
              </button>
              <span className="text-[9px] text-daw-text-muted font-mono">
                {path.volume.toFixed(0)} dB
              </span>
              {path.dimEnabled && (
                <span className="text-[8px] px-1 py-px bg-amber-500/15 text-amber-400">DIM</span>
              )}
              {path.monoEnabled && (
                <span className="text-[8px] px-1 py-px bg-sky-500/15 text-sky-400">MONO</span>
              )}
              {controlRoom.monitorPaths.length > 1 && (
                <button
                  className="text-xxs text-red-400/60 hover:text-red-400"
                  onClick={() => removeMonitorPath(path.id)}
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-1.5">
        <button
          className={`text-xxs px-3 py-1.5 font-medium transition-all border
                     ${activeMonitor?.dimEnabled
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-daw-bg/50 text-daw-text-muted border-daw-border/30 hover:text-daw-text-dim'}`}
          onClick={toggleDim}
          title="Dim monitor output"
        >
          DIM
        </button>
        <button
          className={`text-xxs px-3 py-1.5 font-medium transition-all border
                     ${activeMonitor?.monoEnabled
      ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
      : 'bg-daw-bg/50 text-daw-text-muted border-daw-border/30 hover:text-daw-text-dim'}`}
          onClick={toggleMono}
          title="Monitor in mono"
        >
          MONO
        </button>
        <button
          className={`text-xxs px-3 py-1.5 font-medium transition-all border
                     ${controlRoom.talkbackEnabled
      ? 'bg-red-500/20 text-red-400 border-red-500/30'
      : 'bg-daw-bg/50 text-daw-text-muted border-daw-border/30 hover:text-daw-text-dim'}`}
          onClick={toggleTalkback}
          title="Toggle talkback"
        >
          TALK
        </button>
      </div>

      {/* Active monitor info */}
      {activeMonitor && (
        <div className="text-xxs text-daw-text-muted/60 bg-daw-bg/30 px-2 py-1.5">
          Active: {activeMonitor.name}
          {' \u00b7 '}{activeMonitor.volume.toFixed(0)} dB
          {activeMonitor.dimEnabled && ` \u00b7 Dim ${activeMonitor.dimAmount}dB`}
          {activeMonitor.monoEnabled && ' \u00b7 Mono'}
        </div>
      )}
    </div>
  );
}

// --- Main Panel ---

type TabId = 'buses' | 'sends' | 'sidechain' | 'groups' | 'monitor';

export default function RoutingPanel({ selectedTrackId }: RoutingPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('buses');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'buses', label: 'BUS' },
    { id: 'sends', label: 'SEND' },
    { id: 'sidechain', label: 'SC' },
    { id: 'groups', label: 'GRP' },
    { id: 'monitor', label: 'MON' },
  ];

  return (
    <div className="flex flex-col h-full bg-daw-surface border-t border-daw-border">
      {/* Tab bar */}
      <div className="flex items-center border-b border-daw-border">
        <span className="text-[9px] font-mono font-bold uppercase tracking-[3px] text-[#E63946]/90 px-3 shrink-0">
          ROUTE
        </span>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-3 py-1.5 text-xxs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-daw-text border-b-2 border-daw-accent'
                : 'text-daw-text-muted hover:text-daw-text-dim'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === 'buses' && <BusesSection />}
        {activeTab === 'sends' && (
          selectedTrackId ? (
            <SendsSection selectedTrackId={selectedTrackId} />
          ) : (
            <span className="text-xxs text-daw-text-muted italic">
              Select a track to manage sends
            </span>
          )
        )}
        {activeTab === 'sidechain' && <SidechainSection />}
        {activeTab === 'groups' && <GroupAssignmentsSection />}
        {activeTab === 'monitor' && <ControlRoomSection />}
      </div>
    </div>
  );
}
