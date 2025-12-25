/**
 * Market Service
 *
 * Provides enhanced market analysis features:
 * - K-Line aggregation from trade data
 * - Dual token K-Lines (YES + NO)
 * - Spread analysis
 * - Market signal detection
 */
import { DataApiClient } from '../clients/data-api.js';
import { GammaApiClient, GammaMarket } from '../clients/gamma-api.js';
import { ClobApiClient } from '../clients/clob-api.js';
import type { UnifiedCache } from '../core/unified-cache.js';
import type { UnifiedMarket, ProcessedOrderbook, ArbitrageOpportunity, KLineInterval, KLineCandle, DualKLineData, RealtimeSpreadAnalysis } from '../core/types.js';
export declare class MarketService {
    private gammaApi;
    private clobApi;
    private dataApi;
    private cache;
    constructor(gammaApi: GammaApiClient, clobApi: ClobApiClient, dataApi: DataApiClient, cache: UnifiedCache);
    /**
     * Get market by slug or condition ID
     */
    getMarket(identifier: string): Promise<UnifiedMarket>;
    private getMarketBySlug;
    private getMarketByConditionId;
    /**
     * Get K-Line candles for a market (single token)
     */
    getKLines(conditionId: string, interval: KLineInterval, options?: {
        limit?: number;
        tokenId?: string;
        outcomeIndex?: number;
    }): Promise<KLineCandle[]>;
    /**
     * Get dual K-Lines (YES + NO tokens)
     */
    getDualKLines(conditionId: string, interval: KLineInterval, options?: {
        limit?: number;
    }): Promise<DualKLineData>;
    /**
     * Aggregate trades into K-Line candles
     */
    private aggregateToKLines;
    /**
     * Analyze historical spread from trade close prices (for backtesting)
     *
     * This uses trade close prices, not orderbook bid/ask.
     * Useful for:
     * - Historical analysis / backtesting
     * - Understanding past price movements
     * - Identifying patterns when orderbook data unavailable
     */
    private analyzeHistoricalSpread;
    /**
     * Calculate real-time spread from orderbook (for live trading)
     *
     * This uses orderbook bid/ask prices for accurate arbitrage detection.
     * Useful for:
     * - Real-time arbitrage execution
     * - Live trading decisions
     * - Accurate profit calculations
     */
    private calculateRealtimeSpread;
    /**
     * Get real-time spread analysis only (without K-lines)
     * Use this for quick arbitrage checks
     */
    getRealtimeSpread(conditionId: string): Promise<RealtimeSpreadAnalysis>;
    /**
     * Get processed orderbook with analytics
     */
    getOrderbook(conditionId: string): Promise<ProcessedOrderbook>;
    /**
     * Detect arbitrage opportunity
     *
     * 使用有效价格（考虑镜像订单）计算套利机会
     * 详细原理见: docs/01-polymarket-orderbook-arbitrage.md
     */
    detectArbitrage(conditionId: string, threshold?: number): Promise<ArbitrageOpportunity | null>;
    /**
     * Get trending markets
     */
    getTrendingMarkets(limit?: number): Promise<GammaMarket[]>;
    /**
     * Search markets
     */
    searchMarkets(params: {
        active?: boolean;
        closed?: boolean;
        limit?: number;
        offset?: number;
        order?: string;
    }): Promise<GammaMarket[]>;
    /**
     * Detect market signals (volume surge, depth imbalance, whale trades)
     */
    detectMarketSignals(conditionId: string): Promise<Array<{
        type: 'volume_surge' | 'depth_imbalance' | 'whale_trade' | 'momentum';
        severity: 'low' | 'medium' | 'high';
        details: Record<string, unknown>;
    }>>;
    private mergeMarkets;
    private fromGammaMarket;
    private fromClobMarket;
}
export declare function getIntervalMs(interval: KLineInterval): number;
