import type { EngineSnapshot, StorageLike } from './types';

export const SAVE_KEY = 'bluebonnet.engine.snapshot.v1';

export function saveSnapshot(snapshot: EngineSnapshot, storage: StorageLike = window.localStorage): EngineSnapshot {
  const saved = { ...snapshot, flags: { ...snapshot.flags }, savedAt: new Date().toISOString() };
  storage.setItem(SAVE_KEY, JSON.stringify(saved));
  return saved;
}

export function loadSnapshot(storage: StorageLike = window.localStorage): EngineSnapshot | undefined {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return undefined;
  }
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as EngineSnapshot;
    if (!parsed || typeof parsed !== 'object' || !parsed.currentNodeId || typeof parsed.flags !== 'object' || typeof parsed.vhsIntensity !== 'number') {
      throw new Error('Stored Bluebonnet save is malformed.');
    }
    return parsed;
  } catch {
    // A corrupted or outdated save must never brick the deck; discard it and boot fresh.
    try {
      storage.removeItem(SAVE_KEY);
    } catch {
      // storage unavailable — nothing to clean up
    }
    return undefined;
  }
}

export function clearSnapshot(storage: StorageLike = window.localStorage): void {
  storage.removeItem(SAVE_KEY);
}
