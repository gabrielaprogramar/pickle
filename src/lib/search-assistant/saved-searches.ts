import type { SavedSearch, SearchAst } from "./types";

export interface SavedSearchStore {
  save(
    name: string,
    query: string,
    ast: SearchAst,
    userId: string,
    organizationId: string,
  ): SavedSearch;
  list(userId: string, organizationId: string): ReadonlyArray<SavedSearch>;
  rename(id: string, newName: string, userId: string, organizationId: string): SavedSearch | null;
  remove(id: string, userId: string, organizationId: string): boolean;
  get(id: string, userId: string, organizationId: string): SavedSearch | null;
}

let savedIdCounter = 0;

export function createSavedSearchStore(): SavedSearchStore {
  const store = new Map<string, SavedSearch[]>();

  function scopeKey(userId: string, organizationId: string): string {
    return `${organizationId}:${userId}`;
  }

  function save(
    name: string,
    query: string,
    ast: SearchAst,
    userId: string,
    organizationId: string,
  ): SavedSearch {
    const key = scopeKey(userId, organizationId);
    const existingList = store.get(key) ?? [];
    const normalizedName = name.trim();
    const normalizedQuery = query.trim();
    const now = new Date().toISOString();

    const existing = existingList.find(
      (entry) =>
        entry.name.toLowerCase() === normalizedName.toLowerCase() &&
        entry.query === normalizedQuery,
    );
    if (existing) {
      const updated: SavedSearch = {
        ...existing,
        name: normalizedName,
        query: normalizedQuery,
        ast,
        updatedAt: now,
      };
      store.set(
        key,
        existingList.map((entry) => (entry.id === existing.id ? updated : entry)),
      );
      return updated;
    }

    const entry: SavedSearch = {
      id: `saved-${Date.now()}-${savedIdCounter++}`,
      name: normalizedName,
      query: normalizedQuery,
      ast,
      userId,
      organizationId,
      createdAt: now,
      updatedAt: now,
    };
    store.set(key, [entry, ...existingList]);
    return entry;
  }

  function list(userId: string, organizationId: string): ReadonlyArray<SavedSearch> {
    const entries = store.get(scopeKey(userId, organizationId)) ?? [];
    return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function get(id: string, userId: string, organizationId: string): SavedSearch | null {
    const entries = store.get(scopeKey(userId, organizationId)) ?? [];
    return entries.find((entry) => entry.id === id) ?? null;
  }

  function rename(
    id: string,
    newName: string,
    userId: string,
    organizationId: string,
  ): SavedSearch | null {
    const key = scopeKey(userId, organizationId);
    const entries = store.get(key) ?? [];
    const existing = entries.find((entry) => entry.id === id);
    if (!existing) {
      return null;
    }
    const updated: SavedSearch = {
      ...existing,
      name: newName.trim(),
      updatedAt: new Date().toISOString(),
    };
    store.set(
      key,
      entries.map((entry) => (entry.id === id ? updated : entry)),
    );
    return updated;
  }

  function remove(id: string, userId: string, organizationId: string): boolean {
    const key = scopeKey(userId, organizationId);
    const entries = store.get(key) ?? [];
    const remaining = entries.filter((entry) => entry.id !== id);
    if (remaining.length === entries.length) {
      return false;
    }
    store.set(key, remaining);
    return true;
  }

  return { save, list, rename, remove, get };
}
