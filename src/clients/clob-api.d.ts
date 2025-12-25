/**
 * CLOB API Client for Polymarket
 *
 * The Central Limit Order Book (CLOB) API provides access to Polymarket's
 * trading infrastructure. This client handles market information retrieval
 * and orderbook data.
 *
 * @remarks
 * - Base URL: https://clob.polymarket.com
 * - Rate limits are automatically handled by the RateLimiter
 * - Market data is cached to reduce API calls
 *
 * @example
 * ```typescript
 * import { ClobApiClient, RateLimiter, Cache } from '@catalyst-team/poly-sdk';
 *
 * const client = new ClobApiClient(new RateLimiter(), new Cache());
 *
 * // Get market info
 * const market = await client.getMarket('0x123...');
 * console.log(market.question);
 *
 * // Get orderbook
 * const orderbook = await client.getOrderbook(market.tokens[0].tokenId);
 * console.log('Best bid:', orderbook.bids[0]);
 * ```
 *
 * @see {@link https://docs.polymarket.com/#clob-api CLOB API Documentation}
 *
 * @module clients/clob-api
 */
import { RateLimiter } from '../core/rate-limiter.js';
import type { UnifiedCache } from '../core/unified-cache.js';
import type { ProcessedOrderbook } from '../core/types.js';
/**
 * Market information from the CLOB API
 *
 * @remarks
 * A market represents a binary prediction market with YES/NO outcomes.
 * Each outcome has its own ERC-1155 token that can be traded.
 */
export interface ClobMarket {
    conditionId: string;
    questionId?: string;
    marketSlug: string;
    question: string;
    description?: string;
    image?: string;
    icon?: string;
    tokens: ClobToken[];
    tags?: string[];
    active: boolean;
    closed: boolean;
    archived?: boolean;
    acceptingOrders: boolean;
    acceptingOrderTimestamp?: string;
    enableOrderBook?: boolean;
    minimumOrderSize?: number;
    minimumTickSize?: number;
    makerBaseFee?: number;
    takerBaseFee?: number;
    endDateIso?: string | null;
    gameStartTime?: string | null;
    secondsDelay?: number;
    negRisk?: boolean;
    negRiskMarketId?: string;
    negRiskRequestId?: string;
    rewards?: {
        rates?: unknown;
        minSize?: number;
        maxSpread?: number;
    };
    fpmm?: string;
    notificationsEnabled?: boolean;
    is5050Outcome?: boolean;
}
/**
 * Token information for a market outcome
 *
 * @remarks
 * Each outcome (YES/NO) has its own ERC-1155 token with a unique ID.
 * The tokenId is used for trading and querying orderbooks.
 */
export interface ClobToken {
    /**
     * ERC-1155 token ID for this outcome
     * @example "21742633143463906290569050155826241533067272736897614950488156847949938836455"
     */
    tokenId: string;
    /**
     * Outcome name (typically "Yes" or "No")
     */
    outcome: string;
    /**
     * Current mid-market price (0-1)
     * @example 0.65 for 65% probability
     */
    price: number;
    /**
     * Whether this token is the winning outcome (after resolution)
     */
    winner?: boolean;
}
/**
 * Single price level in an orderbook
 *
 * @remarks
 * Represents one row in the order book with a price and total size at that price.
 */
export interface OrderbookLevel {
    /**
     * Price level (0.001 to 0.999)
     * @example 0.55
     */
    price: number;
    /**
     * Total size available at this price (in shares)
     * @example 1500.5
     */
    size: number;
}
/**
 * Complete orderbook for a token
 *
 * @remarks
 * The orderbook contains all open orders for a specific outcome token.
 * - Bids are sorted descending (highest bid first)
 * - Asks are sorted ascending (lowest ask first)
 */
export interface Orderbook {
    /**
     * Buy orders, sorted by price descending (best bid first)
     */
    bids: OrderbookLevel[];
    /**
     * Sell orders, sorted by price ascending (best ask first)
     */
    asks: OrderbookLevel[];
    /**
     * Timestamp when the orderbook was fetched (Unix ms)
     */
    timestamp: number;
    market?: string;
    assetId?: string;
    hash?: string;
    minOrderSize?: string;
    tickSize?: string;
    negRisk?: boolean;
}
/**
 * CLOB API client for interacting with Polymarket's orderbook
 *
 * @remarks
 * This client provides read-only access to market data and orderbooks.
 * For trading operations, use {@link TradingClient} instead.
 *
 * @example
 * ```typescript
 * const client = new ClobApiClient(rateLimiter, cache);
 *
 * // Get market details
 * const market = await client.getMarket('0x123...');
 *
 * // Get processed orderbook with analytics
 * const processed = await client.getProcessedOrderbook('0x123...');
 * console.log('Long arb profit:', processed.summary.longArbProfit);
 * ```
 */
