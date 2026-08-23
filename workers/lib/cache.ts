type CacheEntry = { data: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();

export function cacheGet<T>(key: string, ttlSec: number): { data: T | null; fresh: boolean } {
  const hit = store.get(key);
  if (!hit) return { data: null, fresh: false };
  const fresh = Date.now() < hit.expiresAt;
  return { data: hit.data as T, fresh };
}

export function cacheSet(key: string, data: unknown, ttlSec: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlSec * 1000 });
}

export function cacheGetStale<T>(key: string): T | null {
  const hit = store.get(key);
  return hit ? (hit.data as T) : null;
}
