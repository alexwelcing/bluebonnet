import type { TimeWindow } from './types';

export const DEFAULT_TIME_WINDOW: TimeWindow = '20:08-20:17';
export const FINAL_TIME_WINDOW: TimeWindow = '20:26-20:35';
export const TIME_WINDOWS = ['20:08-20:17', '20:17-20:26', '20:26-20:35'] as const satisfies readonly TimeWindow[];
export const lockedByDefaultWindows = [FINAL_TIME_WINDOW] as const satisfies readonly TimeWindow[];

export const timeWindowPositions: Record<TimeWindow, number> = {
  '20:08-20:17': 0,
  '20:17-20:26': 1,
  '20:26-20:35': 2,
};

const assetSuffixes: Record<TimeWindow, string> = {
  '20:08-20:17': '2008-2017',
  '20:17-20:26': '2017-2026',
  '20:26-20:35': '2026-2035',
};

export function timeWindowIndex(window: TimeWindow): number {
  return timeWindowPositions[window];
}

export function windowAssetSuffix(window: TimeWindow): string {
  return assetSuffixes[window];
}

export function uniqueTimeWindows(windows: readonly TimeWindow[]): TimeWindow[] {
  const discovered = new Set(windows);
  return TIME_WINDOWS.filter((window) => discovered.has(window));
}

export function nearestTimeWindow(candidates: readonly TimeWindow[], target: TimeWindow): TimeWindow | undefined {
  const available = new Set(candidates);
  const targetIndex = timeWindowIndex(target);
  return TIME_WINDOWS.filter((window) => available.has(window)).sort(
    (a, b) => Math.abs(timeWindowIndex(a) - targetIndex) - Math.abs(timeWindowIndex(b) - targetIndex),
  )[0];
}
