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
import { ApiType } from '../core/rate-limiter.js';
import { CACHE_TTL } from '../core/unified-cache.js';
import { PolymarketError, ErrorCode } from '../core/errors.js';
/** CLOB API base URL */
const CLOB_API_BASE = 'https://clob.polymarket.com';
// ===== Client =====
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
export class ClobApiClient {
    rateLimiter;
    cache;
    config;
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
    constructor(rateLimiter, cache, config) {
        this.rateLimiter = rateLimiter;
        this.cache = cache;
        this.config = config;
    }
    /**
     * Get the signer if configured
     * @returns The signer or undefined if not configured
     */
    get signer() {
        return this.config?.signer;
    }
    // ===== Market Info =====
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
    async getMarket(conditionId) {
        const cacheKey = `clob:market:${conditionId}`;
        return this.cache.getOrSet(cacheKey, CACHE_TTL.MARKET_INFO, async () => {
            return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
                const response = await fetch(`${CLOB_API_BASE}/markets/${conditionId}`);
                if (!response.ok)
                    throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
                const data = (await response.json());
                return this.normalizeMarket(data);
            });
        });
    }
    // ===== Orderbook =====
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
    async getOrderbook(tokenId) {
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const response = await fetch(`${CLOB_API_BASE}/book?token_id=${tokenId}`);
            if (!response.ok)
                throw PolymarketError.fromHttpError(response.status, await response.json().catch(() => null));
            const data = (await response.json());
            // Sort bids descending (highest bid first)
            // Sort asks ascending (lowest ask first)
            const bids = (data.bids || [])
                .map((l) => ({
                price: Number(l.price),
                size: Number(l.size),
            }))
                .sort((a, b) => b.price - a.price);
            const asks = (data.asks || [])
                .map((l) => ({
                price: Number(l.price),
                size: Number(l.size),
            }))
                .sort((a, b) => a.price - b.price);
            return {
                bids,
                asks,
                timestamp: data.timestamp ? Number(data.timestamp) : Date.now(),
                market: data.market,
                assetId: data.asset_id,
                hash: data.hash,
                minOrderSize: data.min_order_size,
                tickSize: data.tick_size,
                negRisk: data.neg_risk,
            };
        });
    }
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
    async getProcessedOrderbook(conditionId) {
        const market = await this.getMarket(conditionId);
        const yesToken = market.tokens.find((t) => t.outcome === 'Yes');
        const noToken = market.tokens.find((t) => t.outcome === 'No');
        if (!yesToken || !noToken) {
            throw new PolymarketError(ErrorCode.INVALID_RESPONSE, 'Missing tokens in market');
        }
        const [yesBook, noBook] = await Promise.all([
            this.getOrderbook(yesToken.tokenId),
            this.getOrderbook(noToken.tokenId),
        ]);
        return this.processOrderbooks(yesBook, noBook, yesToken.tokenId, noToken.tokenId);
    }
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
    processOrderbooks(yesBook, noBook, yesTokenId, noTokenId) {
        const yesBestBid = yesBook.bids[0]?.price || 0;
        const yesBestAsk = yesBook.asks[0]?.price || 1;
        const noBestBid = noBook.bids[0]?.price || 0;
        const noBestAsk = noBook.asks[0]?.price || 1;
        const yesBidDepth = yesBook.bids.reduce((sum, l) => sum + l.price * l.size, 0);
        const yesAskDepth = yesBook.asks.reduce((sum, l) => sum + l.price * l.size, 0);
        const noBidDepth = noBook.bids.reduce((sum, l) => sum + l.price * l.size, 0);
        const noAskDepth = noBook.asks.reduce((sum, l) => sum + l.price * l.size, 0);
        // 原始价格和（仅供参考，可能包含重复计算）
        const askSum = yesBestAsk + noBestAsk;
        const bidSum = yesBestBid + noBestBid;
        // ===== 计算有效价格（考虑镜像订单）=====
        // 这是正确的套利计算方式
        const effectivePrices = {
            // 买 YES: 直接买 YES.ask 或 通过卖 NO (成本 = 1 - NO.bid)
            effectiveBuyYes: Math.min(yesBestAsk, 1 - noBestBid),
            // 买 NO: 直接买 NO.ask 或 通过卖 YES (成本 = 1 - YES.bid)
            effectiveBuyNo: Math.min(noBestAsk, 1 - yesBestBid),
            // 卖 YES: 直接卖 YES.bid 或 通过买 NO (收入 = 1 - NO.ask)
            effectiveSellYes: Math.max(yesBestBid, 1 - noBestAsk),
            // 卖 NO: 直接卖 NO.bid 或 通过买 YES (收入 = 1 - YES.ask)
            effectiveSellNo: Math.max(noBestBid, 1 - yesBestAsk),
        };
        // 有效套利成本/收入
        const effectiveLongCost = effectivePrices.effectiveBuyYes + effectivePrices.effectiveBuyNo;
        const effectiveShortRevenue = effectivePrices.effectiveSellYes + effectivePrices.effectiveSellNo;
        // 套利利润（基于有效价格）
        const longArbProfit = 1 - effectiveLongCost;
        const shortArbProfit = effectiveShortRevenue - 1;
        // YES spread（由于镜像，这也能反映整体市场效率）
        const yesSpread = yesBestAsk - yesBestBid;
        return {
            yes: {
                bid: yesBestBid,
                ask: yesBestAsk,
                bidSize: yesBook.bids[0]?.size || 0,
                askSize: yesBook.asks[0]?.size || 0,
                bidDepth: yesBidDepth,
                askDepth: yesAskDepth,
                spread: yesSpread,
                tokenId: yesTokenId,
            },
            no: {
                bid: noBestBid,
                ask: noBestAsk,
                bidSize: noBook.bids[0]?.size || 0,
                askSize: noBook.asks[0]?.size || 0,
                bidDepth: noBidDepth,
                askDepth: noAskDepth,
                spread: noBestAsk - noBestBid,
                tokenId: noTokenId,
            },
            summary: {
                // 原始价格和（仅供参考）
                askSum,
                bidSum,
                // 有效价格
                effectivePrices,
                // 有效成本/收入
                effectiveLongCost,
                effectiveShortRevenue,
                // 套利利润（基于有效价格，这才是正确的计算）
                longArbProfit, // > 0 means long arbitrage opportunity
                shortArbProfit, // > 0 means short arbitrage opportunity
                // 其他指标
                totalBidDepth: yesBidDepth + noBidDepth,
                totalAskDepth: yesAskDepth + noAskDepth,
                imbalanceRatio: (yesBidDepth + noBidDepth) / (yesAskDepth + noAskDepth + 0.001),
                yesSpread,
            },
        };
    }
    // ===== Trading (requires authentication) =====
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
    hasTradingCapabilities() {
        return !!(this.config?.signer || this.config?.creds);
    }
    // ===== Data Normalization =====
    normalizeMarket(m) {
        const tokens = m.tokens;
        const rewards = m.rewards;
        return {
            // Core identifiers
            conditionId: String(m.condition_id || ''),
            questionId: m.question_id ? String(m.question_id) : undefined,
            marketSlug: String(m.market_slug || ''),
            // Market content
            question: String(m.question || ''),
            description: m.description ? String(m.description) : undefined,
            image: m.image ? String(m.image) : undefined,
            icon: m.icon ? String(m.icon) : undefined,
            // Tokens
            tokens: Array.isArray(tokens)
                ? tokens.map((t) => ({
                    tokenId: String(t.token_id || ''),
                    outcome: String(t.outcome || ''),
                    price: Number(t.price),
                    winner: t.winner !== undefined ? Boolean(t.winner) : undefined,
                }))
                : [],
            tags: Array.isArray(m.tags) ? m.tags : undefined,
            // Status flags
            active: Boolean(m.active),
            closed: Boolean(m.closed),
            archived: m.archived !== undefined ? Boolean(m.archived) : undefined,
            acceptingOrders: Boolean(m.accepting_orders),
            acceptingOrderTimestamp: m.accepting_order_timestamp ? String(m.accepting_order_timestamp) : undefined,
            enableOrderBook: m.enable_order_book !== undefined ? Boolean(m.enable_order_book) : undefined,
            // Trading parameters
            minimumOrderSize: m.minimum_order_size !== undefined ? Number(m.minimum_order_size) : undefined,
            minimumTickSize: m.minimum_tick_size !== undefined ? Number(m.minimum_tick_size) : undefined,
            makerBaseFee: m.maker_base_fee !== undefined ? Number(m.maker_base_fee) : undefined,
            takerBaseFee: m.taker_base_fee !== undefined ? Number(m.taker_base_fee) : undefined,
            // Timing
            endDateIso: m.end_date_iso !== undefined ? (m.end_date_iso === null ? null : String(m.end_date_iso)) : undefined,
            gameStartTime: m.game_start_time !== undefined ? (m.game_start_time === null ? null : String(m.game_start_time)) : undefined,
            secondsDelay: m.seconds_delay !== undefined ? Number(m.seconds_delay) : undefined,
            // Neg risk
            negRisk: m.neg_risk !== undefined ? Boolean(m.neg_risk) : undefined,
            negRiskMarketId: m.neg_risk_market_id ? String(m.neg_risk_market_id) : undefined,
            negRiskRequestId: m.neg_risk_request_id ? String(m.neg_risk_request_id) : undefined,
            // Rewards
            rewards: rewards ? {
                rates: rewards.rates,
                minSize: rewards.min_size !== undefined ? Number(rewards.min_size) : undefined,
                maxSpread: rewards.max_spread !== undefined ? Number(rewards.max_spread) : undefined,
            } : undefined,
            // Other
            fpmm: m.fpmm ? String(m.fpmm) : undefined,
            notificationsEnabled: m.notifications_enabled !== undefined ? Boolean(m.notifications_enabled) : undefined,
            is5050Outcome: m.is_50_50_outcome !== undefined ? Boolean(m.is_50_50_outcome) : undefined,
        };
    }
}
