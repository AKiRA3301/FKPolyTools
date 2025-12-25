/**
 * Data API Client for Polymarket
 * Handles: positions, activity, trades, leaderboard
 */
import { RateLimiter } from '../core/rate-limiter.js';
import type { UnifiedCache } from '../core/unified-cache.js';
export interface Position {
    proxyWallet?: string;
    asset: string;
    conditionId: string;
    outcome: string;
    outcomeIndex: number;
    size: number;
    avgPrice: number;
    curPrice?: number;
    totalBought?: number;
    initialValue?: number;
    currentValue?: number;
    cashPnl?: number;
    percentPnl?: number;
    realizedPnl?: number;
    percentRealizedPnl?: number;
    title: string;
    slug?: string;
    icon?: string;
    eventId?: string;
    eventSlug?: string;
    oppositeOutcome?: string;
    oppositeAsset?: string;
    redeemable?: boolean;
    mergeable?: boolean;
    endDate?: string;
    negativeRisk?: boolean;
}
export interface Activity {
    type: 'TRADE' | 'SPLIT' | 'MERGE' | 'REDEEM' | 'CONVERSION';
    side: 'BUY' | 'SELL';
    size: number;
    price: number;
    usdcSize?: number;
    asset: string;
    conditionId: string;
    outcome: string;
    outcomeIndex?: number;
    timestamp: number;
    transactionHash: string;
    title?: string;
    slug?: string;
    name?: string;
}
export interface Trade {
    id?: string;
    market: string;
    asset: string;
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    outcome: string;
    outcomeIndex: number;
    timestamp: number;
    transactionHash: string;
    proxyWallet?: string;
    title?: string;
    slug?: string;
    icon?: string;
    eventSlug?: string;
    name?: string;
    pseudonym?: string;
    bio?: string;
    profileImage?: string;
    profileImageOptimized?: string;
}
export interface LeaderboardEntry {
    address: string;
    rank: number;
    pnl: number;
    volume: number;
    userName?: string;
    xUsername?: string;
    verifiedBadge?: boolean;
    profileImage?: string;
    positions?: number;
    trades?: number;
}
export interface LeaderboardPage {
    entries: LeaderboardEntry[];
    total: number;
    offset: number;
    limit: number;
}
export declare class DataApiClient {
    private rateLimiter;
    private cache;
    constructor(rateLimiter: RateLimiter, cache: UnifiedCache);
    /**
     * Get positions for a wallet address
     */
    getPositions(address: string): Promise<Position[]>;
    /**
     * Get activity for a wallet address
     */
    getActivity(address: string, params?: {
        limit?: number;
        type?: string;
    }): Promise<Activity[]>;
    /**
     * Get recent trades
     */
    getTrades(params?: {
        limit?: number;
        market?: string;
    }): Promise<Trade[]>;
    /**
     * Get trades for a specific market
     */
    getTradesByMarket(conditionId: string, limit?: number): Promise<Trade[]>;
    /**
     * Get leaderboard page
     */
    getLeaderboard(params?: {
        limit?: number;
        offset?: number;
    }): Promise<LeaderboardPage>;
    /**
     * Get all leaderboard entries up to a max count
     */
    getAllLeaderboard(maxEntries?: number): Promise<LeaderboardEntry[]>;
    private normalizePositions;
    private normalizeActivities;
    private normalizeTrades;
    private normalizeTimestamp;
    private normalizeLeaderboardEntries;
}
