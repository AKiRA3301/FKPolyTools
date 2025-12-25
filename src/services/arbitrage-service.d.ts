/**
 * ArbitrageService - Real-time Arbitrage Detection and Execution
 *
 * Uses WebSocket for real-time orderbook monitoring and automatically
 * detects arbitrage opportunities in Polymarket binary markets.
 *
 * Strategy:
 * - Long Arb: Buy YES + NO (effective cost < $1) → Merge → $1 USDC
 * - Short Arb: Sell pre-held YES + NO tokens (effective revenue > $1)
 *
 * Features:
 * - Real-time orderbook monitoring via WebSocket
 * - Automatic arbitrage detection using effective prices
 * - Configurable profit threshold and trade sizes
 * - Auto-execute mode or event-based manual mode
 * - Balance tracking and position management
 *
 * Based on: scripts/arb/faze-bo3-arb.ts
 * Docs: docs/arbitrage.md
 */
import { EventEmitter } from 'events';
export interface ArbitrageMarketConfig {
    /** Market name for logging */
    name: string;
    /** Condition ID */
    conditionId: string;
    /** YES token ID from CLOB API */
    yesTokenId: string;
    /** NO token ID from CLOB API */
    noTokenId: string;
    /** Outcome names [YES, NO] */
    outcomes?: [string, string];
}
export interface ArbitrageServiceConfig {
    /** Private key for trading (optional for monitor-only mode) */
    privateKey?: string;
    /** RPC URL for CTF operations */
    rpcUrl?: string;
    /** Minimum profit threshold (default: 0.005 = 0.5%) */
    profitThreshold?: number;
    /** Minimum trade size in USDC (default: 5) */
    minTradeSize?: number;
    /** Maximum single trade size in USDC (default: 100) */
    maxTradeSize?: number;
    /** Minimum token reserve for short arb (default: 10) */
    minTokenReserve?: number;
    /** Auto-execute mode (default: false) */
    autoExecute?: boolean;
    /** Enable logging (default: true) */
    enableLogging?: boolean;
    /** Cooldown between executions in ms (default: 5000) */
    executionCooldown?: number;
    /** Enable auto-rebalancing (default: false) */
    enableRebalancer?: boolean;
    /** Minimum USDC ratio 0-1 (default: 0.2 = 20%) - Split if below */
    minUsdcRatio?: number;
    /** Maximum USDC ratio 0-1 (default: 0.8 = 80%) - Merge if above */
    maxUsdcRatio?: number;
    /** Target USDC ratio when rebalancing (default: 0.5 = 50%) */
    targetUsdcRatio?: number;
    /** Max YES/NO imbalance before auto-fix (default: 5 tokens) */
    imbalanceThreshold?: number;
    /** Rebalance check interval in ms (default: 10000) */
    rebalanceInterval?: number;
    /** Minimum cooldown between rebalance actions in ms (default: 30000) */
    rebalanceCooldown?: number;
    /** Size safety factor 0-1 (default: 0.8) - use only 80% of orderbook depth to prevent partial fills */
    sizeSafetyFactor?: number;
    /** Auto-fix imbalance after failed execution (default: true) */
    autoFixImbalance?: boolean;
}
export interface RebalanceAction {
    type: 'split' | 'merge' | 'sell_yes' | 'sell_no' | 'none';
    amount: number;
    reason: string;
    priority: number;
}
export interface RebalanceResult {
    success: boolean;
    action: RebalanceAction;
    txHash?: string;
    error?: string;
}
export interface SettleResult {
    market: ArbitrageMarketConfig;
    yesBalance: number;
    noBalance: number;
    pairedTokens: number;
    unpairedYes: number;
    unpairedNo: number;
    merged: boolean;
    mergeAmount?: number;
    mergeTxHash?: string;
    usdcRecovered?: number;
    error?: string;
}
export interface ClearPositionResult {
    market: ArbitrageMarketConfig;
    marketStatus: 'active' | 'resolved' | 'unknown';
    yesBalance: number;
    noBalance: number;
    actions: ClearAction[];
    totalUsdcRecovered: number;
    success: boolean;
    error?: string;
}
export interface ClearAction {
    type: 'merge' | 'sell_yes' | 'sell_no' | 'redeem';
    amount: number;
    usdcResult: number;
    txHash?: string;
    success: boolean;
    error?: string;
}
export interface ScanCriteria {
    /** Minimum 24h volume in USDC (default: 1000) */
    minVolume24h?: number;
    /** Maximum 24h volume (optional) */
    maxVolume24h?: number;
    /** Keywords to filter markets (optional) */
    keywords?: string[];
    /** Maximum number of markets to scan (default: 100) */
    limit?: number;
}
export interface ScanResult {
    /** Market config ready to use with start() */
    market: ArbitrageMarketConfig;
    /** Best arbitrage type */
    arbType: 'long' | 'short' | 'none';
    /** Profit rate (e.g., 0.01 = 1%) */
    profitRate: number;
    /** Profit percentage */
    profitPercent: number;
    /** Effective prices */
    effectivePrices: {
        buyYes: number;
        buyNo: number;
        sellYes: number;
        sellNo: number;
        longCost: number;
        shortRevenue: number;
    };
    /** 24h volume */
    volume24h: number;
    /** Available size on orderbook */
    availableSize: number;
    /** Score 0-100 */
    score: number;
    /** Description */
    description: string;
}
export interface OrderbookState {
    yesBids: Array<{
        price: number;
        size: number;
    }>;
    yesAsks: Array<{
        price: number;
        size: number;
    }>;
    noBids: Array<{
        price: number;
        size: number;
    }>;
    noAsks: Array<{
        price: number;
        size: number;
    }>;
    lastUpdate: number;
}
export interface BalanceState {
    usdc: number;
    yesTokens: number;
    noTokens: number;
    lastUpdate: number;
}
export interface ArbitrageOpportunity {
    type: 'long' | 'short';
    /** Profit rate (0.01 = 1%) */
    profitRate: number;
    /** Profit in percentage */
    profitPercent: number;
    /** Effective buy/sell prices */
    effectivePrices: {
        buyYes: number;
        buyNo: number;
        sellYes: number;
        sellNo: number;
    };
    /** Maximum executable size based on orderbook depth */
    maxOrderbookSize: number;
    /** Maximum executable size based on balance */
    maxBalanceSize: number;
    /** Recommended trade size */
    recommendedSize: number;
    /** Estimated profit in USDC */
    estimatedProfit: number;
    /** Description */
    description: string;
    /** Timestamp */
    timestamp: number;
}
export interface ArbitrageExecutionResult {
    success: boolean;
    type: 'long' | 'short';
    size: number;
    profit: number;
    txHashes: string[];
    error?: string;
    executionTimeMs: number;
}
export interface ArbitrageServiceEvents {
    opportunity: (opportunity: ArbitrageOpportunity) => void;
    execution: (result: ArbitrageExecutionResult) => void;
    balanceUpdate: (balance: BalanceState) => void;
    orderbookUpdate: (orderbook: OrderbookState) => void;
    rebalance: (result: RebalanceResult) => void;
    settle: (result: SettleResult) => void;
    error: (error: Error) => void;
    started: (market: ArbitrageMarketConfig) => void;
    stopped: () => void;
}
export declare class ArbitrageService extends EventEmitter {
    private wsManager;
    private ctf;
    private tradingClient;
    private rateLimiter;
    private market;
    private config;
    private orderbook;
    private balance;
    private isExecuting;
    private lastExecutionTime;
    private lastRebalanceTime;
    private balanceUpdateInterval;
    private rebalanceInterval;
    private isRunning;
    private totalCapital;
    private stats;
    constructor(config?: ArbitrageServiceConfig);
    /**
     * Start monitoring a market for arbitrage opportunities
     */
    start(market: ArbitrageMarketConfig): Promise<void>;
    /**
     * Stop monitoring
     */
    stop(): Promise<void>;
    /**
     * Get current orderbook state
     */
    getOrderbook(): OrderbookState;
    /**
     * Get current balance state
     */
    getBalance(): BalanceState;
    /**
     * Get statistics
     */
    getStats(): {
        runningTimeMs: number;
        opportunitiesDetected: number;
        executionsAttempted: number;
        executionsSucceeded: number;
        totalProfit: number;
        startTime: number;
    };
    /**
     * Check for arbitrage opportunity based on current orderbook
     */
    checkOpportunity(): ArbitrageOpportunity | null;
    /**
     * Manually execute an arbitrage opportunity
     */
    execute(opportunity: ArbitrageOpportunity): Promise<ArbitrageExecutionResult>;
    /**
     * Calculate recommended rebalance action based on current state
     */
    calculateRebalanceAction(): RebalanceAction;
    /**
     * Execute a rebalance action
     */
    rebalance(action?: RebalanceAction): Promise<RebalanceResult>;
    /**
     * Settle a market position - merge paired tokens to recover USDC
     * @param market Market to settle (defaults to current market)
     * @param execute If true, execute the merge. If false, just return info.
     */
    settlePosition(market?: ArbitrageMarketConfig, execute?: boolean): Promise<SettleResult>;
    /**
     * Settle multiple markets at once
     */
    settleMultiple(markets: ArbitrageMarketConfig[], execute?: boolean): Promise<SettleResult[]>;
    /**
     * Clear all positions in a market using the best strategy
     *
     * Strategy:
     * - Active market: Merge paired tokens → Sell remaining unpaired tokens
     * - Resolved market: Redeem winning tokens
     *
     * @param market Market to clear positions from
     * @param execute If true, execute the clearing. If false, just return info.
     * @returns Result with all actions taken
     *
     * @example
     * ```typescript
     * const service = new ArbitrageService({ privateKey: '0x...' });
     *
     * // View clearing plan
     * const plan = await service.clearPositions(market, false);
     * console.log(`Will recover: $${plan.totalUsdcRecovered}`);
     *
     * // Execute clearing
     * const result = await service.clearPositions(market, true);
     * ```
     */
    clearPositions(market: ArbitrageMarketConfig, execute?: boolean): Promise<ClearPositionResult>;
    /**
     * Clear positions from multiple markets
     *
     * @param markets Markets to clear
     * @param execute If true, execute clearing
     * @returns Results for all markets
     */
    clearAllPositions(markets: ArbitrageMarketConfig[], execute?: boolean): Promise<ClearPositionResult[]>;
    private handleBookUpdate;
    private checkAndHandleOpportunity;
    private checkAndRebalance;
    /**
     * Fix YES/NO imbalance immediately after partial execution
     * This is critical when one side of a parallel order fails
     */
    private fixImbalanceIfNeeded;
    private updateBalance;
    private executeLongArb;
    private executeShortArb;
    private log;
    /**
     * Scan markets for arbitrage opportunities
     *
     * @param criteria Filter criteria for markets
     * @param minProfit Minimum profit threshold (default: 0.005 = 0.5%)
     * @returns Array of scan results sorted by profit
     *
     * @example
     * ```typescript
     * const service = new ArbitrageService({ privateKey: '0x...' });
     *
     * // Scan markets with at least $5000 volume
     * const results = await service.scanMarkets({ minVolume24h: 5000 }, 0.005);
     *
     * // Start arbitraging the best opportunity
     * if (results.length > 0 && results[0].arbType !== 'none') {
     *   await service.start(results[0].market);
     * }
     * ```
     */
    scanMarkets(criteria?: ScanCriteria, minProfit?: number): Promise<ScanResult[]>;
    /**
     * Quick scan for best arbitrage opportunities
     *
     * @param minProfit Minimum profit threshold (default: 0.005 = 0.5%)
     * @param limit Maximum number of results to return (default: 10)
     * @returns Top arbitrage opportunities
     *
     * @example
     * ```typescript
     * const service = new ArbitrageService({ privateKey: '0x...' });
     *
     * // Find best arbitrage opportunities
     * const top = await service.quickScan(0.005, 5);
     *
     * // Print results
     * for (const r of top) {
     *   console.log(`${r.market.name}: ${r.arbType} +${r.profitPercent.toFixed(2)}%`);
     * }
     *
     * // Start the best one
     * if (top.length > 0) {
     *   await service.start(top[0].market);
     * }
     * ```
     */
    quickScan(minProfit?: number, limit?: number): Promise<ScanResult[]>;
    /**
     * Find and start arbitraging the best opportunity
     *
     * @param minProfit Minimum profit threshold (default: 0.005 = 0.5%)
     * @returns The scan result that was started, or null if none found
     *
     * @example
     * ```typescript
     * const service = new ArbitrageService({
     *   privateKey: '0x...',
     *   autoExecute: true,
     *   profitThreshold: 0.005,
     * });
     *
     * // Find and start the best opportunity
     * const started = await service.findAndStart(0.005);
     * if (started) {
     *   console.log(`Started: ${started.market.name} (+${started.profitPercent.toFixed(2)}%)`);
     * }
     * ```
     */
    findAndStart(minProfit?: number): Promise<ScanResult | null>;
}
