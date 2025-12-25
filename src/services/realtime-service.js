/**
 * Realtime Service
 *
 * High-level wrapper for WebSocket subscriptions:
 * - Market subscription management
 * - Price caching and access
 * - Event handler registration
 */
import { WebSocketManager } from '../clients/websocket-manager.js';
export class RealtimeService {
    wsManager;
    subscriptions = new Map();
    subscriptionIdCounter = 0;
    constructor(wsManager) {
        this.wsManager = wsManager || new WebSocketManager();
    }
    // ===== Market Subscriptions =====
    /**
     * Subscribe to market price updates
     * @param assetIds - Token IDs to subscribe to
     * @param handlers - Event handlers
     * @returns Subscription object with unsubscribe method
     */
    async subscribeMarkets(assetIds, handlers) {
        const subscriptionId = `sub_${++this.subscriptionIdCounter}`;
        // Register event handlers (filtered by assetIds)
        const priceHandler = (update) => {
            if (assetIds.includes(update.assetId)) {
                handlers.onPriceUpdate?.(update);
            }
        };
        const bookHandler = (update) => {
            if (assetIds.includes(update.assetId)) {
                handlers.onBookUpdate?.(update);
            }
        };
        const tradeHandler = (trade) => {
            if (assetIds.includes(trade.assetId)) {
                handlers.onLastTrade?.(trade);
            }
        };
        const errorHandler = (error) => {
            handlers.onError?.(error);
        };
        // Attach listeners
        this.wsManager.on('priceUpdate', priceHandler);
        this.wsManager.on('bookUpdate', bookHandler);
        this.wsManager.on('lastTrade', tradeHandler);
        this.wsManager.on('error', errorHandler);
        // Subscribe to WebSocket
        await this.wsManager.subscribe(assetIds);
        // Create subscription object
        const subscription = {
            id: subscriptionId,
            assetIds,
            unsubscribe: async () => {
                this.wsManager.off('priceUpdate', priceHandler);
                this.wsManager.off('bookUpdate', bookHandler);
                this.wsManager.off('lastTrade', tradeHandler);
                this.wsManager.off('error', errorHandler);
                await this.wsManager.unsubscribe(assetIds);
                this.subscriptions.delete(subscriptionId);
            },
        };
        this.subscriptions.set(subscriptionId, subscription);
        return subscription;
    }
    /**
     * Subscribe to a single market (both YES and NO tokens)
     * @param yesTokenId - YES token ID
     * @param noTokenId - NO token ID
     * @param handlers - Event handlers
     */
    async subscribeMarket(yesTokenId, noTokenId, handlers) {
        let lastYesUpdate;
        let lastNoUpdate;
        const checkPairUpdate = () => {
            if (lastYesUpdate && lastNoUpdate && handlers.onPairUpdate) {
                handlers.onPairUpdate({
                    yes: lastYesUpdate,
                    no: lastNoUpdate,
                    spread: lastYesUpdate.price + lastNoUpdate.price,
                });
            }
        };
        return this.subscribeMarkets([yesTokenId, noTokenId], {
            onPriceUpdate: (update) => {
                if (update.assetId === yesTokenId) {
                    lastYesUpdate = update;
                }
                else if (update.assetId === noTokenId) {
                    lastNoUpdate = update;
                }
                handlers.onPriceUpdate?.(update);
                checkPairUpdate();
            },
            onBookUpdate: handlers.onBookUpdate,
            onLastTrade: handlers.onLastTrade,
            onError: handlers.onError,
        });
    }
    // ===== Price Access =====
    /**
     * Get cached price for an asset
     */
    getPrice(assetId) {
        return this.wsManager.getPrice(assetId);
    }
    /**
     * Get all cached prices
     */
    getAllPrices() {
        return this.wsManager.getAllPrices();
    }
    /**
     * Get cached order book for an asset
     */
    getBook(assetId) {
        return this.wsManager.getBook(assetId);
    }
    // ===== State Management =====
    /**
     * Get all active subscriptions
     */
    getActiveSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    /**
     * Get subscription by ID
     */
    getSubscription(id) {
        return this.subscriptions.get(id);
    }
    /**
     * Unsubscribe from all markets
     */
    async unsubscribeAll() {
        for (const sub of this.subscriptions.values()) {
            await sub.unsubscribe();
        }
        this.subscriptions.clear();
    }
    /**
     * Get WebSocket manager for advanced usage
     */
    getWebSocketManager() {
        return this.wsManager;
    }
}
