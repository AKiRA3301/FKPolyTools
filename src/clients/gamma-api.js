/**
 * Gamma API Client for Polymarket
 *
 * The Gamma API provides rich market discovery and metadata. Unlike the CLOB API
 * which is focused on trading, Gamma is optimized for browsing, searching, and
 * discovering prediction markets.
 *
 * @remarks
 * - Base URL: https://gamma-api.polymarket.com
 * - Best for: Market discovery, trending markets, event groupings
 * - Rate limits are automatically handled by the RateLimiter
 *
 * @example
 * ```typescript
 * import { GammaApiClient, RateLimiter, Cache } from '@catalyst-team/poly-sdk';
 *
 * const client = new GammaApiClient(new RateLimiter(), new Cache());
 *
 * // Get trending markets by 24h volume
 * const trending = await client.getTrendingMarkets(20);
 *
 * // Search for specific markets
 * const btcMarkets = await client.getMarkets({
 *   active: true,
 *   closed: false,
 *   order: 'volume24hr',
 *   ascending: false,
 *   limit: 10,
 * });
 * ```
 *
 * @see {@link https://docs.polymarket.com/#gamma-api Gamma API Documentation}
 *
 * @module clients/gamma-api
 */
import { ApiType } from '../core/rate-limiter.js';
import { PolymarketError } from '../core/errors.js';
/** Gamma API base URL */
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
// ===== Client =====
/**
 * Gamma API client for market discovery and metadata
 *
 * @remarks
 * Use this client for:
 * - Discovering trending markets
 * - Searching for specific topics
 * - Getting market metadata and statistics
 * - Browsing events and market groupings
 *
 * For orderbook data and trading, use {@link ClobApiClient} and {@link TradingClient}.
 *
 * @example
 * ```typescript
 * const client = new GammaApiClient(rateLimiter, cache);
 *
 * // Find top volume markets
 * const trending = await client.getTrendingMarkets(20);
 * for (const market of trending) {
 *   console.log(market.question, '$' + market.volume24hr.toLocaleString());
 * }
 * ```
 */
