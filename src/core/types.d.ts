/**
 * Common types used across the SDK
 */
import type { CacheAdapter } from './cache-adapter-types.js';
/**
 * SDK Configuration Options
 *
 * Allows dependency injection of cache adapters for API response caching.
 *
 * @example
 * ```typescript
 * import { createMemoryCache } from '@catalyst-team/cache';
 * import { PolymarketSDK } from '@catalyst-team/poly-sdk';
 *
 * // Use external cache adapter
 * const cache = createMemoryCache({ defaultTTL: 120 });
 * const sdk = new PolymarketSDK({ cache });
 *
 * // Or use default internal cache
 * const sdk2 = new PolymarketSDK();
 * ```
 */
export interface PolySDKOptions {
    /**
     * Optional external cache adapter for API response caching.
     * If not provided, the SDK will use its internal memory cache.
     *
     * Benefits of external cache:
     * - Can use Redis for multi-instance cache sharing
     * - Can configure custom TTL settings
     * - Can track cache hit/miss statistics
     */
    cache?: CacheAdapter;
    /**
     * Blockchain chain ID (default: 137 for Polygon mainnet)
     */
    chainId?: number;
    /**
     * Ethereum signer for trading operations
     */
    signer?: unknown;
    /**
     * API credentials for trading
     */
    creds?: {
        key: string;
        secret: string;
        passphrase: string;
    };
}
export type KLineInterval = '30s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d';
export interface KLineCandle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    tradeCount: number;
    buyVolume: number;
    sellVolume: number;
}
/**
 * ============================================================================
 * Spread Analysis Types - Two Different Approaches
 * ============================================================================
 *
 * Polymarket 双代币模型：YES + NO = 1 USDC
 * 理想状态下，YES_price + NO_price = 1.0
 * 偏离 1.0 时可能存在套利机会
 *
 * 我们提供两种 Spread 分析方式，各有优劣：
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SpreadDataPoint (历史分析)          │  RealtimeSpreadAnalysis (实时分析) │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  数据源: 成交记录的收盘价              │  数据源: 订单簿的最优 bid/ask      │
 * │  YES_close + NO_close                │  YES_ask + NO_ask (买入成本)       │
 * │                                      │  YES_bid + NO_bid (卖出收入)       │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  ✅ 可构建历史曲线                    │  ❌ 无法构建历史曲线*               │
 * │  ✅ Polymarket 保留成交历史           │  ❌ Polymarket 不保留盘口历史       │
 * │  ✅ 适合回测、模式识别                │  ✅ 适合实盘交易、套利执行          │
 * │  ⚠️ 反映已成交价格，非当前可成交价    │  ✅ 反映当前可立即成交的价格        │
 * │  ⚠️ 套利信号仅供参考                  │  ✅ 套利利润计算准确                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * * 如需构建实时 Spread 的历史曲线，必须自行存储盘口快照数据
 *   参考: apps/api/src/services/spread-sampler.ts
 *
 * 核心区别说明：
 *
 * 1. 成交价 vs 盘口价
 *    - 成交价 (close): 过去某时刻实际成交的价格
 *    - 盘口价 (bid/ask): 当前市场上的最优挂单价格
 *    - 例: YES 最后成交 0.52，但当前 bid=0.50, ask=0.54
 *
 * 2. 为什么套利计算用盘口价更准确？
 *    - 套利需要同时买入 YES 和 NO
 *    - 必须用 ask 价（卖方挂单）计算买入成本
 *    - 成交价可能是 bid 方成交，不代表你能以该价买入
 *
 * 3. 为什么历史分析只能用成交价？
 *    - Polymarket CLOB API 不保存历史盘口数据
 *    - 只有成交记录 (trades) 有历史
 *    - 除非你自己运行 spread-sampler 持续采样盘口
 */
/**
 * 历史 Spread 分析（基于成交收盘价）
 *
 * 用途：
 * - 历史趋势分析、回测
 * - 识别价格偏离模式
 * - 当盘口数据不可用时的替代方案
 *
 * 局限：
 * - priceSpread 仅反映成交价偏离，非实际可套利空间
 * - arbOpportunity 仅为参考信号，实际套利需查看盘口
 *
 * 数据来源：Polymarket Data API /trades 历史成交记录
 */
export interface SpreadDataPoint {
    timestamp: number;
    yesPrice: number;
    noPrice: number;
    priceSum: number;
    priceSpread: number;
    arbOpportunity: 'LONG' | 'SHORT' | '';
}
/**
 * 实时 Spread 分析（基于订单簿 bid/ask）
 *
 * 用途：
 * - 实盘套利决策
 * - 精确计算套利利润
 * - 监控当前市场状态
 *
 * 局限：
 * - ❌ 无法构建历史曲线 - Polymarket 不保存盘口历史
 * - 如需历史数据，必须自行运行采样服务持续存储盘口快照
 *   参考实现: apps/api/src/services/spread-sampler.ts
 *
 * 数据来源：Polymarket CLOB API /book 实时订单簿
 *
 * 套利逻辑：
 * - Long Arb (多头套利): askSum < 1 时，买入 YES + NO 成本 < 1 USDC
 *   利润 = 1 - askSum，因为最终一方会 resolve 为 1 USDC
 *
 * - Short Arb (空头套利): bidSum > 1 时，卖出 YES + NO 收入 > 1 USDC
 *   利润 = bidSum - 1，需要先铸造代币对（成本 1 USDC）
 */
