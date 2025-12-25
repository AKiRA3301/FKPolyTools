/**
 * WebSocket Manager
 *
 * Wraps @nevuamarkets/poly-websockets for real-time market data:
 * - Price updates (derived from order book and trades)
 * - Order book snapshots
 * - Last trade price events
 *
 * Features:
 * - Automatic connection management
 * - Rate limiting built-in
 * - Price caching for quick access
 * - EventEmitter-based event distribution
 */
import { EventEmitter } from 'events';
import type { PriceUpdate, BookUpdate } from '../core/types.js';
export interface WebSocketManagerConfig {
    maxMarketsPerWS?: number;
    enableLogging?: boolean;
}
export interface WebSocketManagerEvents {
    priceUpdate: (update: PriceUpdate) => void;
    bookUpdate: (update: BookUpdate) => void;
    lastTrade: (trade: {
        assetId: string;
        price: number;
        side: 'BUY' | 'SELL';
        size: number;
        timestamp: number;
    }) => void;
    connected: (info: {
        groupId: string;
        assetIds: string[];
    }) => void;
    disconnected: (info: {
        groupId: string;
        code: number;
        reason: string;
    }) => void;
    error: (error: Error) => void;
}
export declare class WebSocketManager extends EventEmitter {
    private wsManager;
    private subscriptions;
    private priceCache;
    private bookCache;
    private initialized;
    private config;
    constructor(config?: WebSocketManagerConfig);
    /**
     * Initialize the WebSocket manager (lazy initialization)
     */
    private ensureInitialized;
    /**
     * Subscribe to asset price updates
     */
    subscribe(assetIds: string[]): Promise<void>;
    /**
     * Unsubscribe from asset price updates
     */
    unsubscribe(assetIds: string[]): Promise<void>;
    /**
     * Unsubscribe from all assets and cleanup
     */
    unsubscribeAll(): Promise<void>;
    /**
     * Get cached price for an asset
     */
    getPrice(assetId: string): PriceUpdate | undefined;
    /**
     * Get all cached prices
     */
    getAllPrices(): Map<string, PriceUpdate>;
    /**
     * Get cached order book for an asset
     */
    getBook(assetId: string): BookUpdate | undefined;
    /**
     * Get subscribed asset IDs
     */
    getSubscribedAssets(): string[];
    /**
     * Get connection statistics
     */
    getStatistics(): {
        groups: number;
        subscriptions: number;
    } | null;
    /**
     * Check if initialized
     */
    isInitialized(): boolean;
    private handlePriceUpdate;
    private handleBookUpdate;
    private handleLastTradePrice;
    private handleOpen;
    private handleClose;
    private handleError;
}