export class GammaApiClient {
    rateLimiter;
    cache;
    /**
     * Creates a new Gamma API client
     *
     * @param rateLimiter - Rate limiter instance for API throttling
     * @param cache - Cache instance for storing data (supports both legacy Cache and CacheAdapter)
     */
    constructor(rateLimiter, cache) {
        this.rateLimiter = rateLimiter;
        this.cache = cache;
    }
    // ===== Market Queries =====
    /**
     * Get markets with optional filters and sorting
     *
     * @param params - Search and filter parameters
     * @returns Array of markets matching the criteria
     *
     * @remarks
     * Common sort fields:
     * - `volume24hr` - 24-hour trading volume
     * - `liquidity` - Available liquidity
     * - `endDate` - Market end date
     * - `volume` - Lifetime volume
     *
     * @example
     * ```typescript
     * // Get active markets sorted by 24h volume
     * const markets = await client.getMarkets({
     *   active: true,
     *   closed: false,
     *   order: 'volume24hr',
     *   ascending: false,
     *   limit: 50,
     * });
     *
     * // Search by slug
     * const market = await client.getMarkets({
     *   slug: 'will-btc-reach-100k',
     *   limit: 1,
     * });
     * ```
     */
    async getMarkets(params) {
        const query = new URLSearchParams();
        if (params?.slug)
            query.set('slug', params.slug);
        if (params?.conditionId)
            query.set('condition_id', params.conditionId);
        if (params?.active !== undefined)
            query.set('active', String(params.active));
        if (params?.closed !== undefined)
            query.set('closed', String(params.closed));
        if (params?.limit)
            query.set('limit', String(params.limit));
        if (params?.offset)
            query.set('offset', String(params.offset));
        if (params?.order)
            query.set('order', params.order);
        if (params?.ascending !== undefined)
            query.set('ascending', String(params.ascending));
        return this.rateLimiter.execute(ApiType.GAMMA_API, async () => {
            const response = await fetch(`${GAMMA_API_BASE}/markets?${query}`);
            if (!response.ok)
                throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
            const data = (await response.json());
            if (!Array.isArray(data))
                return [];
            return data.map((item) => this.normalizeMarket(item));
        });
    }
    /**
     * Get a single market by its URL slug
     *
     * @param slug - The URL-friendly market slug
     * @returns The market if found, null otherwise
     *
     * @example
     * ```typescript
     * const market = await client.getMarketBySlug('will-btc-reach-100k');
     * if (market) {
     *   console.log(market.question);
     * }
     * ```
     */
    async getMarketBySlug(slug) {
        const markets = await this.getMarkets({ slug, limit: 1 });
        return markets[0] || null;
    }
    /**
     * Get a single market by condition ID
     *
     * @param conditionId - The unique condition identifier
     * @returns The market if found, null otherwise
     *
     * @remarks
     * For more reliable market data by condition ID, prefer {@link ClobApiClient.getMarket}.
     *
     * @example
     * ```typescript
     * const market = await client.getMarketByConditionId('0x82ace55...');
     * ```
     */
    async getMarketByConditionId(conditionId) {
        const markets = await this.getMarkets({ conditionId, limit: 1 });
        return markets[0] || null;
    }
    // ===== Event Queries =====
    /**
     * Get events with optional filters
     *
     * @param params - Filter parameters
     * @param params.slug - Filter by event slug
     * @param params.active - Filter by active status
     * @param params.limit - Maximum results to return
     * @returns Array of events matching the criteria
     *
     * @example
     * ```typescript
     * // Get all active events
     * const events = await client.getEvents({ active: true, limit: 20 });
     *
     * // Get a specific event by slug
     * const election = await client.getEvents({ slug: '2024-us-election' });
     * ```
     */
    async getEvents(params) {
        const query = new URLSearchParams();
        if (params?.slug)
            query.set('slug', params.slug);
        if (params?.active !== undefined)
            query.set('active', String(params.active));
        if (params?.limit)
            query.set('limit', String(params.limit));
        return this.rateLimiter.execute(ApiType.GAMMA_API, async () => {
            const response = await fetch(`${GAMMA_API_BASE}/events?${query}`);
            if (!response.ok)
                throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
            const data = (await response.json());
            if (!Array.isArray(data))
                return [];
            return data.map((item) => this.normalizeEvent(item));
        });
    }
    /**
     * Get a single event by its URL slug
     *
     * @param slug - The URL-friendly event slug
     * @returns The event if found, null otherwise
     *
     * @example
     * ```typescript
     * const event = await client.getEventBySlug('2024-us-election');
     * if (event) {
     *   console.log(`${event.title} has ${event.markets.length} markets`);
     * }
     * ```
     */
    async getEventBySlug(slug) {
        const events = await this.getEvents({ slug, limit: 1 });
        return events[0] || null;
    }
    /**
     * Get a single event by its ID
     *
     * @param id - The internal event ID
     * @returns The event if found, null otherwise
     *
     * @example
     * ```typescript
     * const event = await client.getEventById('12345');
     * ```
     */
    async getEventById(id) {
        return this.rateLimiter.execute(ApiType.GAMMA_API, async () => {
            const response = await fetch(`${GAMMA_API_BASE}/events/${id}`);
            if (!response.ok) {
                if (response.status === 404)
                    return null;
                throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
            }
            const data = (await response.json());
            return this.normalizeEvent(data);
        });
    }
    // ===== Trending =====
    /**
     * Get trending markets sorted by 24-hour volume
     *
     * @param limit - Maximum number of markets to return (default: 20)
     * @returns Array of active markets sorted by volume
     *
     * @remarks
     * This is a convenience method equivalent to:
     * ```typescript
     * getMarkets({
     *   active: true,
     *   closed: false,
     *   order: 'volume24hr',
     *   ascending: false,
     *   limit,
     * })
     * ```
     *
     * @example
     * ```typescript
     * // Get top 10 trending markets
     * const trending = await client.getTrendingMarkets(10);
     *
     * for (const market of trending) {
     *   console.log(`${market.question}`);
     *   console.log(`  24h Volume: $${market.volume24hr?.toLocaleString()}`);
     *   console.log(`  YES Price: ${(market.outcomePrices[0] * 100).toFixed(1)}%`);
     * }
     * ```
     */
    async getTrendingMarkets(limit = 20) {
        return this.getMarkets({
            active: true,
            closed: false,
            order: 'volume24hr',
            ascending: false,
            limit,
        });
    }
    // ===== Data Normalization =====
    normalizeMarket(m) {
        return {
            id: String(m.id || ''),
            conditionId: String(m.conditionId || ''),
            slug: String(m.slug || ''),
            question: String(m.question || ''),
            description: m.description ? String(m.description) : undefined,
            outcomes: this.parseJsonArray(m.outcomes, ['Yes', 'No']),
            outcomePrices: this.parseJsonArray(m.outcomePrices, [0.5, 0.5]).map(Number),
            volume: Number(m.volume || 0),
            volume24hr: m.volume24hr !== undefined ? Number(m.volume24hr) : undefined,
            volume1wk: m.volume1wk !== undefined ? Number(m.volume1wk) : undefined,
            liquidity: Number(m.liquidity || 0),
            spread: m.spread !== undefined ? Number(m.spread) : undefined,
            oneDayPriceChange: m.oneDayPriceChange !== undefined
                ? Number(m.oneDayPriceChange)
                : undefined,
            oneWeekPriceChange: m.oneWeekPriceChange !== undefined
                ? Number(m.oneWeekPriceChange)
                : undefined,
            lastTradePrice: m.lastTradePrice !== undefined ? Number(m.lastTradePrice) : undefined,
            bestBid: m.bestBid !== undefined ? Number(m.bestBid) : undefined,
            bestAsk: m.bestAsk !== undefined ? Number(m.bestAsk) : undefined,
            endDate: new Date(String(m.endDate || Date.now())),
            active: Boolean(m.active),
            closed: Boolean(m.closed),
            image: m.image ? String(m.image) : undefined,
            icon: m.icon ? String(m.icon) : undefined,
            tags: m.tags ? this.parseJsonArray(m.tags, []) : undefined,
        };
    }
    normalizeEvent(e) {
        const markets = e.markets;
        return {
            id: String(e.id || ''),
            slug: String(e.slug || ''),
            title: String(e.title || ''),
            description: e.description ? String(e.description) : undefined,
            markets: Array.isArray(markets)
                ? markets.map((m) => this.normalizeMarket(m))
                : [],
            startDate: e.startDate ? new Date(String(e.startDate)) : undefined,
            endDate: e.endDate ? new Date(String(e.endDate)) : undefined,
            image: e.image ? String(e.image) : undefined,
        };
    }
    parseJsonArray(value, fallback) {
        if (Array.isArray(value))
            return value;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch {
                return fallback;
            }
        }
        return fallback;
    }
}
