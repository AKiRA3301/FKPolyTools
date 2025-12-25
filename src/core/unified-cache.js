/**
 * Unified cache interface for poly-sdk
 *
 * Bridges between:
 * 1. Legacy internal Cache (synchronous get/set with millisecond TTL)
 * 2. New CacheAdapter interface (async with second TTL)
 *
 * This allows the SDK to accept external cache adapters while maintaining
 * backward compatibility with existing code.
 */
import { Cache, CACHE_TTL } from './cache.js';
/**
 * Wraps the legacy Cache class to provide async interface
 */
export class LegacyCacheWrapper {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    async get(key) {
        return this.cache.get(key);
    }
    async set(key, value, ttlMs) {
        this.cache.set(key, value, ttlMs);
    }
    async getOrSet(key, ttlMs, factory) {
        return this.cache.getOrSet(key, ttlMs, factory);
    }
    async invalidate(pattern) {
        this.cache.invalidate(pattern);
    }
    clear() {
        this.cache.clear();
    }
}
/**
 * Wraps a CacheAdapter to provide legacy-compatible interface
 *
 * Main differences:
 * - Converts milliseconds to seconds for TTL
 * - Returns undefined instead of null for missing keys
 * - Implements getOrSet helper
 * - Implements pattern-based invalidation (limited support)
 */
export class CacheAdapterWrapper {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    async get(key) {
        const value = await this.adapter.get(key);
        return value ?? undefined;
    }
    async set(key, value, ttlMs) {
        // Convert milliseconds to seconds
        const ttlSeconds = Math.ceil(ttlMs / 1000);
        // Check if this is a CacheManager (has getStats method)
        if ('getStats' in this.adapter) {
            // This is a CacheManager - use CacheSetOptions signature
            await this.adapter.set(key, value, { ttl: ttlSeconds });
        }
        else {
            // This is a regular CacheAdapter - use simple signature
            await this.adapter.set(key, value, ttlSeconds);
        }
    }
    async getOrSet(key, ttlMs, factory) {
        const cached = await this.adapter.get(key);
        if (cached !== null)
            return cached;
        const value = await factory();
        const ttlSeconds = Math.ceil(ttlMs / 1000);
        // Check if this is a CacheManager
        if ('getStats' in this.adapter) {
            // This is a CacheManager
            await this.adapter.set(key, value, { ttl: ttlSeconds });
        }
        else {
            // This is a regular CacheAdapter
            await this.adapter.set(key, value, ttlSeconds);
        }
        return value;
    }
    async invalidate(pattern) {
        // CacheAdapter doesn't have pattern matching
        // Best we can do is warn - this is a limitation
        console.warn(`invalidate(pattern="${pattern}") not fully supported with external cache adapter`);
    }
    clear() {
        void this.adapter.clear?.();
    }
}
/**
 * Create a UnifiedCache from either legacy Cache or CacheAdapter
 */
export function createUnifiedCache(cache) {
    if (!cache) {
        // No cache provided, create default legacy cache
        return new LegacyCacheWrapper(new Cache());
    }
    // Check if it's a CacheAdapter (has async get method)
    if ('get' in cache && typeof cache.get === 'function') {
        const testResult = cache.get('test');
        if (testResult instanceof Promise) {
            // It's a CacheAdapter
            return new CacheAdapterWrapper(cache);
        }
    }
    // It's a legacy Cache
    return new LegacyCacheWrapper(cache);
}
// Re-export CACHE_TTL for convenience
export { CACHE_TTL };
