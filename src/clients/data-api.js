/**
 * Data API Client for Polymarket
 * Handles: positions, activity, trades, leaderboard
 */
import { ApiType } from '../core/rate-limiter.js';
import { CACHE_TTL } from '../core/unified-cache.js';
import { PolymarketError } from '../core/errors.js';
const DATA_API_BASE = 'https://data-api.polymarket.com';
// ===== Client =====
export class DataApiClient {
    rateLimiter;
    cache;
    constructor(rateLimiter, cache) {
        this.rateLimiter = rateLimiter;
        this.cache = cache;
    }
    // ===== Wallet-related =====
    /**
     * Get positions for a wallet address
     */
    async getPositions(address) {
        return this.rateLimiter.execute(ApiType.DATA_API, async () => {
            const response = await fetch(`${DATA_API_BASE}/positions?user=${address}`);
            if (!response.ok)
                throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
            const data = (await response.json());
            return this.normalizePositions(data);
        });
    }
    /**
     * Get activity for a wallet address
     */
    async getActivity(address, params) {
        const query = new URLSearchParams({
            user: address,
            limit: String(params?.limit || 100),
            ...(params?.type && { type: params.type }),
        });
        return this.rateLimiter.execute(ApiType.DATA_API, async () => {
            const response = await fetch(`${DATA_API_BASE}/activity?${query}`);
            if (!response.ok)
                throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
            const data = (await response.json());
            return this.normalizeActivities(data);
        });
    }
    // ===== Trade-related =====
    /**
     * Get recent trades
     */
    async getTrades(params) {
        const query = new URLSearchParams({
            limit: String(params?.limit || 1000),
            ...(params?.market && { market: params.market }),
        });
        return this.rateLimiter.execute(ApiType.DATA_API, async () => {
            const response = await fetch(`${DATA_API_BASE}/trades?${query}`);
            if (!response.ok)
                throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
            const data = (await response.json());
            return this.normalizeTrades(data);
        });
    }
    /**
     * Get trades for a specific market
     */
    async getTradesByMarket(conditionId, limit = 500) {
        return this.getTrades({ market: conditionId, limit });
    }
    // ===== Leaderboard =====
    /**
     * Get leaderboard page
     */
    async getLeaderboard(params) {
        const limit = params?.limit || 50;
        const offset = params?.offset || 0;
        const cacheKey = `leaderboard:${offset}:${limit}`;
        return this.cache.getOrSet(cacheKey, CACHE_TTL.LEADERBOARD, async () => {
            const query = new URLSearchParams({
                limit: String(limit),
                offset: String(offset),
            });
            return this.rateLimiter.execute(ApiType.DATA_API, async () => {
                const response = await fetch(`${DATA_API_BASE}/v1/leaderboard?${query}`);
                if (!response.ok)
                    throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
                const data = (await response.json());
                const entries = this.normalizeLeaderboardEntries(data);
                return {
                    entries,
                    total: entries.length + offset, // Approximate - API doesn't provide total
                    offset,
                    limit,
                };
            });
        });
    }
    /**
     * Get all leaderboard entries up to a max count
     */
    async getAllLeaderboard(maxEntries = 500) {
        const all = [];
        let offset = 0;
        const limit = 50;
        while (all.length < maxEntries) {
            const page = await this.getLeaderboard({ limit, offset });
            all.push(...page.entries);
            if (page.entries.length < limit)
                break;
            offset += limit;
        }
        return all.slice(0, maxEntries);
    }
    // ===== Data Normalization =====
    normalizePositions(data) {
        if (!Array.isArray(data))
            return [];
        return data.map((item) => {
            const p = item;
            return {
                // Wallet identifier
                proxyWallet: p.proxyWallet !== undefined ? String(p.proxyWallet) : undefined,
                // Core identifiers
                asset: String(p.asset || ''),
                conditionId: String(p.conditionId || ''),
                outcome: String(p.outcome || ''),
                outcomeIndex: typeof p.outcomeIndex === 'number'
                    ? p.outcomeIndex
                    : p.outcome === 'Yes'
                        ? 0
                        : 1,
                // Position data
                size: Number(p.size),
                avgPrice: Number(p.avgPrice),
                curPrice: p.curPrice !== undefined ? Number(p.curPrice) : undefined,
                totalBought: p.totalBought !== undefined ? Number(p.totalBought) : undefined,
                // Value calculations
                initialValue: p.initialValue !== undefined ? Number(p.initialValue) : undefined,
                currentValue: p.currentValue !== undefined ? Number(p.currentValue) : undefined,
                cashPnl: p.cashPnl !== undefined ? Number(p.cashPnl) : undefined,
                percentPnl: p.percentPnl !== undefined ? Number(p.percentPnl) : undefined,
                realizedPnl: p.realizedPnl !== undefined ? Number(p.realizedPnl) : undefined,
                percentRealizedPnl: p.percentRealizedPnl !== undefined ? Number(p.percentRealizedPnl) : undefined,
                // Market metadata
                title: String(p.title || ''),
                slug: p.slug !== undefined ? String(p.slug) : undefined,
                icon: p.icon !== undefined ? String(p.icon) : undefined,
                eventId: p.eventId !== undefined ? String(p.eventId) : undefined,
                eventSlug: p.eventSlug !== undefined ? String(p.eventSlug) : undefined,
                // Opposite side info
                oppositeOutcome: p.oppositeOutcome !== undefined ? String(p.oppositeOutcome) : undefined,
                oppositeAsset: p.oppositeAsset !== undefined ? String(p.oppositeAsset) : undefined,
                // Status fields
                redeemable: p.redeemable !== undefined ? Boolean(p.redeemable) : undefined,
                mergeable: p.mergeable !== undefined ? Boolean(p.mergeable) : undefined,
                endDate: p.endDate !== undefined ? String(p.endDate) : undefined,
                negativeRisk: p.negativeRisk !== undefined ? Boolean(p.negativeRisk) : undefined,
            };
        });
    }
    normalizeActivities(data) {
        if (!Array.isArray(data))
            return [];
        return data.map((item) => {
            const a = item;
            return {
                // Transaction type
                type: String(a.type),
                side: String(a.side),
                // Trade data
                size: Number(a.size),
                price: Number(a.price),
                usdcSize: a.usdcSize !== undefined
                    ? Number(a.usdcSize)
                    : Number(a.size) * Number(a.price),
                // Market identifiers
                asset: String(a.asset || ''),
                conditionId: String(a.conditionId || ''),
                outcome: String(a.outcome || ''),
                outcomeIndex: a.outcomeIndex !== undefined ? Number(a.outcomeIndex) : undefined,
                // Transaction info
                timestamp: this.normalizeTimestamp(a.timestamp),
                transactionHash: String(a.transactionHash || ''),
                // Market metadata
                title: a.title !== undefined ? String(a.title) : undefined,
                slug: a.slug !== undefined ? String(a.slug) : undefined,
                // Trader info
                name: a.name !== undefined ? String(a.name) : undefined,
            };
        });
    }
    normalizeTrades(data) {
        if (!Array.isArray(data))
            return [];
        return data.map((item) => {
            const t = item;
            return {
                // Identifiers
                id: t.id !== undefined ? String(t.id) : undefined,
                market: String(t.market || t.conditionId || ''),
                asset: String(t.asset || ''),
                // Trade data
                side: String(t.side),
                price: Number(t.price),
                size: Number(t.size),
                outcome: String(t.outcome || ''),
                outcomeIndex: typeof t.outcomeIndex === 'number'
                    ? t.outcomeIndex
                    : t.outcome === 'Yes'
                        ? 0
                        : 1,
                // Transaction info
                timestamp: this.normalizeTimestamp(t.timestamp),
                transactionHash: String(t.transactionHash || ''),
                proxyWallet: t.proxyWallet !== undefined ? String(t.proxyWallet) : undefined,
                // Market metadata
                title: t.title !== undefined ? String(t.title) : undefined,
                slug: t.slug !== undefined ? String(t.slug) : undefined,
                icon: t.icon !== undefined ? String(t.icon) : undefined,
                eventSlug: t.eventSlug !== undefined ? String(t.eventSlug) : undefined,
                // Trader info
                name: t.name !== undefined ? String(t.name) : undefined,
                pseudonym: t.pseudonym !== undefined ? String(t.pseudonym) : undefined,
                bio: t.bio !== undefined ? String(t.bio) : undefined,
                profileImage: t.profileImage !== undefined ? String(t.profileImage) : undefined,
                profileImageOptimized: t.profileImageOptimized !== undefined ? String(t.profileImageOptimized) : undefined,
            };
        });
    }
    normalizeTimestamp(ts) {
        if (typeof ts === 'number') {
            // If timestamp is in seconds, convert to milliseconds
            return ts < 1e12 ? ts * 1000 : ts;
        }
        if (typeof ts === 'string') {
            const num = parseInt(ts, 10);
            return num < 1e12 ? num * 1000 : num;
        }
        return Date.now();
    }
    normalizeLeaderboardEntries(data) {
        if (!Array.isArray(data))
            return [];
        return data.map((item) => {
            const e = item;
            return {
                // Wallet identifier
                address: String(e.proxyWallet || e.address || ''),
                // Ranking data
                rank: typeof e.rank === 'number' ? e.rank : parseInt(String(e.rank), 10) || 0,
                pnl: Number(e.pnl) || 0,
                volume: Number(e.vol || e.volume) || 0,
                // User profile
                userName: e.userName !== undefined ? String(e.userName) : undefined,
                xUsername: e.xUsername !== undefined ? String(e.xUsername) : undefined,
                verifiedBadge: Boolean(e.verifiedBadge),
                profileImage: e.profileImage !== undefined ? String(e.profileImage) : undefined,
                // Activity counts (optional - API often returns null)
                positions: e.positions != null ? Number(e.positions) : undefined,
                trades: e.trades != null ? Number(e.trades) : undefined,
            };
        });
    }
}
