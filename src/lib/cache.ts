import { LRUCache } from 'lru-cache';

const options = {
  max: 500,
  // 15 seconds TTL
  ttl: 1000 * 15,
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
};

// Global variable to persist cache across hot reloads in development
const globalForCache = global as unknown as {
  gameCache: LRUCache<string, any>;
};

export const gameCache = globalForCache.gameCache || new LRUCache(options);

if (process.env.NODE_ENV !== 'production') {
  globalForCache.gameCache = gameCache;
}
