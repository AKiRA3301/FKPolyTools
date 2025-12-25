/**
 * Bridge Client for Polymarket Cross-Chain Deposits
 *
 * Enables depositing assets from multiple chains (Ethereum, etc.)
 * and having them automatically converted to USDC.e on Polygon for trading.
 *
 * Flow:
 * 1. Request deposit addresses for your Polymarket wallet
 * 2. Send assets to the unique deposit address for each chain/token
 * 3. Assets are automatically bridged and swapped to USDC.e on Polygon
 * 4. USDC.e is credited to your Polymarket account
 *
 * @see https://docs.polymarket.com/developers/misc-endpoints/bridge-deposit
 * @see https://docs.polymarket.com/developers/misc-endpoints/bridge-supported-assets
 */
/**
 * Supported asset information from the bridge
 */
export interface BridgeSupportedAsset {
    /** Blockchain chain ID (e.g., 1 for Ethereum) */
    chainId: number;
    /** Human-readable chain name (e.g., "Ethereum") */
    chainName: string;
    /** Token contract address on the source chain */
    tokenAddress: string;
    /** Token symbol (e.g., "USDC", "ETH") */
    tokenSymbol: string;
    /** Token name (e.g., "USD Coin") */
    tokenName: string;
    /** Token decimals (e.g., 6 for USDC) */
    decimals: number;
    /** Minimum deposit amount in token units */
    minDeposit: string;
    /** Minimum deposit amount in USD */
    minDepositUsd: number;
    /** Whether this asset is currently active */
    active: boolean;
}
/**
 * Deposit address for a specific chain/token combination
 */
export interface DepositAddress {
    /** Blockchain chain ID */
    chainId: number;
    /** Human-readable chain name */
    chainName: string;
    /** Token contract address on source chain */
    tokenAddress: string;
    /** Token symbol */
    tokenSymbol: string;
    /** Unique deposit address to send funds to */
    depositAddress: string;
    /** Minimum deposit amount */
    minDeposit: string;
}
/**
 * Response from creating deposit addresses
 *
 * The Bridge API returns a single universal deposit address structure.
 * - EVM address: Used for all EVM chains (Ethereum, Polygon, Arbitrum, Base, Optimism)
 * - SVM address: Used for Solana
 * - BTC address: Used for Bitcoin
 *
 * @example Response from API:
 * ```json
 * {
 *   "address": {
 *     "evm": "0x1234...",
 *     "svm": "ABC123...",
 *     "btc": "bc1q..."
 *   }
 * }
 * ```
 */
export interface CreateDepositResponse {
    /** Universal deposit addresses for different chain types */
    address: {
        /** EVM deposit address (Ethereum, Polygon, Arbitrum, Base, Optimism) */
        evm: string;
        /** Solana deposit address */
        svm: string;
        /** Bitcoin deposit address */
        btc: string;
    };
}
/**
 * Deposit status tracking
 */
export interface DepositStatus {
    /** Unique deposit ID */
    depositId: string;
    /** Source chain ID */
    sourceChainId: number;
    /** Source transaction hash */
    sourceTxHash: string;
    /** Amount deposited */
    amount: string;
    /** Token symbol */
    tokenSymbol: string;
    /** Status of the deposit */
    status: 'pending' | 'bridging' | 'swapping' | 'completed' | 'failed';
    /** Destination transaction hash (when completed) */
    destinationTxHash?: string;
    /** USDC.e amount received (when completed) */
    usdceReceived?: string;
    /** Error message (if failed) */
    errorMessage?: string;
    /** Timestamp of last update */
    updatedAt: string;
}
/**
 * Bridge configuration
 */
export interface BridgeConfig {
    /** Base URL for the bridge API (default: https://bridge.polymarket.com) */
    baseUrl?: string;
    /** Request timeout in ms (default: 30000) */
    timeout?: number;
}
export declare const SUPPORTED_CHAINS: {
    readonly ETHEREUM: {
        readonly chainId: 1;
        readonly name: "Ethereum";
        readonly rpcUrl: "https://eth.llamarpc.com";
    };
    readonly POLYGON: {
        readonly chainId: 137;
        readonly name: "Polygon";
        readonly rpcUrl: "https://polygon-rpc.com";
    };
};
export declare const BRIDGE_TOKENS: {
    readonly ETH_USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    readonly ETH_WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    readonly ETH_DAI: "0x6B175474E89094C44Da98b954EeDeaC495271d0F";
    readonly POLYGON_USDC_E: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    readonly POLYGON_NATIVE_USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
};
/**
 * Client for interacting with Polymarket's cross-chain bridge
 *
 * @example
 * ```typescript
 * const bridge = new BridgeClient();
 *
 * // Get supported assets
 * const assets = await bridge.getSupportedAssets();
 * console.log(`Supported: ${assets.map(a => a.tokenSymbol).join(', ')}`);
 *
 * // Create deposit addresses for your wallet
 * const deposit = await bridge.createDepositAddresses('0xYourAddress');
 * const ethUsdc = deposit.depositAddresses.find(
 *   d => d.chainName === 'Ethereum' && d.tokenSymbol === 'USDC'
 * );
 * console.log(`Send USDC on Ethereum to: ${ethUsdc.depositAddress}`);
 * ```
 */
