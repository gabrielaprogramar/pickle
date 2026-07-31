import type { MaintenanceMemoryEntry } from "./types";

export interface MaintenanceMemory {
  remember(vesselId: string, key: string, value: string): void;
  recall(vesselId: string, key: string): string | null;
  list(vesselId: string): ReadonlyArray<MaintenanceMemoryEntry>;
  clear(vesselId: string): void;
  hasData(vesselId: string): boolean;
}

const MAX_ENTRIES_PER_VESSEL = 25;

export function createMaintenanceMemory(): MaintenanceMemory {
  const store = new Map<string, MaintenanceMemoryEntry[]>();

  function remember(vesselId: string, key: string, value: string): void {
    const entries = store.get(vesselId) ?? [];
    const timestamp = new Date().toISOString();
    const existing = entries.find((e) => e.key === key);
    let next: MaintenanceMemoryEntry[];
    if (existing) {
      next = entries.map((e) =>
        e.key === key ? { ...e, value, updatedAt: timestamp } : e,
      );
    } else {
      next = [...entries, { key, value, updatedAt: timestamp }];
      if (next.length > MAX_ENTRIES_PER_VESSEL) {
        next = next.slice(next.length - MAX_ENTRIES_PER_VESSEL);
      }
    }
    store.set(vesselId, next);
  }

  function recall(vesselId: string, key: string): string | null {
    const entries = store.get(vesselId) ?? [];
    const found = entries.find((e) => e.key === key);
    return found ? found.value : null;
  }

  function list(vesselId: string): ReadonlyArray<MaintenanceMemoryEntry> {
    return store.get(vesselId) ?? [];
  }

  function clear(vesselId: string): void {
    store.delete(vesselId);
  }

  function hasData(vesselId: string): boolean {
    return (store.get(vesselId) ?? []).length > 0;
  }

  return { remember, recall, list, clear, hasData };
}
