import type { EngineSnapshot, HotspotDefinition } from './types';

interface InitialState {
  currentNodeId: string;
  flags?: Record<string, boolean>;
  vhsIntensity?: number;
}

export interface StateMachine {
  snapshot(): EngineSnapshot;
  setCurrentNode(nodeId: string): EngineSnapshot;
  setFlag(flag: string, value?: boolean): EngineSnapshot;
  setVhsIntensity(intensity: number): EngineSnapshot;
  applyHotspot(hotspot: HotspotDefinition): EngineSnapshot;
  restore(snapshot: EngineSnapshot): EngineSnapshot;
  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void;
}

export function createStateMachine(initial: InitialState): StateMachine {
  let snapshot: EngineSnapshot = {
    currentNodeId: initial.currentNodeId,
    flags: { ...(initial.flags ?? {}) },
    vhsIntensity: clampIntensity(initial.vhsIntensity ?? 0.72),
  };
  const listeners = new Set<(next: EngineSnapshot) => void>();

  const publish = (): EngineSnapshot => {
    snapshot = { ...snapshot, flags: { ...snapshot.flags } };
    for (const listener of listeners) {
      listener(snapshot);
    }
    return snapshot;
  };

  return {
    snapshot: () => ({ ...snapshot, flags: { ...snapshot.flags } }),
    setCurrentNode(nodeId: string) {
      snapshot.currentNodeId = nodeId;
      return publish();
    },
    setFlag(flag: string, value = true) {
      snapshot.flags[flag] = value;
      return publish();
    },
    setVhsIntensity(intensity: number) {
      snapshot.vhsIntensity = clampIntensity(intensity);
      return publish();
    },
    applyHotspot(hotspot: HotspotDefinition) {
      if (hotspot.setFlag) {
        snapshot.flags[hotspot.setFlag] = true;
      }
      if (hotspot.clearFlag) {
        snapshot.flags[hotspot.clearFlag] = false;
      }
      return publish();
    },
    restore(next: EngineSnapshot) {
      snapshot = {
        currentNodeId: next.currentNodeId,
        flags: { ...next.flags },
        vhsIntensity: clampIntensity(next.vhsIntensity),
        savedAt: next.savedAt,
      };
      return publish();
    },
    subscribe(listener: (next: EngineSnapshot) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function clampIntensity(value: number): number {
  if (Number.isNaN(value)) {
    return 0.72;
  }
  return Math.max(0, Math.min(1, value));
}
