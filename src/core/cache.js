/**
 * Simple in-memory cache with TTL support
 */
export class Cache {
    store = new Map();
    /**
     * Get a cached value
     */
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }
    /**
     * Set a cached value with TTL
     */
    set(key, value, ttlMs) {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }
    /**
     * Get a cached value or set it if not present
     */
    async getOrSet(key, ttlMs, factory) {
        const cached = this.get(key);
        if (cached !== undefined)
            return cached;
        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
    }
    /**
     * Invalidate all keys matching a pattern
     */
    invalidate(pattern) {
        for (const key of this.store.keys()) {
            if (key.includes(pattern)) {
                this.store.delete(key);
            }
        }
    }
    /**
     * Clear all cached values
     */
    clear() {
        this.store.clear();
    }
    /**
     * Get the number of cached entries
     */
    size() {
        return this.store.size;
    }
}
/**
 * Cache TTL constants (in milliseconds)
 */
export const CACHE_TTL = {
    MARKET_INFO: 60 * 1000, // 1 minute
    WALLET_POSITIONS: 5 * 60 * 1000, // 5 minutes
    LEADERBOARD: 60 * 60 * 1000, // 1 hour
    TICK_SIZE: 24 * 60 * 60 * 1000, // 24 hours
};
