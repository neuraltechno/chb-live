import { LRUCache } from 'lru-cache';

const options = {
  max: 500,
  // 5 seconds TTL
  ttl: 1000 * 5,
  allowStale: false,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
};

// Global variable to persist cache across hot reloads in development
const globalForCache = global as unknown as {
  gameCache: LRUCache<string, any>;
};

export const gameCache = globalForCache.gameCache || new LRUCache({
  ...options,
  // Allow individual set calls to override TTL
  noDisposeOnSet: true,
});

if (process.env.NODE_ENV !== 'production') {
  globalForCache.gameCache = gameCache;
}
