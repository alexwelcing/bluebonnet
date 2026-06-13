import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_WINDOW,
  FINAL_TIME_WINDOW,
  TIME_WINDOWS,
  lockedByDefaultWindows,
  nearestTimeWindow,
  timeWindowIndex,
  timeWindowPositions,
  uniqueTimeWindows,
  windowAssetSuffix,
} from '../engine/timeWindows';
import type { TimeWindow } from '../engine/types';

describe('canonical tape time-window utilities', () => {
  it('defines one ordered source of truth for all tape windows', () => {
    expect(DEFAULT_TIME_WINDOW).toBe('20:08-20:17');
    expect(FINAL_TIME_WINDOW).toBe('20:26-20:35');
    expect(TIME_WINDOWS).toEqual(['20:08-20:17', '20:17-20:26', '20:26-20:35']);
    expect(timeWindowPositions).toEqual({
      '20:08-20:17': 0,
      '20:17-20:26': 1,
      '20:26-20:35': 2,
    });
    expect(lockedByDefaultWindows).toEqual(['20:26-20:35']);
  });

  it('maps tape windows to asset suffixes used by stills and loops', () => {
    expect(windowAssetSuffix('20:08-20:17')).toBe('2008-2017');
    expect(windowAssetSuffix('20:17-20:26')).toBe('2017-2026');
    expect(windowAssetSuffix('20:26-20:35')).toBe('2026-2035');
  });

  it('deduplicates windows without changing chronological order', () => {
    const unordered: TimeWindow[] = ['20:17-20:26', '20:08-20:17', '20:17-20:26', '20:26-20:35'];
    expect(uniqueTimeWindows(unordered)).toEqual(['20:08-20:17', '20:17-20:26', '20:26-20:35']);
  });

  it('chooses nearest defined windows deterministically using canonical order', () => {
    expect(timeWindowIndex('20:17-20:26')).toBe(1);
    expect(nearestTimeWindow(['20:08-20:17', '20:26-20:35'], '20:17-20:26')).toBe('20:08-20:17');
    expect(nearestTimeWindow(['20:26-20:35'], '20:17-20:26')).toBe('20:26-20:35');
    expect(nearestTimeWindow([], '20:17-20:26')).toBeUndefined();
  });
});
