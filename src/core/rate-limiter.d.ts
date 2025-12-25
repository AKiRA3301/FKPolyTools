/**
 * Rate Limiter for Polymarket APIs
 * - Data API: 100ms minimum interval
 * - Gamma API: 10 req/s
 * - CLOB API: 10 req/s
 */
export declare enum ApiType {
    DATA_API = "data-api",
    GAMMA_API = "gamma-api",
    CLOB_API = "clob-api"
}
export declare class RateLimiter {
    private limiters;
    constructor();
    /**
     * Execute a function with rate limiting
     */
    execute<T>(api: ApiType, fn: () => Promise<T>): Promise<T>;
    /**
     * Execute multiple functions in order with rate limiting
     */
    executeBatch<T>(api: ApiType, fns: (() => Promise<T>)[]): Promise<T[]>;
    /**
     * Get current limiter statistics
     */
    getStats(api: ApiType): {
        running: number;
        queued: number;
    } | null;
}
