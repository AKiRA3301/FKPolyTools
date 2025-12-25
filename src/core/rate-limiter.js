/**
 * Rate Limiter for Polymarket APIs
 * - Data API: 100ms minimum interval
 * - Gamma API: 10 req/s
 * - CLOB API: 10 req/s
 */
import Bottleneck from 'bottleneck';
export var ApiType;
(function (ApiType) {
    ApiType["DATA_API"] = "data-api";
    ApiType["GAMMA_API"] = "gamma-api";
    ApiType["CLOB_API"] = "clob-api";
})(ApiType || (ApiType = {}));
const API_LIMITS = {
    [ApiType.DATA_API]: {
        minTime: 100, // 100ms minimum interval
        maxConcurrent: 5,
    },
    [ApiType.GAMMA_API]: {
        reservoir: 10,
        reservoirRefreshAmount: 10,
        reservoirRefreshInterval: 1000,
    },
    [ApiType.CLOB_API]: {
        reservoir: 10,
        reservoirRefreshAmount: 10,
        reservoirRefreshInterval: 1000,
    },
};
export class RateLimiter {
    limiters = new Map();
    constructor() {
        for (const [type, config] of Object.entries(API_LIMITS)) {
            this.limiters.set(type, new Bottleneck(config));
        }
    }
    /**
     * Execute a function with rate limiting
     */
    async execute(api, fn) {
        const limiter = this.limiters.get(api);
        if (!limiter)
            throw new Error(`Unknown API type: ${api}`);
        return limiter.schedule(fn);
    }
    /**
     * Execute multiple functions in order with rate limiting
     */
    async executeBatch(api, fns) {
        const results = [];
        for (const fn of fns) {
            results.push(await this.execute(api, fn));
        }
        return results;
    }
    /**
     * Get current limiter statistics
     */
    getStats(api) {
        const limiter = this.limiters.get(api);
        if (!limiter)
            return null;
        const counts = limiter.counts();
        return {
            running: counts.RUNNING,
            queued: counts.QUEUED,
        };
    }
}
