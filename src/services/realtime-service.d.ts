/**
 * Realtime Service
 *
 * High-level wrapper for WebSocket subscriptions:
 * - Market subscription management
 * - Price caching and access
 * - Event handler registration
 */
import { WebSocketManager } from '../clients/websocket-manager.js';
import type { PriceUpdate, BookUpdate } from '../core/types.js';
export interface Subscription {
    id: string;
    assetIds: string[];
    unsubscribe: () => Promise<void>;
}
export interface MarketSubscriptionHandlers {
    onPriceUpdate?: (update: PriceUpdate) => void;
    onBookUpdate?: (update: BookUpdate) => void;
    onLastTrade?: (trade: {
        assetId: string;
        price: number;
        side: 'BUY' | 'SELL';
        size: number;
        timestamp: number;
    }) => void;
    onError?: (error: Error) => void;
}
export declare class RealtimeService {
    private wsManager;
    private subscriptions;
    private subscriptionIdCounter;
    constructor(wsManager?: WebSocketManager);
    /**
     * Subscribe to market price updates
     * @param assetIds - Token IDs to subscribe to
     * @param handlers - Event handlers
     * @returns Subscription object with unsubscribe method
     */
    subscribeMarkets(assetIds: string[], handlers: MarketSubscriptionHandlers): Promise<Subscription>;
    /**
     * Subscribe to a single market (both YES and NO tokens)
     * @param yesTokenId - YES token ID
     * @param noTokenId - NO token ID
     * @param handlers - Event handlers
     */
    subscribeMarket(yesTokenId: string, noTokenId: string, handlers: MarketSubscriptionHandlers & {
        onPairUpdate?: (update: {
            yes: PriceUpdate;
            no: PriceUpdate;
            spread: number;
        }) => void;
    }): Promise<Subscription>;
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
     * Get all active subscriptions
     */
    getActiveSubscriptions(): Subscription[];
    /**
     * Get subscription by ID
     */
    getSubscription(id: string): Subscription | undefined;
    /**
     * Unsubscribe from all markets
     */
    unsubscribeAll(): Promise<void>;
    /**
     * Get WebSocket manager for advanced usage
     */
    getWebSocketManager(): WebSocketManager;
}
