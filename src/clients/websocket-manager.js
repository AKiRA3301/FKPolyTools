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
export class WebSocketManager extends EventEmitter {
    wsManager; // WSSubscriptionManager instance
    subscriptions = new Set();
    priceCache = new Map();
    bookCache = new Map();
    initialized = false;
    config;
    constructor(config = {}) {
        super();
        this.config = {
            maxMarketsPerWS: config.maxMarketsPerWS || 100,
            enableLogging: config.enableLogging ?? false,
        };
    }
    /**
     * Initialize the WebSocket manager (lazy initialization)
     */
    async ensureInitialized() {
        if (this.initialized)
            return;
        try {
            // Dynamic import to handle the package not being installed
            const { WSSubscriptionManager } = await import('@nevuamarkets/poly-websockets');
            this.wsManager = new WSSubscriptionManager({
                onPolymarketPriceUpdate: this.handlePriceUpdate.bind(this),
                onBook: this.handleBookUpdate.bind(this),
                onLastTradePrice: this.handleLastTradePrice.bind(this),
                onWSOpen: this.handleOpen.bind(this),
                onWSClose: this.handleClose.bind(this),
                onError: this.handleError.bind(this),
            }, {
                maxMarketsPerWS: this.config.maxMarketsPerWS,
            });
            this.initialized = true;
        }
        catch (error) {
            throw new Error('Failed to initialize WebSocket manager. Make sure @nevuamarkets/poly-websockets is installed.');
        }
    }
    // ===== Subscription Management =====
    /**
     * Subscribe to asset price updates
     */
    async subscribe(assetIds) {
        await this.ensureInitialized();
        const newIds = assetIds.filter((id) => !this.subscriptions.has(id));
        if (newIds.length === 0)
            return;
        const manager = this.wsManager;
        await manager.addSubscriptions(newIds);
        newIds.forEach((id) => this.subscriptions.add(id));
    }
    /**
     * Unsubscribe from asset price updates
     */
    async unsubscribe(assetIds) {
        if (!this.initialized)
            return;
        const existingIds = assetIds.filter((id) => this.subscriptions.has(id));
        if (existingIds.length === 0)
            return;
        const manager = this.wsManager;
        await manager.removeSubscriptions(existingIds);
        existingIds.forEach((id) => {
            this.subscriptions.delete(id);
            this.priceCache.delete(id);
            this.bookCache.delete(id);
        });
    }
    /**
     * Unsubscribe from all assets and cleanup
     */
    async unsubscribeAll() {
        if (!this.initialized)
            return;
        const manager = this.wsManager;
        await manager.clearState();
        this.subscriptions.clear();
        this.priceCache.clear();
        this.bookCache.clear();
    }
    // ===== Price Cache Access =====
    /**
     * Get cached price for an asset
     */
    getPrice(assetId) {
        return this.priceCache.get(assetId);
    }
    /**
     * Get all cached prices
     */
    getAllPrices() {
        return new Map(this.priceCache);
    }
    /**
     * Get cached order book for an asset
     */
    getBook(assetId) {
        return this.bookCache.get(assetId);
    }
    // ===== State Query =====
    /**
     * Get subscribed asset IDs
     */
    getSubscribedAssets() {
        return Array.from(this.subscriptions);
    }
    /**
     * Get connection statistics
     */
    getStatistics() {
        if (!this.initialized)
            return null;
        const manager = this.wsManager;
        return manager.getStatistics();
    }
    /**
     * Check if initialized
     */
    isInitialized() {
        return this.initialized;
    }
    // ===== Event Handlers =====
    async handlePriceUpdate(events) {
        for (const event of events) {
            const update = {
                assetId: event.asset_id,
                price: parseFloat(event.price),
                midpoint: parseFloat(event.midpoint),
                spread: parseFloat(event.spread),
                timestamp: parseInt(event.timestamp, 10),
            };
            this.priceCache.set(event.asset_id, update);
            this.emit('priceUpdate', update);
        }
    }
    async handleBookUpdate(events) {
        for (const event of events) {
            // Parse and sort bids descending (highest price = best bid first)
            const bids = event.bids
                .map((l) => ({ price: parseFloat(l.price), size: parseFloat(l.size) }))
                .sort((a, b) => b.price - a.price);
            // Parse and sort asks ascending (lowest price = best ask first)
            const asks = event.asks
                .map((l) => ({ price: parseFloat(l.price), size: parseFloat(l.size) }))
                .sort((a, b) => a.price - b.price);
            const update = {
                assetId: event.asset_id,
                bids,
                asks,
                timestamp: parseInt(event.timestamp, 10),
            };
            this.bookCache.set(event.asset_id, update);
            this.emit('bookUpdate', update);
        }
    }
    async handleLastTradePrice(events) {
        for (const event of events) {
            this.emit('lastTrade', {
                assetId: event.asset_id,
                price: parseFloat(event.price),
                side: event.side,
                size: parseFloat(event.size),
                timestamp: parseInt(event.timestamp, 10),
            });
        }
    }
    async handleOpen(groupId, assetIds) {
        this.emit('connected', { groupId, assetIds });
    }
    async handleClose(groupId, code, reason) {
        this.emit('disconnected', { groupId, code, reason });
    }
    async handleError(error) {
        this.emit('error', error);
    }
}
