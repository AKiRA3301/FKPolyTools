/**
 * Wallet Service
 *
 * Provides smart money analysis features:
 * - Wallet profile analysis
 * - Position tracking
 * - Activity monitoring
 * - Sell detection for follow wallet strategy
 */
export class WalletService {
    dataApi;
    cache;
    constructor(dataApi, cache) {
        this.dataApi = dataApi;
        this.cache = cache;
    }
    // ===== Wallet Analysis =====
    /**
     * Get comprehensive wallet profile with PnL analysis
     */
    async getWalletProfile(address) {
        const [positions, activities] = await Promise.all([
            this.dataApi.getPositions(address),
            this.dataApi.getActivity(address, { limit: 100 }),
        ]);
        const totalPnL = positions.reduce((sum, p) => sum + (p.cashPnl || 0), 0);
        const realizedPnL = positions.reduce((sum, p) => sum + (p.realizedPnl || 0), 0);
        const unrealizedPnL = totalPnL - realizedPnL;
        const avgPercentPnL = positions.length > 0
            ? positions.reduce((sum, p) => sum + (p.percentPnl || 0), 0) / positions.length
            : 0;
        const lastActivity = activities[0];
        return {
            address,
            totalPnL,
            realizedPnL,
            unrealizedPnL,
            avgPercentPnL,
            positionCount: positions.length,
            tradeCount: activities.filter((a) => a.type === 'TRADE').length,
            smartScore: this.calculateSmartScore(positions, activities),
            lastActiveAt: lastActivity ? new Date(lastActivity.timestamp) : new Date(0),
        };
    }
    /**
     * Get wallet profile filtered by time period
     * @param address Wallet address
     * @param periodDays Number of days to look back (24h=1, 7d=7, 30d=30, all=0)
     */
    async getWalletProfileForPeriod(address, periodDays) {
        // 获取活动记录（尽量多获取以便计算）
        const activities = await this.dataApi.getActivity(address, { limit: 500 });
        // 按时间过滤
        const now = Date.now();
        const sinceTimestamp = periodDays > 0 ? now - periodDays * 24 * 60 * 60 * 1000 : 0;
        const filteredActivities = activities.filter(a => a.timestamp >= sinceTimestamp);
        // 计算统计数据
        const trades = filteredActivities.filter(a => a.type === 'TRADE');
        const buys = trades.filter(a => a.side === 'BUY');
        const sells = trades.filter(a => a.side === 'SELL');
        // 交易量 = 买入 + 卖出
        const volume = trades.reduce((sum, t) => sum + (t.usdcSize || t.size * t.price), 0);
        // 盈亏 = 卖出 - 买入 (简化计算)
        const buyValue = buys.reduce((sum, t) => sum + (t.usdcSize || t.size * t.price), 0);
        const sellValue = sells.reduce((sum, t) => sum + (t.usdcSize || t.size * t.price), 0);
        const pnl = sellValue - buyValue;
        // 胜率估算 (卖出价 > 买入均价的比例)
        const winRate = trades.length > 0 ? Math.min(0.9, 0.5 + (pnl / volume) * 0.5) : 0.5;
        // 评分
        const positions = await this.dataApi.getPositions(address);
        const smartScore = this.calculateSmartScore(positions, filteredActivities);
        return {
            pnl,
            volume,
            tradeCount: trades.length,
            winRate: Math.max(0, Math.min(1, winRate)),
            smartScore,
        };
    }
    /**
     * Get positions for a wallet
     */
    async getWalletPositions(address) {
        return this.dataApi.getPositions(address);
    }
    /**
     * Get positions for a specific market
     */
    async getPositionsForMarket(address, conditionId) {
        const positions = await this.dataApi.getPositions(address);
        return positions.filter((p) => p.conditionId === conditionId);
    }
    /**
     * Get wallet activity with summary
     */
    async getWalletActivity(address, limit = 100) {
        const activities = await this.dataApi.getActivity(address, { limit });
        const buys = activities.filter((a) => a.side === 'BUY');
        const sells = activities.filter((a) => a.side === 'SELL');
        return {
            address,
            activities,
            summary: {
                totalBuys: buys.length,
                totalSells: sells.length,
                buyVolume: buys.reduce((sum, a) => sum + (a.usdcSize || 0), 0),
                sellVolume: sells.reduce((sum, a) => sum + (a.usdcSize || 0), 0),
                activeMarkets: [...new Set(activities.map((a) => a.conditionId))],
            },
        };
    }
    // ===== Wallet Discovery =====
    /**
     * Get leaderboard
     */
    async getLeaderboard(page = 0, pageSize = 50) {
        return this.dataApi.getLeaderboard({ limit: pageSize, offset: page * pageSize });
    }
    /**
     * Get top traders from leaderboard
     */
    async getTopTraders(limit = 10) {
        const leaderboard = await this.dataApi.getLeaderboard({ limit });
        return leaderboard.entries;
    }
    /**
     * Discover active wallets from recent trades
     */
    async discoverActiveWallets(limit = 100) {
        const trades = await this.dataApi.getTrades({ limit: 1000 });
        // Count trades per wallet
        const walletCounts = new Map();
        for (const trade of trades) {
            if (trade.proxyWallet) {
                walletCounts.set(trade.proxyWallet, (walletCounts.get(trade.proxyWallet) || 0) + 1);
            }
        }
        // Sort by trade count
        return [...walletCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([address, tradeCount]) => ({ address, tradeCount }));
    }
    // ===== Sell Detection (Follow Wallet Strategy) =====
    /**
     * Detect sell activity for a wallet in a specific market
     */
    async detectSellActivity(address, conditionId, sinceTimestamp, peakValue) {
        const activities = await this.dataApi.getActivity(address, { limit: 200, type: 'TRADE' });
        const sellTransactions = activities.filter((a) => a.conditionId === conditionId && a.side === 'SELL' && a.timestamp >= sinceTimestamp);
        const totalSellAmount = sellTransactions.reduce((sum, a) => sum + (a.usdcSize || a.size * a.price), 0);
        // Calculate sell ratio if peak value is provided
        const sellRatio = peakValue && peakValue > 0 ? totalSellAmount / peakValue : 0;
        return {
            totalSellAmount,
            sellTransactions,
            sellRatio,
            shouldExit: sellRatio >= 0.3, // 30% threshold for exit signal
        };
    }
    /**
     * Track sell ratio for multiple wallets (aggregated)
     */
    async trackGroupSellRatio(addresses, conditionId, peakTotalValue, sinceTimestamp) {
        const walletSells = [];
        let cumulativeSellAmount = 0;
        for (const address of addresses) {
            const sellData = await this.detectSellActivity(address, conditionId, sinceTimestamp);
            walletSells.push({ address, sellAmount: sellData.totalSellAmount });
            cumulativeSellAmount += sellData.totalSellAmount;
        }
        const sellRatio = peakTotalValue > 0 ? cumulativeSellAmount / peakTotalValue : 0;
        return {
            cumulativeSellAmount,
            sellRatio,
            shouldExit: sellRatio >= 0.3,
            walletSells,
        };
    }
    // ===== Smart Score Calculation =====
    calculateSmartScore(positions, activities) {
        // Weights: PnL 40%, Win Rate 30%, Consistency 20%, Activity 10%
        // PnL Score (0-40)
        const avgPnL = positions.length > 0
            ? positions.reduce((sum, p) => sum + (p.percentPnl || 0), 0) / positions.length
            : 0;
        const pnlScore = Math.min(40, Math.max(0, ((avgPnL + 50) / 100) * 40));
        // Win Rate Score (0-30)
        const winningPositions = positions.filter((p) => (p.cashPnl || 0) > 0).length;
        const winRate = positions.length > 0 ? winningPositions / positions.length : 0;
        const winRateScore = winRate * 30;
        // Consistency Score (0-20)
        const pnlValues = positions.map((p) => p.percentPnl || 0);
        const variance = this.calculateVariance(pnlValues);
        const consistencyScore = Math.max(0, 20 - variance / 10);
        // Activity Score (0-10)
        const recentTrades = activities.filter((a) => a.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000).length;
        const activityScore = Math.min(10, (recentTrades / 5) * 10);
        return Math.round(pnlScore + winRateScore + consistencyScore + activityScore);
    }
    calculateVariance(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    }
}
