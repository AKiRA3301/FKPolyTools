/**
 * Swap Service
 *
 * Provides DEX swap functionality on Polygon using QuickSwap V3.
 * Supports swapping between various tokens including MATIC, WETH, USDC, USDC.e, USDT, DAI.
 */
import { ethers } from 'ethers';
export declare const QUICKSWAP_ROUTER = "0xf5b509bB0909a69B1c207E495f687a596C168E12";
export declare const QUICKSWAP_QUOTER = "0xa15F0D7377B2A0C0c10db057f641beD21028FC89";
export declare const QUICKSWAP_FACTORY = "0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28";
export declare const WMATIC = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
/**
 * Supported tokens on Polygon
 *
 * ⚠️ IMPORTANT: USDC vs USDC.e for Polymarket CTF
 *
 * | Token       | Address                                    | Polymarket CTF |
 * |-------------|--------------------------------------------|-----------------
 * | USDC_E      | 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 | ✅ Required    |
 * | USDC/NATIVE | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 | ❌ Not accepted|
 *
 * For Polymarket CTF operations (split/merge/redeem):
 * - Use transferUsdcE() to send USDC.e
 * - Use swap('USDC', 'USDC_E', amount) to convert native USDC to USDC.e
 *
 * For general transfers:
 * - transferUsdc() sends native USDC (most DEXs, CEXs use this)
 * - transferUsdcE() sends bridged USDC.e (Polymarket CTF requires this)
 */
export declare const POLYGON_TOKENS: {
    readonly MATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
    readonly WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
    readonly USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
    readonly NATIVE_USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
    readonly USDC_E: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    readonly USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
    readonly DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063";
    readonly WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
};
export declare const TOKEN_DECIMALS: Record<string, number>;
export type SupportedToken = keyof typeof POLYGON_TOKENS;
export interface SwapQuote {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    estimatedAmountOut: string;
    minAmountOut: string;
    slippage: number;
    priceImpact: string;
}
/** Quote result from Quoter contract */
export interface QuoteResult {
    possible: boolean;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string | null;
    route: string[];
    poolExists: boolean;
    reason?: string;
}
/** Pool info */
export interface PoolInfo {
    tokenA: string;
    tokenB: string;
    poolAddress: string | null;
    exists: boolean;
}
export interface SwapResult {
    success: boolean;
    transactionHash: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    gasUsed: string;
}
export interface TokenBalance {
    token: string;
    symbol: string;
    balance: string;
    decimals: number;
}
export interface TransferResult {
    success: boolean;
    transactionHash: string;
    token: string;
    to: string;
    amount: string;
    gasUsed: string;
}
export declare class SwapService {
    private signer;
    private provider;
    private router;
    private quoter;
    private factory;
    constructor(signer: ethers.Wallet);
    /**
     * Get dynamic gas options for Polygon network
     * Uses RPC fee data with minimum priority fee of 30 gwei
     */
    private getGasOptions;
    /**
     * Get the wallet address
     */
    get address(): string;
    /**
     * Get token address from symbol
     */
    getTokenAddress(token: string): string;
    /**
     * Get token decimals
     */
    getTokenDecimals(token: string): number;
    /**
     * Check if a pool exists for a token pair
     */
    checkPool(tokenA: string, tokenB: string): Promise<PoolInfo>;
    /**
     * Get all available pools for supported tokens
     */
    getAvailablePools(): Promise<PoolInfo[]>;
    /**
     * Get a quote for a swap (checks if route is possible)
     */
    getQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<QuoteResult>;
    /**
     * Execute a multi-hop swap
     */
    swapMultiHop(tokenIn: string, tokenOut: string, amountIn: string, route: string[], options?: {
        slippage?: number;
        deadline?: number;
    }): Promise<SwapResult>;
    /**
     * Get balances for all supported tokens
     */
    getBalances(): Promise<TokenBalance[]>;
    /**
     * Get balance for a specific token
     */
    getBalance(token: string): Promise<string>;
    /**
     * Wrap native MATIC to WMATIC
     */
    wrapMatic(amount: string): Promise<SwapResult>;
    /**
     * Unwrap WMATIC to native MATIC
     */
    unwrapMatic(amount: string): Promise<SwapResult>;
    /**
     * Execute a token swap using QuickSwap V3
     */
    swap(tokenIn: string, tokenOut: string, amountIn: string, options?: {
        slippage?: number;
        deadline?: number;
    }): Promise<SwapResult>;
    /**
     * Swap any supported token to USDC (for deposit)
     */
    swapToUsdc(tokenIn: string, amountIn: string, options?: {
        usdcType?: 'NATIVE_USDC' | 'USDC_E';
        slippage?: number;
    }): Promise<SwapResult>;
    /**
     * Get list of supported tokens
     */
    getSupportedTokens(): string[];
    /**
     * Get balances for any wallet address (static method, no signer required)
     */
    static getWalletBalances(address: string, provider?: ethers.providers.Provider): Promise<TokenBalance[]>;
    /**
     * Get balance for a specific token for any wallet (static)
     */
    static getWalletBalance(address: string, token: string, provider?: ethers.providers.Provider): Promise<string>;
    /**
     * Transfer native MATIC (POL) to another address
     */
    transferMatic(to: string, amount: string): Promise<TransferResult>;
    /**
     * Transfer an ERC20 token to another address
     */
    transfer(token: string, to: string, amount: string): Promise<TransferResult>;
    /**
     * Transfer native USDC to another address
     *
     * ⚠️ WARNING: This transfers NATIVE USDC (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
     *
     * For Polymarket CTF operations, you need USDC.e instead.
     * Use transferUsdcE() for Polymarket CTF compatibility.
     *
     * @see transferUsdcE - For Polymarket CTF operations
     */
    transferUsdc(to: string, amount: string): Promise<TransferResult>;
    /**
     * Transfer USDC.e (bridged USDC) to another address
     *
     * ✅ This is the correct method for Polymarket CTF operations.
     *
     * Polymarket's Conditional Token Framework (CTF) only accepts
     * USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174).
     *
     * If you're funding a wallet for CTF trading, use this method.
     *
     * @example
     * ```typescript
     * // Fund a session wallet for Polymarket trading
     * await swapService.transferUsdcE(sessionWallet, '100');
     *
     * // The session wallet can now perform CTF operations
     * await ctf.split(conditionId, '100');
     * ```
     */
    transferUsdcE(to: string, amount: string): Promise<TransferResult>;
}
