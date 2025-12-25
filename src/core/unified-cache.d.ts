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
import type { CacheAdapter } from './cache-adapter-types.js';
import { Cache, CACHE_TTL } from './cache.js';
/**
 * Unified cache interface that works with both legacy Cache and CacheAdapter
 *
 * Key features:
 * - Async API (compatible with CacheAdapter)
 * - Millisecond TTL (compatible with existing SDK code)
 * - getOrSet helper for cache-aside pattern
 */
export interface UnifiedCache {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttlMs: number): Promise<void>;
    getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T>;
    invalidate(pattern: string): Promise<void>;
    clear(): void;
}
/**
 * Wraps the legacy Cache class to provide async interface
 */
export declare class LegacyCacheWrapper implements UnifiedCache {
    private cache;
    constructor(cache: Cache);
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttlMs: number): Promise<void>;
    getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T>;
    invalidate(pattern: string): Promise<void>;
    clear(): void;
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
export declare class CacheAdapterWrapper implements UnifiedCache {
    private adapter;
    constructor(adapter: CacheAdapter);
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttlMs: number): Promise<void>;
    getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T>;
    invalidate(pattern: string): Promise<void>;
    clear(): void;
}
/**
 * Create a UnifiedCache from either legacy Cache or CacheAdapter
 */
export declare function createUnifiedCache(cache?: CacheAdapter | Cache): UnifiedCache;
export { CACHE_TTL };
