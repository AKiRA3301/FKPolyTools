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
import { ClobClient, type TickSize } from '@polymarket/clob-client';
import { RateLimiter } from '../core/rate-limiter.js';
export declare const POLYGON_MAINNET = 137;
export declare const POLYGON_AMOY = 80002;
export type Side = 'BUY' | 'SELL';
export type OrderType = 'GTC' | 'FOK' | 'GTD' | 'FAK';
export interface ApiCredentials {
    key: string;
    secret: string;
    passphrase: string;
}
export interface OrderParams {
    /** Token ID to trade */
    tokenId: string;
    /** BUY or SELL */
    side: Side;
    /** Price (0.001 - 0.999) */
    price: number;
    /** Size in shares */
    size: number;
    /** Order type: GTC (default) or GTD for limit orders */
    orderType?: 'GTC' | 'GTD';
    /** Expiration for GTD orders (unix timestamp seconds) */
    expiration?: number;
}
export interface MarketOrderParams {
    /** Token ID to trade */
    tokenId: string;
    /** BUY or SELL */
    side: Side;
    /** Amount in USDC for BUY, shares for SELL */
    amount: number;
    /** Price limit (optional) */
    price?: number;
    /** Order type: FOK (default) or FAK */
    orderType?: 'FOK' | 'FAK';
}
export interface Order {
    id: string;
    status: string;
    tokenId: string;
    side: Side;
    price: number;
    originalSize: number;
    filledSize: number;
    remainingSize: number;
    associateTrades: string[];
    createdAt: number;
}
export interface OrderResult {
    success: boolean;
    orderId?: string;
    orderIds?: string[];
    errorMsg?: string;
    transactionHashes?: string[];
}
export interface TradeInfo {
    id: string;
    tokenId: string;
    side: Side;
    price: number;
    size: number;
    fee: number;
    timestamp: number;
}
export interface UserEarning {
    date: string;
    conditionId: string;
    assetAddress: string;
    makerAddress: string;
    earnings: number;
    assetRate: number;
}
export interface MarketReward {
    conditionId: string;
    question: string;
    marketSlug: string;
    eventSlug: string;
    image: string;
    rewardsMaxSpread: number;
    rewardsMinSize: number;
    tokens: Array<{
        tokenId: string;
        outcome: string;
        price: number;
    }>;
    rewardsConfig: Array<{
        assetAddress: string;
        startDate: string;
        endDate: string;
        ratePerDay: number;
        totalRewards: number;
    }>;
}
export interface OrderScoring {
    scoring: boolean;
}
export interface TradingClientConfig {
    /** Private key for signing */
    privateKey: string;
    /** Chain ID (default: Polygon mainnet 137) */
    chainId?: number;
    /** Pre-generated API credentials (optional) */
    credentials?: ApiCredentials;
}
export declare class TradingClient {
    private rateLimiter;
    private config;
    private clobClient;
    private wallet;
    private chainId;
    private credentials;
    private initialized;
    private tickSizeCache;
    private negRiskCache;
    constructor(rateLimiter: RateLimiter, config: TradingClientConfig);
    /**
     * Initialize the trading client
     * Creates API credentials if not provided
     */
    initialize(): Promise<void>;
    private ensureInitialized;
    /**
     * Get tick size for a token (cached)
     */
    getTickSize(tokenId: string): Promise<TickSize>;
    /**
     * Check if token is neg risk (cached)
     */
    isNegRisk(tokenId: string): Promise<boolean>;
    /**
     * Create and post a limit order (single step)
     */
    createOrder(params: OrderParams): Promise<OrderResult>;
    /**
     * Create and post a market order (executes at best available price)
     */
    createMarketOrder(params: MarketOrderParams): Promise<OrderResult>;
    /**
     * Cancel an order by ID
     */
    cancelOrder(orderId: string): Promise<OrderResult>;
    /**
     * Cancel multiple orders by IDs (order hashes)
     */
    cancelOrders(orderIds: string[]): Promise<OrderResult>;
    /**
     * Cancel all open orders
     */
    cancelAllOrders(): Promise<OrderResult>;
    /**
     * Get open orders (fully paginated)
     */
    getOpenOrders(marketId?: string): Promise<Order[]>;
    /**
     * Get trade history
     */
    getTrades(marketId?: string): Promise<TradeInfo[]>;
    /**
     * Get current price for a token
     */
    getPrice(tokenId: string, side: Side): Promise<number>;
    /**
     * Get midpoint price for a token
     */
    getMidpoint(tokenId: string): Promise<number>;
    /**
     * Get spread for a token
     */
    getSpread(tokenId: string): Promise<number>;
    /**
     * Get wallet address
     */
    getAddress(): string;
    /**
     * Get API credentials (for storage/reuse)
     */
    getCredentials(): ApiCredentials | null;
    /**
     * Check if client is initialized
     */
    isInitialized(): boolean;
    /**
     * Get underlying CLOB client for advanced usage
     */
    getClobClient(): ClobClient | null;
    /**
     * Check if an order is scoring for rewards
     * Orders that are scoring contribute to daily reward earnings
     */
    isOrderScoring(orderId: string): Promise<boolean>;
    /**
     * Check if multiple orders are scoring for rewards
     */
    areOrdersScoring(orderIds: string[]): Promise<Record<string, boolean>>;
    /**
     * Get user earnings for a specific day
     * @param date - Date in YYYY-MM-DD format
     */
    getEarningsForDay(date: string): Promise<UserEarning[]>;
    /**
     * Get total earnings across all markets for a specific day
     * @param date - Date in YYYY-MM-DD format
     */
    getTotalEarningsForDay(date: string): Promise<{
        date: string;
        totalEarnings: number;
        byAsset: Array<{
            assetAddress: string;
            earnings: number;
            rate: number;
        }>;
    }>;
    /**
     * Get current market rewards configuration
     * Returns markets that have active reward programs
     */
    getCurrentRewards(): Promise<MarketReward[]>;
    /**
     * Get reward percentages by market
     * Higher percentages indicate higher reward rates
     */
    getRewardPercentages(): Promise<Record<string, number>>;
    /**
     * Get raw rewards for a specific market
     */
    getMarketRewards(conditionId: string): Promise<MarketReward[]>;
    /**
     * Get balance and allowance for collateral or conditional tokens
     * @param assetType - 'COLLATERAL' for USDC, 'CONDITIONAL' for outcome tokens
     * @param tokenId - Token ID (required for CONDITIONAL type)
     */
    getBalanceAllowance(assetType: 'COLLATERAL' | 'CONDITIONAL', tokenId?: string): Promise<{
        balance: string;
        allowance: string;
    }>;
    /**
     * Update balance allowance (approve spending)
     */
    updateBalanceAllowance(assetType: 'COLLATERAL' | 'CONDITIONAL', tokenId?: string): Promise<void>;
}
