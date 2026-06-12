import type { EngineSnapshot, HotspotDefinition, JournalEntry, PuzzleAction, TimeWindow } from './types';

interface InitialState {
  currentNodeId: string;
  flags?: Record<string, boolean>;
  vhsIntensity?: number;
  activeWindow?: TimeWindow;
  discoveredTimecodes?: TimeWindow[];
  journal?: JournalEntry[];
  completedPuzzles?: PuzzleAction[];
  captionsEnabled?: boolean;
}

export interface StateMachine {
  snapshot(): EngineSnapshot;
  setCurrentNode(nodeId: string): EngineSnapshot;
  setFlag(flag: string, value?: boolean): EngineSnapshot;
  setVhsIntensity(intensity: number): EngineSnapshot;
  setActiveWindow(window: TimeWindow): EngineSnapshot;
  discoverTimecode(window: TimeWindow): EngineSnapshot;
  logJournal(id: string, text: string): EngineSnapshot;
  completePuzzle(action: PuzzleAction): EngineSnapshot;
  setCaptionsEnabled(enabled: boolean): EngineSnapshot;
  applyHotspot(hotspot: HotspotDefinition): EngineSnapshot;
  restore(snapshot: EngineSnapshot): EngineSnapshot;
  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void;
}

export function createStateMachine(initial: InitialState): StateMachine {
  const startingWindow = initial.activeWindow ?? '23:08-23:17';
  let snapshot: EngineSnapshot = {
    currentNodeId: initial.currentNodeId,
    flags: { ...(initial.flags ?? {}) },
    vhsIntensity: clampIntensity(initial.vhsIntensity ?? 0.72),
    activeWindow: startingWindow,
    discoveredTimecodes: uniqueWindows([startingWindow, ...(initial.discoveredTimecodes ?? [])]),
    journal: [...(initial.journal ?? [])],
    completedPuzzles: [...(initial.completedPuzzles ?? [])],
    captionsEnabled: initial.captionsEnabled ?? true,
  };
  const listeners = new Set<(next: EngineSnapshot) => void>();

  const publish = (): EngineSnapshot => {
    snapshot = cloneSnapshot(snapshot);
    for (const listener of listeners) {
      listener(snapshot);
    }
    return snapshot;
  };

  return {
    snapshot: () => cloneSnapshot(snapshot),
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
    setActiveWindow(window: TimeWindow) {
      snapshot.activeWindow = window;
      return publish();
    },
    discoverTimecode(window: TimeWindow) {
      snapshot.discoveredTimecodes = uniqueWindows([...snapshot.discoveredTimecodes, window]);
      return publish();
    },
    logJournal(id: string, text: string) {
      if (!snapshot.journal.some((entry) => entry.id === id)) {
        snapshot.journal.push({ id, text, loggedAt: new Date().toISOString() });
      }
      return publish();
    },
    completePuzzle(action: PuzzleAction) {
      if (!snapshot.completedPuzzles.includes(action)) {
        snapshot.completedPuzzles.push(action);
      }
      return publish();
    },
    setCaptionsEnabled(enabled: boolean) {
      snapshot.captionsEnabled = enabled;
      return publish();
    },
    applyHotspot(hotspot: HotspotDefinition) {
      if (hotspot.setFlag) {
        snapshot.flags[hotspot.setFlag] = true;
      }
      if (hotspot.clearFlag) {
        snapshot.flags[hotspot.clearFlag] = false;
      }
      if (hotspot.journal) {
        this.logJournal(hotspot.journal.id, hotspot.journal.text);
      }
      if (hotspot.discoverTimecode) {
        this.discoverTimecode(hotspot.discoverTimecode);
      }
      return publish();
    },
    restore(next: EngineSnapshot) {
      snapshot = {
        currentNodeId: next.currentNodeId,
        flags: { ...next.flags },
        vhsIntensity: clampIntensity(next.vhsIntensity),
        activeWindow: next.activeWindow ?? '23:08-23:17',
        discoveredTimecodes: uniqueWindows(next.discoveredTimecodes ?? ['23:08-23:17']),
        journal: [...(next.journal ?? [])],
        completedPuzzles: [...(next.completedPuzzles ?? [])],
        captionsEnabled: next.captionsEnabled ?? true,
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

function cloneSnapshot(snapshot: EngineSnapshot): EngineSnapshot {
  return {
    ...snapshot,
    flags: { ...snapshot.flags },
    discoveredTimecodes: [...snapshot.discoveredTimecodes],
    journal: snapshot.journal.map((entry) => ({ ...entry })),
    completedPuzzles: [...snapshot.completedPuzzles],
  };
}

function uniqueWindows(windows: TimeWindow[]): TimeWindow[] {
  return [...new Set(windows)];
}

function clampIntensity(value: number): number {
  if (Number.isNaN(value)) {
    return 0.72;
  }
  return Math.max(0, Math.min(1, value));
}