export interface RealtimeSpreadAnalysis {
    timestamp: number;
    yesBid: number;
    yesAsk: number;
    noBid: number;
    noAsk: number;
    askSum: number;
    bidSum: number;
    askSpread: number;
    bidSpread: number;
    longArbProfit: number;
    shortArbProfit: number;
    arbOpportunity: 'LONG' | 'SHORT' | '';
    arbProfitPercent: number;
}
/**
 * 双代币 K 线数据（YES + NO）
 *
 * 包含两种 Spread 分析：
 * - spreadAnalysis: 历史曲线（基于成交价），可回溯
 * - realtimeSpread: 实时快照（基于盘口），仅当前时刻
 */
export interface DualKLineData {
    conditionId: string;
    interval: KLineInterval;
    market?: UnifiedMarket;
    yes: KLineCandle[];
    no: KLineCandle[];
    /**
     * 历史 Spread 分析（SpreadDataPoint[]）
     *
     * ✅ 可构建历史曲线 - 每个 K 线周期一个数据点
     * ⚠️ 基于成交价，套利信号仅供参考
     *
     * 用于：图表展示、趋势分析、回测
     */
    spreadAnalysis?: SpreadDataPoint[];
    /**
     * 实时 Spread 分析（RealtimeSpreadAnalysis）
     *
     * ✅ 套利计算准确 - 基于当前盘口 bid/ask
     * ❌ 仅当前时刻快照，无法构建历史曲线
     *
     * 如需实时 Spread 历史曲线，必须：
     * 1. 运行 spread-sampler 服务持续采样盘口
     * 2. 将快照存储到数据库
     * 3. 从数据库读取构建曲线
     *
     * 用于：实盘套利决策、当前市场状态展示
     */
    realtimeSpread?: RealtimeSpreadAnalysis;
    /** 完整订单簿数据（如需更多细节） */
    currentOrderbook?: ProcessedOrderbook;
}
/**
 * 有效价格（考虑镜像订单）
 *
 * Polymarket 的关键特性：买 YES @ P = 卖 NO @ (1-P)
 * 因此同一订单会在两个订单簿中出现
 *
 * 有效价格是考虑镜像后的最优价格：
 * - effectiveBuyYes = min(YES.ask, 1 - NO.bid)
 * - effectiveBuyNo = min(NO.ask, 1 - YES.bid)
 * - effectiveSellYes = max(YES.bid, 1 - NO.ask)
 * - effectiveSellNo = max(NO.bid, 1 - YES.ask)
 */
export interface EffectivePrices {
    effectiveBuyYes: number;
    effectiveBuyNo: number;
    effectiveSellYes: number;
    effectiveSellNo: number;
}
export interface ProcessedOrderbook {
    yes: {
        bid: number;
        ask: number;
        bidSize: number;
        askSize: number;
        bidDepth: number;
        askDepth: number;
        spread: number;
        tokenId?: string;
    };
    no: {
        bid: number;
        ask: number;
        bidSize: number;
        askSize: number;
        bidDepth: number;
        askDepth: number;
        spread: number;
        tokenId?: string;
    };
    summary: {
        askSum: number;
        bidSum: number;
        effectivePrices: EffectivePrices;
        effectiveLongCost: number;
        effectiveShortRevenue: number;
        longArbProfit: number;
        shortArbProfit: number;
        totalBidDepth: number;
        totalAskDepth: number;
        imbalanceRatio: number;
        yesSpread: number;
    };
}
export interface ArbitrageOpportunity {
    type: 'long' | 'short';
    profit: number;
    action: string;
    expectedProfit: number;
}
export interface PriceUpdate {
    assetId: string;
    price: number;
    midpoint: number;
    spread: number;
    timestamp: number;
}
export interface BookUpdate {
    assetId: string;
    bids: Array<{
        price: number;
        size: number;
    }>;
    asks: Array<{
        price: number;
        size: number;
    }>;
    timestamp: number;
}
export interface UnifiedMarket {
    conditionId: string;
    slug: string;
    question: string;
    description?: string;
    tokens: {
        yes: {
            tokenId: string;
            price: number;
        };
        no: {
            tokenId: string;
            price: number;
        };
    };
    volume: number;
    volume24hr?: number;
    liquidity: number;
    spread?: number;
    /** 1-day price change (from Gamma API) */
    oneDayPriceChange?: number;
    /** 1-week price change (from Gamma API) */
    oneWeekPriceChange?: number;
    active: boolean;
    closed: boolean;
    acceptingOrders: boolean;
    endDate: Date;
    source: 'gamma' | 'clob' | 'merged';
}
export declare function getIntervalMs(interval: KLineInterval): number;
