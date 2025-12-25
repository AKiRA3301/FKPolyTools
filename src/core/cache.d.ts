/**
 * Simple in-memory cache with TTL support
 */
export declare class Cache {
    private store;
    /**
     * Get a cached value
     */
    get<T>(key: string): T | undefined;
    /**
     * Set a cached value with TTL
     */
    set<T>(key: string, value: T, ttlMs: number): void;
    /**
     * Get a cached value or set it if not present
     */
    getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T>;
    /**
     * Invalidate all keys matching a pattern
     */
    invalidate(pattern: string): void;
    /**
     * Clear all cached values
     */
    clear(): void;
    /**
     * Get the number of cached entries
     */
    size(): number;
}
/**
 * Cache TTL constants (in milliseconds)
 */
export declare const CACHE_TTL: {
    MARKET_INFO: number;
    WALLET_POSITIONS: number;
    LEADERBOARD: number;
    TICK_SIZE: number;
};
