import type { JournalEntry } from './types';

export interface JournalStore {
  log(id: string, text: string): JournalEntry;
  entries(): JournalEntry[];
}

export function createJournal(initial: JournalEntry[] = []): JournalStore {
  const entries = [...initial];
  return {
    log(id: string, text: string) {
      const existing = entries.find((entry) => entry.id === id);
      if (existing) {
        return existing;
      }
      const entry = { id, text, loggedAt: new Date().toISOString() };
      entries.push(entry);
      return entry;
    },
    entries() {
      return entries.map((entry) => ({ ...entry }));
    },
  };
}
