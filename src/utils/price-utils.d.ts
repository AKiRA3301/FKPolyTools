/**
 * Price Utilities for Polymarket Trading
 *
 * Provides helpers for:
 * - Price validation and rounding to tick size
 * - Size validation
 * - Order amount calculation
 */
export type TickSize = '0.1' | '0.01' | '0.001' | '0.0001';
export declare const ROUNDING_CONFIG: Record<TickSize, {
    price: number;
    size: number;
    amount: number;
}>;
/**
 * Round a price to the appropriate tick size
 *
 * @param price - The price to round (0 to 1)
 * @param tickSize - The tick size for the market
 * @param direction - 'floor' for sells, 'ceil' for buys, 'round' for midpoint
 * @returns Rounded price
 *
 * @example
 * roundPrice(0.523, '0.01', 'floor') // 0.52
 * roundPrice(0.523, '0.01', 'ceil') // 0.53
 */
export declare function roundPrice(price: number, tickSize: TickSize, direction?: 'floor' | 'ceil' | 'round'): number;
/**
 * Round a size to valid decimals (always 2 decimal places)
 */
export declare function roundSize(size: number): number;
/**
 * Validate a price is within valid range and tick size
 *
 * @param price - The price to validate
 * @param tickSize - The tick size for the market
 * @returns Validation result with error message if invalid
 */
export declare function validatePrice(price: number, tickSize: TickSize): {
    valid: boolean;
    error?: string;
};
/**
 * Validate minimum size requirements
 *
 * @param size - The size to validate
 * @param minOrderSize - Minimum order size from market config (usually 0.1)
 */
export declare function validateSize(size: number, minOrderSize?: number): {
    valid: boolean;
    error?: string;
};
/**
 * Calculate the amount needed for a buy order (in USDC)
 *
 * @param price - Price per share
 * @param size - Number of shares to buy
 * @returns Amount in USDC
 */
export declare function calculateBuyAmount(price: number, size: number): number;
/**
 * Calculate the payout for a sell order (in USDC)
 *
 * @param price - Price per share
 * @param size - Number of shares to sell
 * @returns Amount in USDC
 */
export declare function calculateSellPayout(price: number, size: number): number;
/**
 * Calculate number of shares that can be bought with a given amount
 *
 * @param amount - USDC amount to spend
 * @param price - Price per share
 * @returns Number of shares
 */
export declare function calculateSharesForAmount(amount: number, price: number): number;
/**
 * Calculate the spread between bid and ask
 *
 * @param bid - Highest bid price
 * @param ask - Lowest ask price
 * @returns Spread as a decimal (0 to 1)
 */
export declare function calculateSpread(bid: number, ask: number): number;
/**
 * Calculate the midpoint price between bid and ask
 *
 * @param bid - Highest bid price
 * @param ask - Lowest ask price
 * @returns Midpoint price
 */
export declare function calculateMidpoint(bid: number, ask: number): number;
/**
 * 计算有效价格（考虑 Polymarket 订单簿的镜像特性）
 *
 * Polymarket 的关键特性：买 YES @ P = 卖 NO @ (1-P)
 * 因此同一订单会在两个订单簿中出现
 *
 * 有效价格是考虑镜像后的最优价格
 *
 * @param yesAsk - YES token 的最低卖价
 * @param yesBid - YES token 的最高买价
 * @param noAsk - NO token 的最低卖价
 * @param noBid - NO token 的最高买价
 */
export declare function getEffectivePrices(yesAsk: number, yesBid: number, noAsk: number, noBid: number): {
    effectiveBuyYes: number;
    effectiveBuyNo: number;
    effectiveSellYes: number;
    effectiveSellNo: number;
};
/**
 * Check if there's an arbitrage opportunity
 *
 * 使用有效价格计算套利机会（正确考虑镜像订单）
 *
 * Long arb: Buy YES + Buy NO < 1 (使用有效买入价格)
 * Short arb: Sell YES + Sell NO > 1 (使用有效卖出价格)
 *
 * 详细文档见: docs/01-polymarket-orderbook-arbitrage.md
 *
 * @param yesAsk - Lowest ask for YES token
 * @param noAsk - Lowest ask for NO token
 * @param yesBid - Highest bid for YES token
 * @param noBid - Highest bid for NO token
 * @returns Arbitrage info or null
 */
export declare function checkArbitrage(yesAsk: number, noAsk: number, yesBid: number, noBid: number): {
    type: 'long' | 'short';
    profit: number;
    description: string;
} | null;
/**
 * Format price for display
 */
export declare function formatPrice(price: number, tickSize?: TickSize): string;
/**
 * Format amount in USDC
 */
export declare function formatUSDC(amount: number): string;
/**
 * Calculate PnL for a position
 *
 * @param entryPrice - Average entry price
 * @param currentPrice - Current market price
 * @param size - Position size
 * @param side - 'long' for YES, 'short' for NO
 */
export declare function calculatePnL(entryPrice: number, currentPrice: number, size: number, side?: 'long' | 'short'): {
    pnl: number;
    pnlPercent: number;
};