export declare class BridgeClient {
    private baseUrl;
    private timeout;
    constructor(config?: BridgeConfig);
    /**
     * Get all supported assets for bridge deposits
     *
     * @returns Array of supported assets with their chain/token details
     *
     * @example
     * ```typescript
     * const assets = await bridge.getSupportedAssets();
     * for (const asset of assets) {
     *   console.log(`${asset.chainName} ${asset.tokenSymbol}: min $${asset.minDepositUsd}`);
     * }
     * ```
     */
    getSupportedAssets(): Promise<BridgeSupportedAsset[]>;
    /**
     * Get unique deposit addresses for a Polymarket wallet
     *
     * The Bridge API returns a universal deposit address structure:
     * - A single EVM address works for ALL EVM chains (Ethereum, Polygon, Arbitrum, Base, Optimism)
     * - A Solana address for SVM deposits
     * - A Bitcoin address for BTC deposits
     *
     * Funds sent to these addresses are automatically bridged to Polygon
     * and converted to USDC.e for your Polymarket account.
     *
     * @param walletAddress - Your Polymarket wallet address (EOA address)
     * @returns Universal deposit addresses for EVM, Solana, and Bitcoin
     *
     * @example
     * ```typescript
     * const result = await bridge.createDepositAddresses('0xYourPolymarketWallet');
     *
     * // The EVM address works for Ethereum, Polygon, Arbitrum, Base, Optimism
     * console.log(`EVM deposit address: ${result.address.evm}`);
     *
     * // For Solana deposits
     * console.log(`Solana deposit address: ${result.address.svm}`);
     *
     * // For Bitcoin deposits
     * console.log(`Bitcoin deposit address: ${result.address.btc}`);
     * ```
     */
    createDepositAddresses(walletAddress: string): Promise<CreateDepositResponse>;
    /**
     * Get the EVM deposit address for a wallet
     *
     * This address works for ALL supported EVM chains:
     * - Ethereum (chainId: 1)
     * - Polygon (chainId: 137)
     * - Arbitrum (chainId: 42161)
     * - Base (chainId: 8453)
     * - Optimism (chainId: 10)
     *
     * @param walletAddress - Your Polymarket wallet address
     * @returns The universal EVM deposit address
     *
     * @example
     * ```typescript
     * const evmAddr = await bridge.getEvmDepositAddress('0xYourWallet');
     * // Send Native USDC on Polygon to this address
     * // Or send USDC on Ethereum to this address
     * console.log(`Deposit to: ${evmAddr}`);
     * ```
     */
    getEvmDepositAddress(walletAddress: string): Promise<string>;
    /**
     * Get the Solana deposit address for a wallet
     *
     * @param walletAddress - Your Polymarket wallet address
     * @returns The Solana deposit address
     */
    getSolanaDepositAddress(walletAddress: string): Promise<string>;
    /**
     * Get the Bitcoin deposit address for a wallet
     *
     * @param walletAddress - Your Polymarket wallet address
     * @returns The Bitcoin deposit address
     */
    getBtcDepositAddress(walletAddress: string): Promise<string>;
    /**
     * @deprecated Use getEvmDepositAddress(), getSolanaDepositAddress(), or getBtcDepositAddress() instead.
     *
     * The Bridge API returns universal addresses by chain type (EVM/SVM/BTC),
     * not by specific chain/token combinations.
     *
     * For EVM chains (Ethereum, Polygon, Arbitrum, Base, Optimism), use getEvmDepositAddress()
     */
    getDepositAddress(address: string, _chainId: number, _tokenSymbol: string): Promise<DepositAddress | null>;
    /**
     * Check if a chain/token combination is supported
     *
     * @param chainId - The chain ID to check
     * @param tokenSymbol - The token symbol to check
     * @returns True if supported, false otherwise
     */
    isSupported(chainId: number, tokenSymbol: string): Promise<boolean>;
    /**
     * Get minimum deposit amount for a chain/token
     *
     * @param chainId - The chain ID
     * @param tokenSymbol - The token symbol
     * @returns Minimum deposit info or null if not supported
     */
    getMinDeposit(chainId: number, tokenSymbol: string): Promise<{
        amount: string;
        usd: number;
    } | null>;
    /**
     * Format deposit instructions for a user
     *
     * @param walletAddress - The Polymarket wallet address
     * @returns Formatted instructions string
     */
    getDepositInstructions(walletAddress: string): Promise<string>;
    private fetch;
}
import { ethers } from 'ethers';
export interface DepositResult {
    success: boolean;
    txHash?: string;
    amount: string;
    depositAddress: string;
    error?: string;
}
export interface DepositOptions {
    /** Chain ID for the deposit (default: 137 for Polygon) */
    chainId?: number;
    /** Token to deposit: 'NATIVE_USDC' or 'USDC_E' (default: 'NATIVE_USDC') */
    token?: 'NATIVE_USDC' | 'USDC_E';
    /** Gas price multiplier (default: 1.2) */
    gasPriceMultiplier?: number;
}
/**
 * Deposit USDC to Polymarket via Bridge
 *
 * This function:
 * 1. Gets the deposit address for your wallet
 * 2. Transfers USDC to that address
 * 3. The bridge automatically converts it to USDC.e for your Polymarket account
 *
 * @param signer - Ethers wallet/signer to send from
 * @param amount - Amount in USDC (e.g., 10.5 for $10.50)
 * @param options - Deposit options
 * @returns Deposit result with transaction hash
 *
 * @example
 * ```typescript
 * const bridge = new BridgeClient();
 * const result = await bridge.depositUsdc(signer, 100);
 * console.log(`Deposited $100: ${result.txHash}`);
 * ```
 */
