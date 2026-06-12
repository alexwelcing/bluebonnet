import type { NodeGraph, TimeWindow } from './types';

export interface TimeSeekResult {
  ok: boolean;
  activeWindow: TimeWindow;
  reason?: string;
}

export interface TimeSeekController {
  seek(window: TimeWindow): TimeSeekResult;
  discover(window: TimeWindow): void;
  snapshot(): { activeWindow: TimeWindow; discoveredTimecodes: TimeWindow[] };
}

export function createTimeSeek(graph: NodeGraph, activeWindow = graph.initialWindow, discovered: TimeWindow[] = []): TimeSeekController {
  let current = activeWindow;
  const discoveredSet = new Set<TimeWindow>([graph.initialWindow, activeWindow, ...discovered]);
  const lockedSet = new Set<TimeWindow>(graph.lockedWindows.filter((window) => !discoveredSet.has(window)));

  return {
    seek(window: TimeWindow) {
      if (lockedSet.has(window)) {
        return { ok: false, activeWindow: current, reason: 'That section is the locked nine minutes.' };
      }
      if (!discoveredSet.has(window)) {
        return { ok: false, activeWindow: current, reason: 'TIMESEEK rejects undiscovered tape-time.' };
      }
      current = window;
      return { ok: true, activeWindow: current };
    },
    discover(window: TimeWindow) {
      discoveredSet.add(window);
      lockedSet.delete(window);
    },
    snapshot() {
      return { activeWindow: current, discoveredTimecodes: [...discoveredSet] };
    },
  };
}
