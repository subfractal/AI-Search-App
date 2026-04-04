import { create } from 'zustand';
import type {
  Bus,
  BusType,
  SendConfig,
  SidechainConfig,
  GroupAssignment,
} from '@/types/routing';
import { DEFAULT_BUS, BUS_COLORS } from '@/types/routing';
import { generateId } from '@/utils/id';
import * as routingService from '@/services/routing-service';

interface RoutingStore {
  buses: Record<string, Bus>;
  sends: Record<string, SendConfig>;
  sidechains: Record<string, SidechainConfig>;
  groupAssignments: GroupAssignment[];

  // Bus actions
  addBus: (name: string, type: BusType) => string;
  removeBus: (busId: string) => void;
  updateBus: (busId: string, updates: Partial<Bus>) => void;

  // Send actions
  addSend: (sourceTrackId: string, busId: string) => string;
  removeSend: (sendId: string) => void;
  updateSend: (sendId: string, updates: Partial<SendConfig>) => void;

  // Sidechain actions
  addSidechain: (sourceTrackId: string, targetTrackId: string) => string;
  removeSidechain: (id: string) => void;
  updateSidechain: (id: string, updates: Partial<SidechainConfig>) => void;

  // Group actions
  assignToGroup: (trackId: string, groupBusId: string) => void;
  removeFromGroup: (trackId: string) => void;
}

export const useRoutingStore = create<RoutingStore>((set, get) => ({
  buses: {},
  sends: {},
  sidechains: {},
  groupAssignments: [],

  addBus: (name, type) => {
    const id = generateId('bus');
    const busCount = Object.keys(get().buses).length;
    const color = BUS_COLORS[busCount % BUS_COLORS.length] ?? '#888888';

    const bus: Bus = {
      ...DEFAULT_BUS,
      id,
      name,
      type,
      color,
    };

    routingService.createBus(id, type);

    set((state) => ({
      buses: { ...state.buses, [id]: bus },
    }));

    return id;
  },

  removeBus: (busId) => {
    const state = get();

    // Remove all sends targeting this bus
    const sendsToRemove = Object.values(state.sends)
      .filter((s) => s.busId === busId);
    for (const send of sendsToRemove) {
      routingService.disposeSend(send.id);
    }

    // Remove all group assignments targeting this bus
    const assignmentsToRemove = state.groupAssignments
      .filter((a) => a.groupBusId === busId);
    for (const assignment of assignmentsToRemove) {
      routingService.removeTrackFromGroup(assignment.trackId);
    }

    routingService.disposeBus(busId);

    set((state) => {
      const remainingBuses = Object.fromEntries(
        Object.entries(state.buses).filter(([id]) => id !== busId),
      );
      const remainingSends = Object.fromEntries(
        Object.entries(state.sends).filter(([, s]) => s.busId !== busId),
      );
      return {
        buses: remainingBuses,
        sends: remainingSends,
        groupAssignments: state.groupAssignments
          .filter((a) => a.groupBusId !== busId),
      };
    });
  },

  updateBus: (busId, updates) => {
    const bus = get().buses[busId];
    if (!bus) return;

    if (updates.volume !== undefined) {
      routingService.setBusVolume(busId, updates.volume);
    }
    if (updates.pan !== undefined) {
      routingService.setBusPan(busId, updates.pan);
    }
    if (updates.mute !== undefined) {
      routingService.setBusMute(busId, updates.mute);
    }
    if (updates.solo !== undefined) {
      routingService.setBusSolo(busId, updates.solo);
    }

    set((state) => ({
      buses: {
        ...state.buses,
        [busId]: { ...state.buses[busId]!, ...updates },
      },
    }));
  },

  addSend: (sourceTrackId, busId) => {
    const id = generateId('send');
    const config: SendConfig = {
      id,
      sourceTrackId,
      busId,
      amount: 0.5,
      preFader: false,
      enabled: true,
    };

    routingService.createSend(id, sourceTrackId, busId, config.amount, false);

    set((state) => ({
      sends: { ...state.sends, [id]: config },
    }));

    return id;
  },

  removeSend: (sendId) => {
    routingService.disposeSend(sendId);

    set((state) => ({
      sends: Object.fromEntries(
        Object.entries(state.sends).filter(([id]) => id !== sendId),
      ),
    }));
  },

  updateSend: (sendId, updates) => {
    const send = get().sends[sendId];
    if (!send) return;

    if (updates.amount !== undefined) {
      routingService.updateSendAmount(sendId, updates.amount);
    }

    if (updates.enabled !== undefined && !updates.enabled) {
      routingService.updateSendAmount(sendId, 0);
    } else if (updates.enabled && send.amount > 0) {
      routingService.updateSendAmount(sendId, updates.amount ?? send.amount);
    }

    set((state) => ({
      sends: {
        ...state.sends,
        [sendId]: { ...state.sends[sendId]!, ...updates },
      },
    }));
  },

  addSidechain: (sourceTrackId, targetTrackId) => {
    const id = generateId('sc');
    const config: SidechainConfig = {
      id,
      targetTrackId,
      sourceTrackId,
      threshold: -24,
      ratio: 4,
      attack: 0.01,
      release: 0.1,
      amount: 0.8,
      enabled: true,
    };

    routingService.createSidechain(config);

    set((state) => ({
      sidechains: { ...state.sidechains, [id]: config },
    }));

    return id;
  },

  removeSidechain: (id) => {
    routingService.disposeSidechain(id);

    set((state) => ({
      sidechains: Object.fromEntries(
        Object.entries(state.sidechains).filter(([key]) => key !== id),
      ),
    }));
  },

  updateSidechain: (id, updates) => {
    const sc = get().sidechains[id];
    if (!sc) return;

    const updated = { ...sc, ...updates };
    routingService.updateSidechain(updated);

    set((state) => ({
      sidechains: {
        ...state.sidechains,
        [id]: updated,
      },
    }));
  },

  assignToGroup: (trackId, groupBusId) => {
    const bus = get().buses[groupBusId];
    if (!bus || bus.type !== 'group') return;

    routingService.assignTrackToGroup(trackId, groupBusId);

    set((state) => ({
      groupAssignments: [
        ...state.groupAssignments.filter((a) => a.trackId !== trackId),
        { trackId, groupBusId },
      ],
    }));
  },

  removeFromGroup: (trackId) => {
    routingService.removeTrackFromGroup(trackId);

    set((state) => ({
      groupAssignments: state.groupAssignments
        .filter((a) => a.trackId !== trackId),
    }));
  },
}));
