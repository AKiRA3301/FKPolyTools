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
import { RateLimiter } from '../core/rate-limiter.js';
import type { UnifiedCache } from '../core/unified-cache.js';
/**
 * Market information from the Gamma API
 *
 * @remarks
 * Gamma markets include rich metadata like volume statistics, price changes,
 * and liquidity metrics that are useful for market discovery and analysis.
 */
export interface GammaMarket {
    /**
     * Internal Gamma market ID
     */
    id: string;
    /**
     * Condition ID matching the CLOB API
     * @example "0x82ace55cdcba920112a2b3548f21e6e117730144db4dd580456aaecf1a2ad751"
     */
    conditionId: string;
    /**
     * URL-friendly market slug
     * @example "will-btc-reach-100k-by-end-of-2024"
     */
    slug: string;
    /**
     * The prediction market question
     */
    question: string;
    /**
     * Detailed description and resolution criteria
     */
    description?: string;
    /**
     * Outcome names (typically ["Yes", "No"])
     */
    outcomes: string[];
    /**
     * Current prices for each outcome (0-1 range)
     * @example [0.65, 0.35] for 65% YES probability
     */
    outcomePrices: number[];
    /**
     * Total trading volume (lifetime, in USDC)
     */
    volume: number;
    /**
     * 24-hour trading volume (in USDC)
     */
    volume24hr?: number;
    /**
     * 7-day trading volume (in USDC)
     */
    volume1wk?: number;
    /**
     * Current available liquidity (in USDC)
     */
    liquidity: number;
    /**
     * Bid-ask spread (as decimal, e.g., 0.02 = 2%)
     */
    spread?: number;
    /**
     * 24-hour price change (as decimal, e.g., 0.05 = +5%)
     */
    oneDayPriceChange?: number;
    /**
     * 7-day price change (as decimal)
     */
    oneWeekPriceChange?: number;
    /**
     * Last traded price for the YES outcome
     */
    lastTradePrice?: number;
    /**
     * Best bid price for YES outcome
     */
    bestBid?: number;
    /**
     * Best ask price for YES outcome
     */
    bestAsk?: number;
    /**
     * Market end/resolution date
     */
    endDate: Date;
    /**
     * Whether the market is currently active
     */
    active: boolean;
    /**
     * Whether the market has been resolved
     */
    closed: boolean;
    /**
     * URL to market image
     */
    image?: string;
    /**
     * URL to market icon
     */
    icon?: string;
    /**
     * Category tags (e.g., ["crypto", "bitcoin", "finance"])
     */
    tags?: string[];
}
/**
 * Event grouping from the Gamma API
 *
 * @remarks
 * Events group related markets together. For example, a "2024 US Election"
 * event might contain markets for each candidate and related predictions.
 */
export interface GammaEvent {
    /**
     * Internal Gamma event ID
     */
    id: string;
    /**
     * URL-friendly event slug
     */
    slug: string;
    /**
     * Event title
     * @example "2024 US Presidential Election"
     */
    title: string;
    /**
     * Event description
     */
    description?: string;
    /**
     * Markets belonging to this event
     */
    markets: GammaMarket[];
    /**
     * Event start date
     */
    startDate?: Date;
    /**
     * Event end date
     */
    endDate?: Date;
    /**
     * URL to event image
     */
    image?: string;
}
/**
 * Parameters for searching/filtering markets
 */
export interface MarketSearchParams {
    /**
     * Filter by market slug
     */
    slug?: string;
    /**
     * Filter by condition ID
     */
    conditionId?: string;
    /**
     * Filter by active status
     */
    active?: boolean;
    /**
     * Filter by closed status
     */
    closed?: boolean;
    /**
     * Maximum number of results (default: 100)
     */
    limit?: number;
    /**
     * Offset for pagination
     */
    offset?: number;
    /**
     * Sort field (e.g., "volume24hr", "liquidity", "endDate")
     */
    order?: string;
    /**
     * Sort direction (true = ascending, false = descending)
     */
    ascending?: boolean;
}
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
export declare class GammaApiClient {
    private rateLimiter;
    private cache;
    /**
     * Creates a new Gamma API client
     *
     * @param rateLimiter - Rate limiter instance for API throttling
     * @param cache - Cache instance for storing data (supports both legacy Cache and CacheAdapter)
     */
    constructor(rateLimiter: RateLimiter, cache: UnifiedCache);
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
    getMarkets(params?: MarketSearchParams): Promise<GammaMarket[]>;
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
    getMarketBySlug(slug: string): Promise<GammaMarket | null>;
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
    getMarketByConditionId(conditionId: string): Promise<GammaMarket | null>;
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
    getEvents(params?: {
        slug?: string;
        active?: boolean;
        limit?: number;
    }): Promise<GammaEvent[]>;
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
    getEventBySlug(slug: string): Promise<GammaEvent | null>;
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
    getEventById(id: string): Promise<GammaEvent | null>;
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
    getTrendingMarkets(limit?: number): Promise<GammaMarket[]>;
    private normalizeMarket;
    private normalizeEvent;
    private parseJsonArray;
}
