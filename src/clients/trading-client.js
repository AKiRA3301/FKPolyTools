/**
 * Trading Client for Polymarket
 *
 * Wraps @polymarket/clob-client for order execution:
 * - Create/cancel orders
 * - Market/limit orders
 * - Order management
 *
 * Based on: docs/01-product-research/06-poly-sdk/reports/02-clob-client.md
 */
import { ClobClient, Side as ClobSide, OrderType as ClobOrderType } from '@polymarket/clob-client';
import { Wallet } from 'ethers';
import { ApiType } from '../core/rate-limiter.js';
import { PolymarketError, ErrorCode } from '../core/errors.js';
// Chain IDs
export const POLYGON_MAINNET = 137;
export const POLYGON_AMOY = 80002;
// CLOB Host
const CLOB_HOST = 'https://clob.polymarket.com';
// ===== Client =====
export class TradingClient {
    rateLimiter;
    config;
    clobClient = null;
    wallet;
    chainId;
    credentials = null;
    initialized = false;
    tickSizeCache = new Map();
    negRiskCache = new Map();
    constructor(rateLimiter, config) {
        this.rateLimiter = rateLimiter;
        this.config = config;
        this.wallet = new Wallet(config.privateKey);
        this.chainId = (config.chainId || POLYGON_MAINNET);
        this.credentials = config.credentials || null;
    }
    // ===== Initialization =====
    /**
     * Initialize the trading client
     * Creates API credentials if not provided
     */
    async initialize() {
        if (this.initialized)
            return;
        // Create CLOB client with L1 auth (wallet)
        this.clobClient = new ClobClient(CLOB_HOST, this.chainId, this.wallet);
        // Get or create API credentials using createOrDeriveApiKey
        // Returns ApiKeyCreds which uses 'key' not 'apiKey'
        if (!this.credentials) {
            const creds = await this.clobClient.createOrDeriveApiKey();
            this.credentials = {
                key: creds.key,
                secret: creds.secret,
                passphrase: creds.passphrase,
            };
        }
        // Re-initialize with L2 auth (credentials)
        // ApiKeyCreds uses 'key' not 'apiKey'
        this.clobClient = new ClobClient(CLOB_HOST, this.chainId, this.wallet, {
            key: this.credentials.key,
            secret: this.credentials.secret,
            passphrase: this.credentials.passphrase,
        });
        this.initialized = true;
    }
    async ensureInitialized() {
        if (!this.initialized || !this.clobClient) {
            await this.initialize();
        }
        return this.clobClient;
    }
    // ===== Market Info =====
    /**
     * Get tick size for a token (cached)
     */
    async getTickSize(tokenId) {
        if (this.tickSizeCache.has(tokenId)) {
            return this.tickSizeCache.get(tokenId);
        }
        const client = await this.ensureInitialized();
        const tickSize = await client.getTickSize(tokenId);
        this.tickSizeCache.set(tokenId, tickSize);
        return tickSize;
    }
    /**
     * Check if token is neg risk (cached)
     */
    async isNegRisk(tokenId) {
        if (this.negRiskCache.has(tokenId)) {
            return this.negRiskCache.get(tokenId);
        }
        const client = await this.ensureInitialized();
        const negRisk = await client.getNegRisk(tokenId);
        this.negRiskCache.set(tokenId, negRisk);
        return negRisk;
    }
    // ===== Order Creation =====
    /**
     * Create and post a limit order (single step)
     */
    async createOrder(params) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            try {
                // Get market parameters
                const [tickSize, negRisk] = await Promise.all([
                    this.getTickSize(params.tokenId),
                    this.isNegRisk(params.tokenId),
                ]);
                // Use createAndPostOrder for single-step limit order creation
                // Only GTC and GTD are valid for limit orders
                const orderType = params.orderType === 'GTD' ? ClobOrderType.GTD : ClobOrderType.GTC;
                const result = await client.createAndPostOrder({
                    tokenID: params.tokenId,
                    side: params.side === 'BUY' ? ClobSide.BUY : ClobSide.SELL,
                    price: params.price,
                    size: params.size,
                    expiration: params.expiration || 0,
                }, { tickSize, negRisk }, orderType);
                // Check for actual success
                // Priority: explicit success field > orderID/transactionsHashes as fallback
                // If result.success is explicitly false, honor that even if there's an orderID
                let actualSuccess;
                if (result.success === true) {
                    actualSuccess = true;
                }
                else if (result.success === false) {
                    // Explicit failure - even if there's an orderID, consider it failed
                    actualSuccess = false;
                }
                else {
                    // result.success is undefined - use fallback logic
                    actualSuccess =
                        (result.orderID !== undefined && result.orderID !== '') ||
                            (result.transactionsHashes !== undefined && result.transactionsHashes.length > 0);
                }
                return {
                    success: actualSuccess,
                    orderId: result.orderID,
                    orderIds: result.orderIDs,
                    errorMsg: result.errorMsg || (actualSuccess ? undefined : 'Order may have failed'),
                    transactionHashes: result.transactionsHashes,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                // Return failure instead of throwing to allow graceful handling
                return {
                    success: false,
                    errorMsg: `Order failed: ${message}`,
                };
            }
        });
    }
    /**
     * Create and post a market order (executes at best available price)
     */
    async createMarketOrder(params) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            try {
                // Get market parameters
                const [tickSize, negRisk] = await Promise.all([
                    this.getTickSize(params.tokenId),
                    this.isNegRisk(params.tokenId),
                ]);
                // Use createAndPostMarketOrder
                // Only FOK and FAK are valid for market orders
                const orderType = params.orderType === 'FAK' ? ClobOrderType.FAK : ClobOrderType.FOK;
                const result = await client.createAndPostMarketOrder({
                    tokenID: params.tokenId,
                    side: params.side === 'BUY' ? ClobSide.BUY : ClobSide.SELL,
                    amount: params.amount,
                    price: params.price,
                }, { tickSize, negRisk }, orderType);
                // Check for actual success
                // Priority: explicit success field > orderID/transactionsHashes as fallback
                // If result.success is explicitly false, honor that even if there's an orderID
                let actualSuccess;
                if (result.success === true) {
                    actualSuccess = true;
                }
                else if (result.success === false) {
                    // Explicit failure - even if there's an orderID, consider it failed
                    actualSuccess = false;
                }
                else {
                    // result.success is undefined - use fallback logic
                    actualSuccess =
                        (result.orderID !== undefined && result.orderID !== '') ||
                            (result.transactionsHashes !== undefined && result.transactionsHashes.length > 0);
                }
                return {
                    success: actualSuccess,
                    orderId: result.orderID,
                    orderIds: result.orderIDs,
                    errorMsg: result.errorMsg || (actualSuccess ? undefined : 'Order may have failed'),
                    transactionHashes: result.transactionsHashes,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                // Return failure instead of throwing to allow graceful handling
                return {
                    success: false,
                    errorMsg: `Market order failed: ${message}`,
                };
            }
        });
    }
    // ===== Order Management =====
    /**
     * Cancel an order by ID
     */
    async cancelOrder(orderId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            try {
                const result = await client.cancelOrder({ orderID: orderId });
                return {
                    success: result.canceled ?? false,
                    orderId,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new PolymarketError(ErrorCode.ORDER_FAILED, `Cancel failed: ${message}`);
            }
        });
    }
    /**
     * Cancel multiple orders by IDs (order hashes)
     */
    async cancelOrders(orderIds) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            try {
                const result = await client.cancelOrders(orderIds);
                return {
                    success: result.canceled ?? false,
                    orderIds,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new PolymarketError(ErrorCode.ORDER_FAILED, `Cancel orders failed: ${message}`);
            }
        });
    }
    /**
     * Cancel all open orders
     */
    async cancelAllOrders() {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            try {
                const result = await client.cancelAll();
                return {
                    success: result.canceled ?? false,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new PolymarketError(ErrorCode.ORDER_FAILED, `Cancel all failed: ${message}`);
            }
        });
    }
    /**
     * Get open orders (fully paginated)
     */
    async getOpenOrders(marketId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            try {
                const orders = await client.getOpenOrders(marketId ? { market: marketId } : undefined);
                return orders.map((o) => {
                    const originalSize = Number(o.original_size) || 0;
                    const filledSize = Number(o.size_matched) || 0;
                    return {
                        id: o.id,
                        status: o.status,
                        tokenId: o.asset_id,
                        side: o.side.toUpperCase(),
                        price: Number(o.price) || 0,
                        originalSize,
                        filledSize,
                        remainingSize: originalSize - filledSize,
                        associateTrades: o.associate_trades || [],
                        createdAt: o.created_at,
                    };
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new PolymarketError(ErrorCode.API_ERROR, `Get orders failed: ${message}`);
            }
        });
    }
    /**
     * Get trade history
     */
    async getTrades(marketId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            try {
                const trades = await client.getTrades(marketId ? { market: marketId } : undefined);
                return trades.map((t) => ({
                    id: t.id,
                    tokenId: t.asset_id,
                    side: t.side,
                    price: Number(t.price) || 0,
                    size: Number(t.size) || 0,
                    fee: Number(t.fee_rate_bps) || 0,
                    timestamp: Number(t.match_time) || Date.now(),
                }));
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new PolymarketError(ErrorCode.API_ERROR, `Get trades failed: ${message}`);
            }
        });
    }
    // ===== Price Info =====
    /**
     * Get current price for a token
     */
    async getPrice(tokenId, side) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const price = await client.getPrice(tokenId, side);
            return Number(price);
        });
    }
    /**
     * Get midpoint price for a token
     */
    async getMidpoint(tokenId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const midpoint = await client.getMidpoint(tokenId);
            return Number(midpoint);
        });
    }
    /**
     * Get spread for a token
     */
    async getSpread(tokenId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const spread = await client.getSpread(tokenId);
            return Number(spread);
        });
    }
    // ===== Account Info =====
    /**
     * Get wallet address
     */
    getAddress() {
        return this.wallet.address;
    }
    /**
     * Get API credentials (for storage/reuse)
     */
    getCredentials() {
        return this.credentials;
    }
    /**
     * Check if client is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Get underlying CLOB client for advanced usage
     */
    getClobClient() {
        return this.clobClient;
    }
    // ===== Rewards (Market Maker Incentives) =====
    /**
     * Check if an order is scoring for rewards
     * Orders that are scoring contribute to daily reward earnings
     */
    async isOrderScoring(orderId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const result = await client.isOrderScoring({ order_id: orderId });
            return result.scoring;
        });
    }
    /**
     * Check if multiple orders are scoring for rewards
     */
    async areOrdersScoring(orderIds) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const result = await client.areOrdersScoring({ orderIds });
            return result;
        });
    }
    /**
     * Get user earnings for a specific day
     * @param date - Date in YYYY-MM-DD format
     */
    async getEarningsForDay(date) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const earnings = await client.getEarningsForUserForDay(date);
            return earnings.map(e => ({
                date: e.date,
                conditionId: e.condition_id,
                assetAddress: e.asset_address,
                makerAddress: e.maker_address,
                earnings: e.earnings,
                assetRate: e.asset_rate,
            }));
        });
    }
    /**
     * Get total earnings across all markets for a specific day
     * @param date - Date in YYYY-MM-DD format
     */
    async getTotalEarningsForDay(date) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const totals = await client.getTotalEarningsForUserForDay(date);
            let totalEarnings = 0;
            const byAsset = totals.map(t => {
                totalEarnings += t.earnings;
                return {
                    assetAddress: t.asset_address,
                    earnings: t.earnings,
                    rate: t.asset_rate,
                };
            });
            return { date, totalEarnings, byAsset };
        });
    }
    /**
     * Get current market rewards configuration
     * Returns markets that have active reward programs
     */
    async getCurrentRewards() {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const rewards = await client.getCurrentRewards();
            return rewards.map(r => ({
                conditionId: r.condition_id,
                question: r.question,
                marketSlug: r.market_slug,
                eventSlug: r.event_slug,
                image: r.image,
                rewardsMaxSpread: r.rewards_max_spread,
                rewardsMinSize: r.rewards_min_size,
                tokens: r.tokens.map(t => ({
                    tokenId: t.token_id,
                    outcome: t.outcome,
                    price: t.price,
                })),
                rewardsConfig: r.rewards_config.map(c => ({
                    assetAddress: c.asset_address,
                    startDate: c.start_date,
                    endDate: c.end_date,
                    ratePerDay: c.rate_per_day,
                    totalRewards: c.total_rewards,
                })),
            }));
        });
    }
    /**
     * Get reward percentages by market
     * Higher percentages indicate higher reward rates
     */
    async getRewardPercentages() {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            return await client.getRewardPercentages();
        });
    }
    /**
     * Get raw rewards for a specific market
     */
    async getMarketRewards(conditionId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const rewards = await client.getRawRewardsForMarket(conditionId);
            return rewards.map(r => ({
                conditionId: r.condition_id,
                question: r.question,
                marketSlug: r.market_slug,
                eventSlug: r.event_slug,
                image: r.image,
                rewardsMaxSpread: r.rewards_max_spread,
                rewardsMinSize: r.rewards_min_size,
                tokens: r.tokens.map(t => ({
                    tokenId: t.token_id,
                    outcome: t.outcome,
                    price: t.price,
                })),
                rewardsConfig: r.rewards_config.map(c => ({
                    assetAddress: c.asset_address,
                    startDate: c.start_date,
                    endDate: c.end_date,
                    ratePerDay: c.rate_per_day,
                    totalRewards: c.total_rewards,
                })),
            }));
        });
    }
    // ===== Balance & Allowance =====
    /**
     * Get balance and allowance for collateral or conditional tokens
     * @param assetType - 'COLLATERAL' for USDC, 'CONDITIONAL' for outcome tokens
     * @param tokenId - Token ID (required for CONDITIONAL type)
     */
    async getBalanceAllowance(assetType, tokenId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            const result = await client.getBalanceAllowance({
                asset_type: assetType,
                token_id: tokenId,
            });
            return {
                balance: result.balance,
                allowance: result.allowance,
            };
        });
    }
    /**
     * Update balance allowance (approve spending)
     */
    async updateBalanceAllowance(assetType, tokenId) {
        const client = await this.ensureInitialized();
        return this.rateLimiter.execute(ApiType.CLOB_API, async () => {
            await client.updateBalanceAllowance({
                asset_type: assetType,
                token_id: tokenId,
            });
        });
    }
}
