/**
 * Authorization Service
 *
 * Manages ERC20 and ERC1155 approvals required for trading on Polymarket.
 *
 * Required approvals for trading:
 * - ERC20 (USDC): Approve USDC spending for CTF Exchange, Neg Risk Exchange, etc.
 * - ERC1155 (Conditional Tokens): Approve operators for conditional token transfers
 *
 * @see https://docs.polymarket.com/
 */
import { ethers } from 'ethers';
export interface AllowanceInfo {
    contract: string;
    address: string;
    approved: boolean;
    allowance?: string;
}
export interface AllowancesResult {
    wallet: string;
    usdcBalance: string;
    erc20Allowances: AllowanceInfo[];
    erc1155Approvals: AllowanceInfo[];
    tradingReady: boolean;
    issues: string[];
}
export interface ApprovalTxResult {
    contract: string;
    txHash?: string;
    success: boolean;
    error?: string;
}
export interface ApprovalsResult {
    wallet: string;
    erc20Approvals: ApprovalTxResult[];
    erc1155Approvals: ApprovalTxResult[];
    allApproved: boolean;
    summary: string;
}
export interface AuthorizationServiceConfig {
    provider?: ethers.providers.Provider;
}
/**
 * Service for managing trading authorizations on Polymarket
 *
 * @example
 * ```typescript
 * const authService = new AuthorizationService(signer);
 *
 * // Check all allowances
 * const status = await authService.checkAllowances();
 * console.log(`Trading ready: ${status.tradingReady}`);
 * if (!status.tradingReady) {
 *   console.log('Issues:', status.issues);
 * }
 *
 * // Set up all approvals
 * const result = await authService.approveAll();
 * console.log(result.summary);
 * ```
 */
export declare class AuthorizationService {
    private signer;
    private provider;
    constructor(signer: ethers.Wallet, config?: AuthorizationServiceConfig);
    /**
     * Get the wallet address
     */
    get walletAddress(): string;
    /**
     * Check all ERC20 and ERC1155 allowances required for trading
     *
     * @returns Status of all allowances and whether trading is ready
     */
    checkAllowances(): Promise<AllowancesResult>;
    /**
     * Set up all required approvals for trading
     *
     * @returns Results of all approval transactions
     */
    approveAll(): Promise<ApprovalsResult>;
    /**
     * Approve USDC spending for a specific contract
     *
     * @param spenderAddress - The contract address to approve
     * @param amount - The amount to approve (default: unlimited)
     */
    approveUsdc(spenderAddress: string, amount?: ethers.BigNumber): Promise<ApprovalTxResult>;
    /**
     * Set approval for an ERC1155 operator
     *
     * @param operatorAddress - The operator address to approve
     * @param approved - Whether to approve or revoke
     */
    setErc1155Approval(operatorAddress: string, approved?: boolean): Promise<ApprovalTxResult>;
}
