/**
 * @catalyst-team/poly-sdk
 *
 * Unified SDK for Polymarket APIs
 * - Data API (positions, activity, trades, leaderboard)
 * - Gamma API (markets, events, trending)
 * - CLOB API (orderbook, market info, trading)
 * - Services (WalletService, MarketService)
 */
export { RateLimiter, ApiType } from './core/rate-limiter.js';
export { Cache, CACHE_TTL } from './core/cache.js';
export { PolymarketError, ErrorCode, withRetry } from './core/errors.js';
export * from './core/types.js';
export type { UnifiedCache } from './core/unified-cache.js';
export { createUnifiedCache } from './core/unified-cache.js';
export { DataApiClient } from './clients/data-api.js';
export type { Position, Activity, Trade, LeaderboardEntry, LeaderboardPage, } from './clients/data-api.js';
export { GammaApiClient } from './clients/gamma-api.js';
export type { GammaMarket, GammaEvent, MarketSearchParams, } from './clients/gamma-api.js';
export { ClobApiClient } from './clients/clob-api.js';
export type { ClobMarket, ClobToken, Orderbook, OrderbookLevel, } from './clients/clob-api.js';
export { WalletService } from './services/wallet-service.js';
export type { WalletProfile, WalletActivitySummary, SellActivityResult, } from './services/wallet-service.js';
export { MarketService, getIntervalMs as getIntervalMsService } from './services/market-service.js';
export { WebSocketManager } from './clients/websocket-manager.js';
export type { WebSocketManagerConfig, WebSocketManagerEvents } from './clients/websocket-manager.js';
export { RealtimeService } from './services/realtime-service.js';
export type { Subscription, MarketSubscriptionHandlers } from './services/realtime-service.js';
export { ArbitrageService } from './services/arbitrage-service.js';
export type { ArbitrageMarketConfig, ArbitrageServiceConfig, ArbitrageOpportunity as ArbitrageServiceOpportunity, ArbitrageExecutionResult, ArbitrageServiceEvents, OrderbookState, BalanceState, RebalanceAction, RebalanceResult, SettleResult, ClearPositionResult, ClearAction, ScanCriteria, ScanResult, } from './services/arbitrage-service.js';
export { TradingClient, POLYGON_MAINNET, POLYGON_AMOY } from './clients/trading-client.js';
export type { Side, OrderType, ApiCredentials, OrderParams, MarketOrderParams, Order, OrderResult, TradeInfo, TradingClientConfig, UserEarning, MarketReward, OrderScoring, } from './clients/trading-client.js';
export { CTFClient, CTF_CONTRACT, USDC_CONTRACT, // USDC.e (0x2791...) - Required for CTF
NATIVE_USDC_CONTRACT, // Native USDC (0x3c49...) - NOT for CTF
NEG_RISK_CTF_EXCHANGE, NEG_RISK_ADAPTER, USDC_DECIMALS, calculateConditionId, parseUsdc, formatUsdc, } from './clients/ctf-client.js';
export type { CTFConfig, SplitResult, MergeResult, RedeemResult, PositionBalance, MarketResolution, GasEstimate, TransactionStatus, TokenIds, } from './clients/ctf-client.js';
export { RevertReason } from './clients/ctf-client.js';
export { ChainMonitorClient, CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE as CHAIN_MONITOR_NEG_RISK_EXCHANGE, OFFICIAL_ADDRESSES, isContractAddress, isOfficialAddress, } from './clients/chain-monitor-client.js';
export type { ChainMonitorConfig, TransferEvent, ChainMonitorStats, } from './clients/chain-monitor-client.js';
export { BridgeClient, SUPPORTED_CHAINS, BRIDGE_TOKENS, estimateBridgeOutput, getExplorerUrl, depositUsdc, swapAndDeposit, getSupportedDepositTokens, } from './clients/bridge-client.js';
export type { BridgeSupportedAsset, DepositAddress, CreateDepositResponse, DepositStatus, BridgeConfig, DepositResult, DepositOptions, SwapAndDepositOptions, SwapAndDepositResult, } from './clients/bridge-client.js';
export { SwapService, QUICKSWAP_ROUTER, POLYGON_TOKENS, TOKEN_DECIMALS, } from './services/swap-service.js';
export type { SupportedToken, SwapQuote, SwapResult, TokenBalance, TransferResult, } from './services/swap-service.js';
export { AuthorizationService } from './services/authorization-service.js';
export type { AllowanceInfo, AllowancesResult, ApprovalTxResult, ApprovalsResult, AuthorizationServiceConfig, } from './services/authorization-service.js';
export { roundPrice, roundSize, validatePrice, validateSize, calculateBuyAmount, calculateSellPayout, calculateSharesForAmount, calculateSpread, calculateMidpoint, formatPrice, formatUSDC, calculatePnL, checkArbitrage, getEffectivePrices, ROUNDING_CONFIG, } from './utils/price-utils.js';
export type { TickSize } from './utils/price-utils.js';
import { DataApiClient } from './clients/data-api.js';
import { GammaApiClient } from './clients/gamma-api.js';
import { ClobApiClient } from './clients/clob-api.js';
import { WalletService } from './services/wallet-service.js';
import { MarketService } from './services/market-service.js';
import type { UnifiedMarket, ProcessedOrderbook, ArbitrageOpportunity, PolySDKOptions } from './core/types.js';
export interface PolymarketSDKConfig extends PolySDKOptions {
}
export declare class PolymarketSDK {
    private rateLimiter;
    private cache;
    readonly dataApi: DataApiClient;
    readonly gammaApi: GammaApiClient;
    readonly clobApi: ClobApiClient;
    readonly wallets: WalletService;
    readonly markets: MarketService;
    constructor(config?: PolymarketSDKConfig);
    /**
     * Get market by slug or condition ID
     * Uses Gamma for slug, CLOB for conditionId
     */
    getMarket(identifier: string): Promise<UnifiedMarket>;
    private getMarketBySlug;
    private getMarketByConditionId;
    /**
     * Get processed orderbook with analytics
     */
    getOrderbook(conditionId: string): Promise<ProcessedOrderbook>;
    /**
     * Detect arbitrage opportunity
     *
     * 使用有效价格计算套利机会（正确考虑镜像订单）
     * 详细文档见: docs/01-polymarket-orderbook-arbitrage.md
     */
    detectArbitrage(conditionId: string, threshold?: number): Promise<ArbitrageOpportunity | null>;
    private mergeMarkets;
    private fromGammaMarket;
    private fromClobMarket;
    /**
     * Clear all cached data
     */
    clearCache(): void;
    /**
     * Invalidate cache for a specific market
     */
    invalidateMarketCache(conditionId: string): void;
}
