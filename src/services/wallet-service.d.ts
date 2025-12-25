/**
 * Wallet Service
 *
 * Provides smart money analysis features:
 * - Wallet profile analysis
 * - Position tracking
 * - Activity monitoring
 * - Sell detection for follow wallet strategy
 */
import { DataApiClient, Position, Activity, LeaderboardEntry, LeaderboardPage } from '../clients/data-api.js';
import type { UnifiedCache } from '../core/unified-cache.js';
export interface WalletProfile {
    address: string;
    totalPnL: number;
    realizedPnL: number;
    unrealizedPnL: number;
    avgPercentPnL: number;
    positionCount: number;
    tradeCount: number;
    smartScore: number;
    lastActiveAt: Date;
}
export interface WalletActivitySummary {
    address: string;
    activities: Activity[];
    summary: {
        totalBuys: number;
        totalSells: number;
        buyVolume: number;
        sellVolume: number;
        activeMarkets: string[];
    };
}
export interface SellActivityResult {
    totalSellAmount: number;
    sellTransactions: Activity[];
    sellRatio: number;
    shouldExit: boolean;
}
export declare class WalletService {
    private dataApi;
    private cache;
    constructor(dataApi: DataApiClient, cache: UnifiedCache);
    /**
     * Get comprehensive wallet profile with PnL analysis
     */
    getWalletProfile(address: string): Promise<WalletProfile>;
    /**
     * Get wallet profile filtered by time period
     * @param address Wallet address
     * @param periodDays Number of days to look back (24h=1, 7d=7, 30d=30, all=0)
     */
    getWalletProfileForPeriod(address: string, periodDays: number): Promise<{
        pnl: number;
        volume: number;
        tradeCount: number;
        winRate: number;
        smartScore: number;
    }>;
    /**
     * Get positions for a wallet
     */
    getWalletPositions(address: string): Promise<Position[]>;
    /**
     * Get positions for a specific market
     */
    getPositionsForMarket(address: string, conditionId: string): Promise<Position[]>;
    /**
     * Get wallet activity with summary
     */
    getWalletActivity(address: string, limit?: number): Promise<WalletActivitySummary>;
    /**
     * Get leaderboard
     */
    getLeaderboard(page?: number, pageSize?: number): Promise<LeaderboardPage>;
    /**
     * Get top traders from leaderboard
     */
    getTopTraders(limit?: number): Promise<LeaderboardEntry[]>;
    /**
     * Discover active wallets from recent trades
     */
    discoverActiveWallets(limit?: number): Promise<Array<{
        address: string;
        tradeCount: number;
    }>>;
    /**
     * Detect sell activity for a wallet in a specific market
     */
    detectSellActivity(address: string, conditionId: string, sinceTimestamp: number, peakValue?: number): Promise<SellActivityResult>;
    /**
     * Track sell ratio for multiple wallets (aggregated)
     */
    trackGroupSellRatio(addresses: string[], conditionId: string, peakTotalValue: number, sinceTimestamp: number): Promise<{
        cumulativeSellAmount: number;
        sellRatio: number;
        shouldExit: boolean;
        walletSells: Array<{
            address: string;
            sellAmount: number;
        }>;
    }>;
    private calculateSmartScore;
    private calculateVariance;
}
