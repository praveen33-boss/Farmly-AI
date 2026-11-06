/**
 * In-memory TTL Cache with stale-while-error support.
 * Complies with hackathon rule: honest labelling of stale results ("stale": true with "fetched_at").
 */
class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  set(key, data, ttlSeconds = 600) {
    const now = Date.now();
    this.store.set(key, {
      data,
      fetched_at: new Date(now).toISOString(),
      expires_at: now + ttlSeconds * 1000,
    });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    const isStale = Date.now() > entry.expires_at;
    return {
      data: entry.data,
      stale: isStale,
      fetched_at: entry.fetched_at,
    };
  }

  getFresh(key) {
    const entry = this.get(key);
    if (!entry || entry.stale) return null;
    return entry;
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

export const weatherCache = new MemoryCache();
export const mandiCache = new MemoryCache();
export const geocodeCache = new MemoryCache();
export const statusCache = new MemoryCache();
export const locationCache = new MemoryCache();
export const schemesCache = new MemoryCache();