export declare class ClobApiClient {
    private rateLimiter;
    private cache;
    private config?;
    /**
     * Creates a new CLOB API client
     *
     * @param rateLimiter - Rate limiter instance for API throttling
     * @param cache - Cache instance for storing market data (supports both legacy Cache and CacheAdapter)
     * @param config - Optional configuration for trading capabilities
     * @param config.chainId - Polygon chain ID (137 for mainnet, 80002 for Amoy testnet)
     * @param config.signer - Ethers signer for authenticated requests
     * @param config.creds - API credentials for L2 authentication
     */
    constructor(rateLimiter: RateLimiter, cache: UnifiedCache, config?: {
        /** Polygon chain ID (137 = mainnet, 80002 = Amoy testnet) */
        chainId?: number;
        /** Ethers signer for authenticated requests */
        signer?: unknown;
        /** API credentials for L2 authentication */
        creds?: {
            key: string;
            secret: string;
            passphrase: string;
        };
    } | undefined);
    /**
     * Get the signer if configured
     * @returns The signer or undefined if not configured
     */
    get signer(): unknown;
    /**
     * Get market information by condition ID
     *
     * @param conditionId - The unique condition identifier for the market
     * @returns Market information including tokens and status
     *
     * @throws {@link PolymarketError} If the market is not found or API fails
     *
     * @example
     * ```typescript
     * const market = await client.getMarket('0x82ace55...');
     * console.log(market.question);          // "Will BTC reach $100k?"
     * console.log(market.tokens[0].tokenId); // YES token ID
     * console.log(market.tokens[1].tokenId); // NO token ID
     * ```
     */
    getMarket(conditionId: string): Promise<ClobMarket>;
    /**
     * Get raw orderbook for a specific token
     *
     * @param tokenId - The ERC-1155 token ID (either YES or NO token)
     * @returns Orderbook with sorted bids and asks
     *
     * @remarks
     * - Bids are sorted descending (highest bid first)
     * - Asks are sorted ascending (lowest ask first)
     * - This returns the raw orderbook for ONE outcome token
     * - For complete market analysis, use {@link getProcessedOrderbook}
     *
     * @throws {@link PolymarketError} If the token is not found or API fails
     *
     * @example
     * ```typescript
     * const orderbook = await client.getOrderbook('21742633...');
     *
     * console.log('Best bid:', orderbook.bids[0]?.price);  // e.g., 0.55
     * console.log('Best ask:', orderbook.asks[0]?.price);  // e.g., 0.57
     * console.log('Spread:', orderbook.asks[0]?.price - orderbook.bids[0]?.price);
     * ```
     */
    getOrderbook(tokenId: string): Promise<Orderbook>;
    /**
     * Get processed orderbook with complete market analysis
     *
     * @param conditionId - The unique condition identifier for the market
     * @returns Processed orderbook with both YES/NO books and arbitrage analysis
     *
     * @remarks
     * This method fetches both YES and NO orderbooks and calculates:
     * - Effective prices (accounting for order book mirroring)
     * - Arbitrage opportunities (long and short)
     * - Depth and liquidity metrics
     *
     * **Important**: Polymarket orderbooks have a mirroring property:
     * - Buying YES @ P = Selling NO @ (1-P)
     * - The same order appears in both books
     *
     * Therefore, correct arbitrage calculation must use "effective prices":
     * - effectiveBuyYes = min(YES.ask, 1 - NO.bid)
     * - effectiveBuyNo = min(NO.ask, 1 - YES.bid)
     *
     * @throws {@link PolymarketError} If market not found or missing tokens
     *
     * @example
     * ```typescript
     * const processed = await client.getProcessedOrderbook('0x82ace55...');
     *
     * // Check for arbitrage
     * if (processed.summary.longArbProfit > 0.003) {
     *   console.log('Long arb opportunity!');
     *   console.log('Buy YES @', processed.summary.effectivePrices.effectiveBuyYes);
     *   console.log('Buy NO @', processed.summary.effectivePrices.effectiveBuyNo);
     *   console.log('Profit:', processed.summary.longArbProfit * 100, '%');
     * }
     * ```
     */
    getProcessedOrderbook(conditionId: string): Promise<ProcessedOrderbook>;
    /**
     * Process orderbooks and calculate analytics
     *
     * 关键概念：Polymarket 订单簿的镜像特性
     *
     * 买 YES @ P = 卖 NO @ (1-P)
     * 因此同一订单会在 YES 和 NO 订单簿中同时出现
     *
     * 正确的套利计算必须使用"有效价格"：
     * - effectiveBuyYes = min(YES.ask, 1 - NO.bid)
     * - effectiveBuyNo = min(NO.ask, 1 - YES.bid)
     * - effectiveSellYes = max(YES.bid, 1 - NO.ask)
     * - effectiveSellNo = max(NO.bid, 1 - YES.ask)
     *
     * 详细文档见: docs/01-polymarket-orderbook-arbitrage.md
     */
    private processOrderbooks;
    /**
     * Check if this client has trading capabilities
     *
     * @returns True if a signer or API credentials are configured
     *
     * @remarks
     * Trading requires either:
     * - A signer (for L1 authentication)
     * - API credentials (for L2 authentication)
     *
     * For actual trading, use the {@link TradingClient} instead.
     *
     * @example
     * ```typescript
     * if (client.hasTradingCapabilities()) {
     *   console.log('Client can execute trades');
     * } else {
     *   console.log('Read-only mode - use TradingClient for trading');
     * }
     * ```
     */
    hasTradingCapabilities(): boolean;
    private normalizeMarket;
}
