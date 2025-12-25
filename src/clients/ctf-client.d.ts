/**
 * CTF (Conditional Token Framework) Client
 *
 * Provides on-chain operations for Polymarket's conditional tokens:
 * - Split: USDC → YES + NO token pair
 * - Merge: YES + NO → USDC
 * - Redeem: Winning tokens → USDC (after market resolution)
 *
 * ⚠️ CRITICAL: Polymarket CTF uses USDC.e (bridged), NOT native USDC!
 *
 * | Token         | Address                                    | CTF Compatible |
 * |---------------|--------------------------------------------|-----------------
 * | USDC.e        | 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 | ✅ Yes         |
 * | Native USDC   | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 | ❌ No          |
 *
 * Common Mistake:
 * - Your wallet has native USDC but CTF operations fail
 * - Solution: Use SwapService.transferUsdcE() or swap native USDC to USDC.e
 *
 * Based on: docs/01-product-research/06-poly-sdk/05-ctf-integration-plan.md
 *
 * Contract: Gnosis Conditional Tokens on Polygon
 * https://docs.polymarket.com/developers/CTF/overview
 */
import { BigNumber } from 'ethers';
export declare const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
/**
 * USDC.e (Bridged USDC) - The ONLY USDC accepted by Polymarket CTF
 *
 * ⚠️ WARNING: This is NOT native USDC (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
 *
 * If your wallet has native USDC but CTF operations fail with "Insufficient USDC balance",
 * you need to swap your native USDC to USDC.e first using:
 * - SwapService.swap('USDC', 'USDC_E', amount)
 * - Or transfer USDC.e using SwapService.transferUsdcE()
 */
