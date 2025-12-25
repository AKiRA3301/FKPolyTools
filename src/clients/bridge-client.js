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
// ===== Constants =====
const BRIDGE_API_BASE = 'https://bridge.polymarket.com';
// Known chain information
export const SUPPORTED_CHAINS = {
    ETHEREUM: {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: 'https://eth.llamarpc.com',
    },
    POLYGON: {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: 'https://polygon-rpc.com',
    },
};
// Known token addresses
export const BRIDGE_TOKENS = {
    // Ethereum
    ETH_USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    ETH_WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    ETH_DAI: '0x6B175474E89094C44Da98b954EeDeaC495271d0F',
    // Polygon (destination)
    POLYGON_USDC_E: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    POLYGON_NATIVE_USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
};
// ===== Bridge Client =====
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
export class BridgeClient {
    baseUrl;
    timeout;
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || BRIDGE_API_BASE;
        this.timeout = config.timeout || 30000;
    }
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
    async getSupportedAssets() {
        const response = await this.fetch('/supported-assets');
        // Normalize the API response to match our interface
        return response.supportedAssets.map((asset) => ({
            chainId: parseInt(asset.chainId, 10),
            chainName: asset.chainName,
            tokenSymbol: asset.token.symbol,
            tokenName: asset.token.name,
            tokenAddress: asset.token.address,
            decimals: asset.token.decimals,
            minDeposit: asset.minCheckoutUsd.toString(),
            minDepositUsd: asset.minCheckoutUsd,
            active: true,
        }));
    }
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
    async createDepositAddresses(walletAddress) {
        const response = await this.fetch('/deposit', {
            method: 'POST',
            body: JSON.stringify({ address: walletAddress }),
        });
        return response;
    }
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
    async getEvmDepositAddress(walletAddress) {
        const result = await this.createDepositAddresses(walletAddress);
        return result.address.evm;
    }
    /**
     * Get the Solana deposit address for a wallet
     *
     * @param walletAddress - Your Polymarket wallet address
     * @returns The Solana deposit address
     */
    async getSolanaDepositAddress(walletAddress) {
        const result = await this.createDepositAddresses(walletAddress);
        return result.address.svm;
    }
    /**
     * Get the Bitcoin deposit address for a wallet
     *
     * @param walletAddress - Your Polymarket wallet address
     * @returns The Bitcoin deposit address
     */
    async getBtcDepositAddress(walletAddress) {
        const result = await this.createDepositAddresses(walletAddress);
        return result.address.btc;
    }
    /**
     * @deprecated Use getEvmDepositAddress(), getSolanaDepositAddress(), or getBtcDepositAddress() instead.
     *
     * The Bridge API returns universal addresses by chain type (EVM/SVM/BTC),
     * not by specific chain/token combinations.
     *
     * For EVM chains (Ethereum, Polygon, Arbitrum, Base, Optimism), use getEvmDepositAddress()
     */
    async getDepositAddress(address, _chainId, _tokenSymbol) {
        // Return a compatibility shim - the EVM address works for all EVM chains
        const result = await this.createDepositAddresses(address);
        return {
            chainId: _chainId,
            chainName: 'Universal EVM',
            tokenAddress: '',
            tokenSymbol: _tokenSymbol,
            depositAddress: result.address.evm,
            minDeposit: '2', // Default minimum
        };
    }
    /**
     * Check if a chain/token combination is supported
     *
     * @param chainId - The chain ID to check
     * @param tokenSymbol - The token symbol to check
     * @returns True if supported, false otherwise
     */
    async isSupported(chainId, tokenSymbol) {
        const assets = await this.getSupportedAssets();
        return assets.some((a) => a.chainId === chainId && a.tokenSymbol.toUpperCase() === tokenSymbol.toUpperCase());
    }
    /**
     * Get minimum deposit amount for a chain/token
     *
     * @param chainId - The chain ID
     * @param tokenSymbol - The token symbol
     * @returns Minimum deposit info or null if not supported
     */
    async getMinDeposit(chainId, tokenSymbol) {
        const assets = await this.getSupportedAssets();
        const asset = assets.find((a) => a.chainId === chainId && a.tokenSymbol.toUpperCase() === tokenSymbol.toUpperCase());
        if (!asset)
            return null;
        return {
            amount: asset.minDeposit,
            usd: asset.minDepositUsd,
        };
    }
    /**
     * Format deposit instructions for a user
     *
     * @param walletAddress - The Polymarket wallet address
     * @returns Formatted instructions string
     */
    async getDepositInstructions(walletAddress) {
        const result = await this.createDepositAddresses(walletAddress);
        const assets = await this.getSupportedAssets();
        const lines = [
            '═══════════════════════════════════════════════════════════',
            '            POLYMARKET DEPOSIT INSTRUCTIONS',
            '═══════════════════════════════════════════════════════════',
            '',
            `Wallet: ${walletAddress}`,
            '',
            'Send assets to these addresses to deposit to your Polymarket account:',
            '(Assets will be automatically converted to USDC.e on Polygon)',
            '',
        ];
        // EVM Deposit Address (works for all EVM chains)
        lines.push('── EVM CHAINS ──');
        lines.push('(Ethereum, Polygon, Arbitrum, Base, Optimism)');
        lines.push('');
        lines.push(`  Universal EVM Address: ${result.address.evm}`);
        lines.push('');
        // Group assets by chain for display
        const evmChainIds = [1, 137, 42161, 8453, 10];
        const evmAssets = assets.filter((a) => evmChainIds.includes(a.chainId));
        // Group by chain
        const byChain = new Map();
        for (const asset of evmAssets) {
            const existing = byChain.get(asset.chainId) || [];
            existing.push(asset);
            byChain.set(asset.chainId, existing);
        }
        for (const [chainId, chainAssets] of byChain) {
            const chainName = chainAssets[0]?.chainName || `Chain ${chainId}`;
            lines.push(`  ${chainName} (${chainId}):`);
            for (const asset of chainAssets) {
                lines.push(`    - ${asset.tokenSymbol}: min $${asset.minDepositUsd}`);
            }
            lines.push('');
        }
        // Solana Deposit Address
        lines.push('── SOLANA ──');
        lines.push(`  Address: ${result.address.svm}`);
        const solAssets = assets.filter((a) => a.chainName?.toLowerCase().includes('solana'));
        for (const asset of solAssets) {
            lines.push(`    - ${asset.tokenSymbol}: min $${asset.minDepositUsd}`);
        }
        lines.push('');
        // Bitcoin Deposit Address
        lines.push('── BITCOIN ──');
        lines.push(`  Address: ${result.address.btc}`);
        const btcAssets = assets.filter((a) => a.chainName?.toLowerCase().includes('bitcoin'));
        for (const asset of btcAssets) {
            lines.push(`    - ${asset.tokenSymbol}: min $${asset.minDepositUsd}`);
        }
        lines.push('');
        lines.push('═══════════════════════════════════════════════════════════');
        lines.push('');
        lines.push('IMPORTANT:');
        lines.push('  - Always send more than the minimum amount');
        lines.push('  - Deposits may take 1-30 minutes to process');
        lines.push('  - Check Polymarket balance after deposit completes');
        lines.push('  - Bridge fee is approximately 0.16%');
        lines.push('');
        return lines.join('\n');
    }
    // ===== Private Methods =====
    async fetch(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                signal: controller.signal,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Bridge API error (${response.status}): ${errorText}`);
            }
            return await response.json();
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
// ===== Deposit Execution =====
import { ethers } from 'ethers';
// ERC20 ABI for deposits
const ERC20_DEPOSIT_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
];
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
export async function depositUsdc(signer, amount, options = {}) {
    const { token = 'NATIVE_USDC', gasPriceMultiplier = 1.2 } = options;
    // Validate minimum deposit
    if (amount < 2) {
        return {
            success: false,
            amount: amount.toString(),
            depositAddress: '',
            error: 'Minimum deposit is $2',
        };
    }
    // Get token address
    const tokenAddress = token === 'NATIVE_USDC' ? BRIDGE_TOKENS.POLYGON_NATIVE_USDC : BRIDGE_TOKENS.POLYGON_USDC_E;
    try {
        // Get deposit address
        const bridge = new BridgeClient();
        const depositAddr = await bridge.getEvmDepositAddress(signer.address);
        // Create token contract
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_DEPOSIT_ABI, signer);
        // Check balance
        const balance = await tokenContract.balanceOf(signer.address);
        const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
        if (balance.lt(amountWei)) {
            const balanceFormatted = ethers.utils.formatUnits(balance, 6);
            return {
                success: false,
                amount: amount.toString(),
                depositAddress: depositAddr,
                error: `Insufficient balance. Have: ${balanceFormatted}, Need: ${amount}`,
            };
        }
        // Get gas price with buffer
        const feeData = await signer.provider.getFeeData();
        const gasPrice = feeData.gasPrice
            ? feeData.gasPrice.mul(Math.floor(gasPriceMultiplier * 100)).div(100)
            : undefined;
        // Execute transfer
        const tx = await tokenContract.transfer(depositAddr, amountWei, {
            gasPrice,
        });
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            return {
                success: false,
                txHash: tx.hash,
                amount: amount.toString(),
                depositAddress: depositAddr,
                error: 'Transaction failed',
            };
        }
        return {
            success: true,
            txHash: tx.hash,
            amount: amount.toString(),
            depositAddress: depositAddr,
        };
    }
    catch (err) {
        return {
            success: false,
            amount: amount.toString(),
            depositAddress: '',
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}
// ===== Swap and Deposit =====
import { SwapService, POLYGON_TOKENS } from '../services/swap-service.js';
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
export async function swapAndDeposit(signer, token, amount, options = {}) {
    const { slippage = 0.5, gasPriceMultiplier = 1.2 } = options;
    const upperToken = token.toUpperCase();
    try {
        const swapService = new SwapService(signer);
        const bridge = new BridgeClient();
        // Get deposit address
        const depositAddr = await bridge.getEvmDepositAddress(signer.address);
        // If already USDC, skip swap
        if (upperToken === 'USDC' || upperToken === 'NATIVE_USDC') {
            const result = await depositUsdc(signer, parseFloat(amount), {
                token: 'NATIVE_USDC',
                gasPriceMultiplier,
            });
            return {
                success: result.success,
                depositTxHash: result.txHash,
                tokenIn: upperToken,
                amountIn: amount,
                usdcAmount: amount,
                depositAddress: depositAddr,
                error: result.error,
            };
        }
        if (upperToken === 'USDC_E') {
            const result = await depositUsdc(signer, parseFloat(amount), {
                token: 'USDC_E',
                gasPriceMultiplier,
            });
            return {
                success: result.success,
                depositTxHash: result.txHash,
                tokenIn: upperToken,
                amountIn: amount,
                usdcAmount: amount,
                depositAddress: depositAddr,
                error: result.error,
            };
        }
        // Check balance
        const balance = await swapService.getBalance(token);
        if (parseFloat(balance) < parseFloat(amount)) {
            return {
                success: false,
                tokenIn: upperToken,
                amountIn: amount,
                usdcAmount: '0',
                depositAddress: depositAddr,
                error: `Insufficient ${upperToken} balance. Have: ${balance}, Need: ${amount}`,
            };
        }
        // Swap to USDC
        const swapResult = await swapService.swapToUsdc(token, amount, {
            usdcType: 'NATIVE_USDC',
            slippage,
        });
        if (!swapResult.success) {
            return {
                success: false,
                tokenIn: upperToken,
                amountIn: amount,
                usdcAmount: '0',
                depositAddress: depositAddr,
                error: `Swap failed: ${swapResult.transactionHash}`,
            };
        }
        // Get USDC balance after swap
        const usdcBalance = await swapService.getBalance('USDC');
        // Deposit USDC
        const depositResult = await depositUsdc(signer, parseFloat(usdcBalance), {
            token: 'NATIVE_USDC',
            gasPriceMultiplier,
        });
        return {
            success: depositResult.success,
            swapTxHash: swapResult.transactionHash,
            depositTxHash: depositResult.txHash,
            tokenIn: upperToken,
            amountIn: amount,
            usdcAmount: usdcBalance,
            depositAddress: depositAddr,
            error: depositResult.error,
        };
    }
    catch (err) {
        return {
            success: false,
            tokenIn: upperToken,
            amountIn: amount,
            usdcAmount: '0',
            depositAddress: '',
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}
/**
 * Get list of supported tokens for swap and deposit
 */
export function getSupportedDepositTokens() {
    return Object.keys(POLYGON_TOKENS);
}
// ===== Utility Functions =====
/**
 * Calculate the expected USDC.e output after bridge fees
 *
 * Note: This is an estimate. Actual output depends on bridge/swap fees.
 *
 * @param amount - Input amount in source token
 * @param tokenSymbol - Source token symbol
 * @returns Estimated USDC.e output
 */
export function estimateBridgeOutput(amount, tokenSymbol) {
    // Typical bridge fees: ~0.5-1%
    // Swap fees: ~0.3%
    const totalFeePercent = 0.01; // 1% estimate
    // For stablecoins, 1:1 minus fees
    if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(tokenSymbol.toUpperCase())) {
        return amount * (1 - totalFeePercent);
    }
    // For ETH and other tokens, would need price oracle
    // This is just a placeholder
    return amount * (1 - totalFeePercent);
}
/**
 * Get explorer URL for a deposit transaction
 *
 * @param chainId - The chain ID
 * @param txHash - The transaction hash
 * @returns Block explorer URL
 */
export function getExplorerUrl(chainId, txHash) {
    switch (chainId) {
        case 1:
            return `https://etherscan.io/tx/${txHash}`;
        case 137:
            return `https://polygonscan.com/tx/${txHash}`;
        case 10:
            return `https://optimistic.etherscan.io/tx/${txHash}`;
        case 42161:
            return `https://arbiscan.io/tx/${txHash}`;
        case 8453:
            return `https://basescan.org/tx/${txHash}`;
        default:
            return `https://blockscan.com/tx/${txHash}`;
    }
}