export declare function depositUsdc(signer: ethers.Wallet, amount: number, options?: DepositOptions): Promise<DepositResult>;
export interface SwapAndDepositOptions {
    /** Slippage tolerance for swap (default: 0.5%) */
    slippage?: number;
    /** Gas price multiplier (default: 1.2) */
    gasPriceMultiplier?: number;
}
export interface SwapAndDepositResult {
    success: boolean;
    /** Swap transaction hash (if swap was needed) */
    swapTxHash?: string;
    /** Deposit transaction hash */
    depositTxHash?: string;
    /** Input token */
    tokenIn: string;
    /** Amount of input token */
    amountIn: string;
    /** Amount of USDC after swap */
    usdcAmount: string;
    /** Deposit address */
    depositAddress: string;
    /** Error message if failed */
    error?: string;
}
/**
 * Swap any supported Polygon token to USDC and deposit to Polymarket
 *
 * Supported tokens: MATIC, WMATIC, USDC, USDC_E, USDT, DAI, WETH
 *
 * Flow:
 * 1. If token is not USDC, swap to USDC using QuickSwap
 * 2. Deposit USDC to the bridge deposit address
 *
 * @param signer - Ethers wallet/signer
 * @param token - Token symbol to deposit (e.g., 'MATIC', 'WETH', 'USDT')
 * @param amount - Amount to deposit in token units
 * @param options - Swap and deposit options
 * @returns Result with transaction hashes
 *
 * @example
 * ```typescript
 * // Deposit 10 MATIC
 * const result = await swapAndDeposit(signer, 'MATIC', '10');
 *
 * // Deposit 100 USDT
 * const result = await swapAndDeposit(signer, 'USDT', '100');
 *
 * // Deposit 0.1 WETH
 * const result = await swapAndDeposit(signer, 'WETH', '0.1');
 * ```
 */
export declare function swapAndDeposit(signer: ethers.Wallet, token: string, amount: string, options?: SwapAndDepositOptions): Promise<SwapAndDepositResult>;
/**
 * Get list of supported tokens for swap and deposit
 */
export declare function getSupportedDepositTokens(): string[];
/**
 * Calculate the expected USDC.e output after bridge fees
 *
 * Note: This is an estimate. Actual output depends on bridge/swap fees.
 *
 * @param amount - Input amount in source token
 * @param tokenSymbol - Source token symbol
 * @returns Estimated USDC.e output
 */
export declare function estimateBridgeOutput(amount: number, tokenSymbol: string): number;
/**
 * Get explorer URL for a deposit transaction
 *
 * @param chainId - The chain ID
 * @param txHash - The transaction hash
 * @returns Block explorer URL
 */
export declare function getExplorerUrl(chainId: number, txHash: string): string;