export declare const USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
/** Native USDC on Polygon - NOT compatible with CTF */
export declare const NATIVE_USDC_CONTRACT = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
export declare const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
export declare const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
export declare const USDC_DECIMALS = 6;
export interface CTFConfig {
    /** Private key for signing transactions */
    privateKey: string;
    /** RPC URL (default: Polygon mainnet) */
    rpcUrl?: string;
    /** Chain ID (default: 137 for Polygon) */
    chainId?: number;
    /** Gas price multiplier (default: 1.2) */
    gasPriceMultiplier?: number;
    /** Transaction confirmation blocks (default: 1) */
    confirmations?: number;
    /** Transaction timeout in ms (default: 60000) */
    txTimeout?: number;
}
export interface GasEstimate {
    /** Estimated gas units */
    gasUnits: string;
    /** Gas price in gwei */
    gasPriceGwei: string;
    /** Estimated cost in MATIC */
    costMatic: string;
    /** Estimated cost in USDC (at current MATIC price) */
    costUsdc: string;
    /** MATIC/USDC price used */
    maticPrice: number;
}
export interface TransactionStatus {
    txHash: string;
    status: 'pending' | 'confirmed' | 'failed' | 'reverted';
    confirmations: number;
    blockNumber?: number;
    gasUsed?: string;
    effectiveGasPrice?: string;
    errorReason?: string;
}
/** Common revert reasons */
export declare enum RevertReason {
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
    INSUFFICIENT_ALLOWANCE = "INSUFFICIENT_ALLOWANCE",
    CONDITION_NOT_RESOLVED = "CONDITION_NOT_RESOLVED",
    INVALID_PARTITION = "INVALID_PARTITION",
    INVALID_CONDITION = "INVALID_CONDITION",
    EXECUTION_REVERTED = "EXECUTION_REVERTED",
    TIMEOUT = "TIMEOUT",
    UNKNOWN = "UNKNOWN"
}
export interface SplitResult {
    success: boolean;
    txHash: string;
    amount: string;
    yesTokens: string;
    noTokens: string;
    gasUsed?: string;
}
export interface MergeResult {
    success: boolean;
    txHash: string;
    amount: string;
    usdcReceived: string;
    gasUsed?: string;
}
export interface RedeemResult {
    success: boolean;
    txHash: string;
    outcome: 'YES' | 'NO';
    tokensRedeemed: string;
    usdcReceived: string;
    gasUsed?: string;
}
export interface PositionBalance {
    conditionId: string;
    yesBalance: string;
    noBalance: string;
    yesPositionId: string;
    noPositionId: string;
}
export interface TokenIds {
    yesTokenId: string;
    noTokenId: string;
}
export interface MarketResolution {
    conditionId: string;
    isResolved: boolean;
    winningOutcome?: 'YES' | 'NO';
    payoutNumerators: [number, number];
    payoutDenominator: number;
}
export declare class CTFClient {
    private provider;
    private wallet;
    private ctfContract;
    private usdcContract;
    private gasPriceMultiplier;
    private confirmations;
    private txTimeout;
    private cachedMaticPrice;
    private maticPriceLastUpdated;
    constructor(config: CTFConfig);
    /**
     * Get wallet address
     */
    getAddress(): string;
    /**
     * Get USDC.e (bridged USDC) balance - the token used by Polymarket CTF
     *
     * ⚠️ Note: This returns USDC.e balance, NOT native USDC balance.
     * Polymarket CTF only accepts USDC.e (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174).
     *
     * Common issue: Your wallet shows USDC balance but this returns 0
     * - This means you have native USDC, not USDC.e
     * - Use SwapService.swap('USDC', 'USDC_E', amount) to convert
     */
    getUsdcBalance(): Promise<string>;
    /**
     * Get native USDC balance (for comparison/debugging)
     *
     * This is NOT the token used by CTF. Use getUsdcBalance() for CTF operations.
     */
    getNativeUsdcBalance(): Promise<string>;
    /**
     * Check if wallet is ready for CTF trading operations
     *
     * Verifies:
     * - Has sufficient USDC.e (not native USDC)
     * - Has MATIC for gas fees
     *
     * @param amount - Minimum USDC.e amount needed (e.g., "100" for 100 USDC.e)
     * @returns Ready status with balances and suggestions
     *
     * @example
     * ```typescript
     * const status = await ctf.checkReadyForCTF('100');
     * if (!status.ready) {
     *   console.log(status.suggestion);
     *   // "You have 50 native USDC but 0 USDC.e. Swap native USDC to USDC.e first."
     * }
     * ```
     */
    checkReadyForCTF(amount: string): Promise<{
        ready: boolean;
        usdcEBalance: string;
        nativeUsdcBalance: string;
        maticBalance: string;
        suggestion?: string;
    }>;
    /**
     * Split USDC into YES + NO tokens
     *
     * @param conditionId - Market condition ID
     * @param amount - USDC amount (e.g., "100" for 100 USDC)
     * @returns SplitResult with transaction details
     *
     * @example
     * ```typescript
     * const result = await ctf.split(conditionId, "100");
     * console.log(`Split ${result.amount} USDC into tokens`);
     * console.log(`TX: ${result.txHash}`);
     * ```
     */
    split(conditionId: string, amount: string): Promise<SplitResult>;
    /**
     * Merge YES + NO tokens back to USDC
     *
     * @param conditionId - Market condition ID
     * @param amount - Number of token pairs to merge (e.g., "100" for 100 YES + 100 NO)
     * @returns MergeResult with transaction details
     *
     * @example
     * ```typescript
     * // After buying 100 YES and 100 NO via TradingClient
     * const result = await ctf.merge(conditionId, "100");
     * console.log(`Received ${result.usdcReceived} USDC`);
     * ```
     */
    merge(conditionId: string, amount: string): Promise<MergeResult>;
    /**
     * Merge YES and NO tokens back into USDC using explicit token IDs
     *
     * This method uses the provided token IDs for balance checking, which is
     * necessary when working with Polymarket CLOB markets where token IDs
     * don't match the calculated position IDs.
     *
     * @param conditionId - Market condition ID
     * @param tokenIds - Token IDs from CLOB API
     * @param amount - Amount of tokens to merge
     * @returns MergeResult with transaction details
     */
    mergeByTokenIds(conditionId: string, tokenIds: TokenIds, amount: string): Promise<MergeResult>;
    /**
     * Redeem winning tokens after market resolution (Standard CTF)
     *
     * ⚠️ IMPORTANT: This method uses standard CTF position ID calculation.
     * It is ONLY suitable for:
     * - Standard Gnosis CTF markets (non-Polymarket)
     * - Markets where position IDs are calculated from conditionId using standard formula
     * - Direct CTF contract interactions without CLOB
     *
     * ❌ DO NOT USE for Polymarket CLOB markets!
     * Polymarket uses custom token IDs that differ from standard CTF position IDs.
     * For Polymarket, use `redeemByTokenIds()` instead.
     *
     * Position ID calculation: keccak256(collectionId, conditionId, indexSet)
     * - This formula may NOT match Polymarket's token IDs
     *
     * @param conditionId - Market condition ID
     * @param outcome - 'YES' or 'NO' (optional, auto-detects if not provided)
     * @returns RedeemResult with transaction details
     *
     * @example
     * ```typescript
     * // For standard CTF markets (NOT Polymarket)
     * const result = await ctf.redeem(conditionId);
     * console.log(`Redeemed ${result.tokensRedeemed} ${result.outcome} tokens`);
     * ```
     *
     * @see redeemByTokenIds - Use this for Polymarket CLOB markets
     */
    redeem(conditionId: string, outcome?: 'YES' | 'NO'): Promise<RedeemResult>;
    /**
     * Redeem winning tokens using Polymarket token IDs (Polymarket CLOB)
     *
     * ✅ USE THIS for Polymarket CLOB markets!
     *
     * Polymarket uses custom token IDs that are different from standard CTF position IDs.
     * These token IDs are provided by the CLOB API and must be used for:
     * - Querying balances (getPositionBalanceByTokenIds)
     * - Redeeming positions (this method)
     * - Trading via CLOB API
     *
     * Why Polymarket token IDs differ:
     * - Polymarket wraps CTF positions into ERC-1155 tokens with custom IDs
     * - The token IDs from CLOB API (e.g., "25064375...") are NOT the same as
     *   calculated position IDs from keccak256(collectionId, conditionId, indexSet)
     *
     * @param conditionId - The condition ID of the market
     * @param tokenIds - The Polymarket token IDs for YES and NO outcomes (from CLOB API)
     * @param outcome - Optional: which outcome to redeem ('YES' or 'NO'). Auto-detects if not provided.
     * @returns RedeemResult with transaction details
     *
     * @example
     * ```typescript
     * // For Polymarket CLOB markets
     * const tokenIds = {
     *   yesTokenId: '25064375110792967023484002819116042931016336431092144471807003884255851454283',
     *   noTokenId: '98190367690492181203391990709979106077460946443309150166954079213761598385827',
     * };
     * const result = await ctf.redeemByTokenIds(conditionId, tokenIds);
     * console.log(`Redeemed ${result.tokensRedeemed} ${result.outcome} tokens`);
     * console.log(`Received ${result.usdcReceived} USDC`);
     * ```
     *
     * @see redeem - Only use for standard CTF markets (non-Polymarket)
     */
    redeemByTokenIds(conditionId: string, tokenIds: TokenIds, outcome?: 'YES' | 'NO'): Promise<RedeemResult>;
    /**
     * Get token balances for a market using calculated position IDs
     *
     * NOTE: This method calculates position IDs from conditionId, which may not match
     * the token IDs used by Polymarket's CLOB API. For accurate balances when working
     * with CLOB markets, use getPositionBalanceByTokenIds() with the token IDs from
     * the CLOB API.
     *
     * @deprecated Use getPositionBalanceByTokenIds for CLOB markets
     */
    getPositionBalance(conditionId: string): Promise<PositionBalance>;
    /**
     * Get token balances using CLOB API token IDs
     *
     * This is the recommended method for checking balances when working with
     * Polymarket CLOB markets. The token IDs should be obtained from the CLOB API
     * (e.g., from ClobApiClient.getMarket()).
     *
     * @param conditionId - Market condition ID (for reference)
     * @param tokenIds - Token IDs from CLOB API { yesTokenId, noTokenId }
     * @returns PositionBalance with accurate balances
     *
     * @example
     * ```typescript
     * // Get token IDs from CLOB API
     * const market = await clobApi.getMarket(conditionId);
     * const tokenIds = {
     *   yesTokenId: market.tokens[0].tokenId,
     *   noTokenId: market.tokens[1].tokenId,
     * };
     *
     * // Check balances
     * const balance = await ctf.getPositionBalanceByTokenIds(conditionId, tokenIds);
     * console.log(`YES: ${balance.yesBalance}, NO: ${balance.noBalance}`);
     * ```
     */
    getPositionBalanceByTokenIds(conditionId: string, tokenIds: TokenIds): Promise<PositionBalance>;
    /**
     * Check if a market is resolved and get payout info
     */
    getMarketResolution(conditionId: string): Promise<MarketResolution>;
    /**
     * Estimate gas for split operation
     */
    estimateSplitGas(conditionId: string, amount: string): Promise<string>;
    /**
     * Estimate gas for merge operation
     */
    estimateMergeGas(conditionId: string, amount: string): Promise<string>;
    /**
     * Get detailed gas estimate for a split operation
     */
    getDetailedSplitGasEstimate(conditionId: string, amount: string): Promise<GasEstimate>;
    /**
     * Get detailed gas estimate for a merge operation
     */
    getDetailedMergeGasEstimate(conditionId: string, amount: string): Promise<GasEstimate>;
    /**
     * Get current gas price info
     */
    getGasPrice(): Promise<{
        gwei: string;
        wei: string;
    }>;
    /**
     * Get or refresh MATIC price (cached for 5 minutes)
     */
    getMaticPrice(): Promise<number>;
    /**
     * Set MATIC price manually (for testing or when external price is available)
     */
    setMaticPrice(price: number): void;
    /**
     * Get transaction status with detailed info
     */
    getTransactionStatus(txHash: string): Promise<TransactionStatus>;
    /**
     * Wait for transaction confirmation with timeout
     */
    waitForTransaction(txHash: string, confirmations?: number): Promise<TransactionStatus>;
    /**
     * Parse revert reason from transaction
     */
    getRevertReason(txHash: string): Promise<string>;
    /**
     * Get all positions for the wallet across multiple markets
     */
    getAllPositions(conditionIds: string[]): Promise<PositionBalance[]>;
    /**
     * Check if wallet has sufficient tokens for merge
     *
     * @deprecated Use canMergeWithTokenIds for CLOB markets
     */
    canMerge(conditionId: string, amount: string): Promise<{
        canMerge: boolean;
        reason?: string;
    }>;
    /**
     * Check if wallet has sufficient tokens for merge using CLOB token IDs
     *
     * @param conditionId - Market condition ID
     * @param tokenIds - Token IDs from CLOB API
     * @param amount - Amount to merge
     */
    canMergeWithTokenIds(conditionId: string, tokenIds: TokenIds, amount: string): Promise<{
        canMerge: boolean;
        reason?: string;
    }>;
    private checkMergeBalance;
    /**
     * Check if wallet has sufficient USDC for split
     */
    canSplit(amount: string): Promise<{
        canSplit: boolean;
        reason?: string;
    }>;
    /**
     * Get total portfolio value across positions
     */
    getPortfolioValue(positions: PositionBalance[], prices: Map<string, {
        yes: number;
        no: number;
    }>): Promise<{
        totalValue: number;
        breakdown: Array<{
            conditionId: string;
            yesValue: number;
            noValue: number;
            totalValue: number;
        }>;
    }>;
    /**
     * Calculate position ID for a given outcome (INTERNAL USE ONLY)
     *
     * ⚠️ WARNING: This calculation does NOT produce correct Polymarket token IDs!
     *
     * Polymarket uses custom token IDs that differ from standard CTF position ID calculation.
     * The token IDs from CLOB API (e.g., "104173557214744537570424345347209544585775842950109756851652855913015295701992")
     * are NOT the same as what this function calculates.
     *
     * For Polymarket CLOB markets, ALWAYS:
     * 1. Get token IDs from CLOB API: https://clob.polymarket.com/markets/{conditionId}
     * 2. Use getPositionBalanceByTokenIds() instead of getPositionBalance()
     * 3. Use mergeByTokenIds() instead of merge()
     * 4. Use redeemByTokenIds() instead of redeem()
     *
     * This method is kept for potential non-Polymarket CTF markets only.
     *
     * @deprecated Use CLOB API token IDs for Polymarket markets
     */
    private calculatePositionId;
    /**
     * Get gas options for Polygon network using EIP-1559
     *
     * Polygon requires higher priority fees than default ethers.js estimates.
     * Uses minimum 30 gwei priority fee to ensure transactions don't get stuck.
     */
    private getGasOptions;
    /**
     * Calculate gas cost from gas units
     */
    private calculateGasCost;
}
/**
 * Calculate condition ID from oracle, question ID, and outcome count
 * This is rarely needed as Polymarket provides conditionId directly
 */
export declare function calculateConditionId(oracle: string, questionId: string, outcomeSlotCount?: number): string;
/**
 * Parse USDC amount to BigNumber (6 decimals)
 */
export declare function parseUsdc(amount: string): BigNumber;
/**
 * Format BigNumber to USDC string (6 decimals)
 */
export declare function formatUsdc(amount: BigNumber): string;
