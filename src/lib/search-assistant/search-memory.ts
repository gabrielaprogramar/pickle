import type { RecentSearch, SearchEntity } from "./types";

export interface SearchMemory {
  addRecent(
    query: string,
    entity: SearchEntity | null,
    userId: string,
    organizationId: string,
    resultCount: number,
  ): RecentSearch;
  listRecent(
    userId: string,
    organizationId: string,
    limit?: number,
  ): ReadonlyArray<RecentSearch>;
  clearRecent(userId: string, organizationId: string): void;
}

const MAX_RECENT_PER_USER = 20;

let recentIdCounter = 0;

export function createSearchMemory(): SearchMemory {
  const store = new Map<string, RecentSearch[]>();

  function scopeKey(userId: string, organizationId: string): string {
    return `${organizationId}:${userId}`;
  }

  function addRecent(
    query: string,
    entity: SearchEntity | null,
    userId: string,
    organizationId: string,
    resultCount: number,
  ): RecentSearch {
    const key = scopeKey(userId, organizationId);
    const normalizedQuery = query.trim().replace(/\s+/g, " ");
    const existingList = store.get(key) ?? [];
    const timestamp = new Date().toISOString();

    const existing = existingList.find(
      (entry) => entry.query.toLowerCase() === normalizedQuery.toLowerCase(),
    );
    if (existing) {
      const updated: RecentSearch = {
        ...existing,
        entity: entity ?? existing.entity,
        resultCount,
        timestamp,
      };
      store.set(key, [updated, ...existingList.filter((entry) => entry.id !== existing.id)]);
      return updated;
    }

    const entry: RecentSearch = {
      id: `recent-${Date.now()}-${recentIdCounter++}`,
      query: normalizedQuery,
      entity,
      userId,
      organizationId,
      timestamp,
      resultCount,
    };
    const next = [entry, ...existingList];
    if (next.length > MAX_RECENT_PER_USER) {
      next.length = MAX_RECENT_PER_USER;
    }
    store.set(key, next);
    return entry;
  }

  function listRecent(
    userId: string,
    organizationId: string,
    limit: number = MAX_RECENT_PER_USER,
  ): ReadonlyArray<RecentSearch> {
    const entries = store.get(scopeKey(userId, organizationId)) ?? [];
    return entries.slice(0, Math.max(0, limit));
  }

  function clearRecent(userId: string, organizationId: string): void {
    store.delete(scopeKey(userId, organizationId));
  }

  return { addRecent, listRecent, clearRecent };
}
