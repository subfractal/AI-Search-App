/**
 * Intelligent Routing Graph Builder — auto-proposes buses,
 * groups, sends, and sidechain connections based on track roles
 * and common mix graph patterns.
 */

import { useSessionStore } from '@/stores/session-store';
import type { RoutingPlan, RoutingSuggestion } from '@/types/session-scan';
import type { SessionScanResult } from '@/types/session-scan';

// Common bus patterns by role combination
const GROUP_PATTERNS: Array<{
  name: string;
  roles: string[];
  reason: string;
}> = [
  {
    name: 'Drum Bus',
    roles: ['drums', 'percussion'],
    reason: 'Group all drums for parallel compression and unified processing',
  },
  {
    name: 'Bass Bus',
    roles: ['bass'],
    reason: 'Isolate bass for precise low-end control',
  },
  {
    name: 'Music Bus',
    roles: ['lead', 'pad', 'chords', 'arp'],
    reason: 'Group melodic/harmonic elements for cohesive processing',
  },
  {
    name: 'Vocal Bus',
    roles: ['vocal'],
    reason: 'Group vocals for unified compression, EQ, and effects',
  },
  {
    name: 'FX Bus',
    roles: ['fx'],
    reason: 'Collect sound design elements for level control',
  },
];

const SEND_PATTERNS: Array<{
  name: string;
  applicableRoles: string[];
  reason: string;
}> = [
  {
    name: 'Plate Reverb',
    applicableRoles: ['vocal', 'lead', 'pad'],
    reason: 'Shared reverb for space and depth — saves CPU vs per-track reverbs',
  },
  {
    name: 'Room Reverb',
    applicableRoles: ['drums', 'percussion', 'bass'],
    reason: 'Short room ambiance for cohesion — glues rhythmic elements',
  },
  {
    name: 'Delay Send',
    applicableRoles: ['vocal', 'lead', 'arp'],
    reason: 'Shared tempo-synced delay for rhythmic interest',
  },
  {
    name: 'Parallel Compression',
    applicableRoles: ['drums', 'percussion'],
    reason: 'Heavy parallel compression on a send for punch without crushing transients',
  },
];

const SIDECHAIN_PATTERNS: Array<{
  name: string;
  source: string;
  targets: string[];
  reason: string;
}> = [
  {
    name: 'Kick → Bass Duck',
    source: 'drums',
    targets: ['bass'],
    reason: 'Sidechain bass to kick for low-end clarity — prevents masking',
  },
  {
    name: 'Kick → Pad Duck',
    source: 'drums',
    targets: ['pad', 'chords'],
    reason: 'Pump effect / clarity: duck pads on kick hits',
  },
  {
    name: 'Vocal → Music Duck',
    source: 'vocal',
    targets: ['pad', 'chords', 'lead'],
    reason: 'Duck music behind vocals for intelligibility',
  },
];

/**
 * Build a routing plan based on session scan results.
 */
export function buildRoutingPlan(scan: SessionScanResult): RoutingPlan {
  const roleMap = new Map<string, string[]>(); // role → trackIds

  for (const tr of scan.trackRoles) {
    const list = roleMap.get(tr.role) ?? [];
    list.push(tr.trackId);
    roleMap.set(tr.role, list);
  }

  const presentRoles = new Set(scan.trackRoles.map((r) => r.role));

  // ─── Group suggestions ───
  const groups: RoutingSuggestion[] = [];
  for (const pattern of GROUP_PATTERNS) {
    const matchingRoles = pattern.roles.filter((r) => presentRoles.has(r));
    if (matchingRoles.length === 0) continue;

    const sourceTrackIds = matchingRoles.flatMap((r) => roleMap.get(r) ?? []);
    if (sourceTrackIds.length === 0) continue;

    // Skip if only one track — grouping is unnecessary
    if (sourceTrackIds.length < 2 && pattern.roles.length > 1) continue;

    groups.push({
      type: 'group',
      name: pattern.name,
      sourceTrackIds,
      targetName: pattern.name,
      reason: pattern.reason,
      priority: sourceTrackIds.length,
    });
  }

  // ─── Send suggestions ───
  const sends: RoutingSuggestion[] = [];
  for (const pattern of SEND_PATTERNS) {
    const matchingRoles = pattern.applicableRoles.filter((r) => presentRoles.has(r));
    if (matchingRoles.length === 0) continue;

    const sourceTrackIds = matchingRoles.flatMap((r) => roleMap.get(r) ?? []);
    if (sourceTrackIds.length === 0) continue;

    sends.push({
      type: 'send',
      name: pattern.name,
      sourceTrackIds,
      targetName: pattern.name,
      reason: pattern.reason,
      priority: sourceTrackIds.length,
    });
  }

  // ─── Sidechain suggestions ───
  const sidechains: RoutingSuggestion[] = [];
  for (const pattern of SIDECHAIN_PATTERNS) {
    if (!presentRoles.has(pattern.source)) continue;

    const targetRoles = pattern.targets.filter((r) => presentRoles.has(r));
    if (targetRoles.length === 0) continue;

    const sourceTrackIds = roleMap.get(pattern.source) ?? [];
    const targetTrackIds = targetRoles.flatMap((r) => roleMap.get(r) ?? []);

    if (sourceTrackIds.length === 0 || targetTrackIds.length === 0) continue;

    sidechains.push({
      type: 'sidechain',
      name: pattern.name,
      sourceTrackIds,
      targetName: targetTrackIds.join(','),
      reason: pattern.reason,
      priority: targetTrackIds.length,
    });
  }

  // Sort all by priority (descending)
  groups.sort((a, b) => b.priority - a.priority);
  sends.sort((a, b) => b.priority - a.priority);
  sidechains.sort((a, b) => b.priority - a.priority);

  return { groups, sends, sidechains };
}

/**
 * Apply a routing plan to the current session —
 * creates group tracks, return tracks, and logs the routing setup.
 */
export function applyRoutingPlan(plan: RoutingPlan): void {
  const session = useSessionStore.getState();

  // Create group tracks
  for (const group of plan.groups) {
    session.addGroupTrack(group.name);
  }

  // Create return/send tracks
  for (const send of plan.sends) {
    session.addReturnTrack(send.name);
  }

  // Note: actual audio routing connections would require
  // integration with the audio engine (Tone.js node graph).
  // Here we create the track structure; routing is visual.
}
