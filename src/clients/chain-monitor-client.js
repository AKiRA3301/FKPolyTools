/**
 * Chain Monitor Client
 *
 * 监控 Polygon 链上的 CTF (Conditional Token Framework) 交易事件。
 * 支持 WebSocket 实时订阅（主模式）和 HTTP 轮询（备用模式）。
 *
 * 用途：
 * - 监控所有 CTF 代币转移事件
 * - 发现活跃交易者（用于鲸鱼发现）
 * - 跟踪特定钱包的交易活动
 *
 * @example
 * ```typescript
 * const monitor = new ChainMonitorClient({
 *   infuraApiKey: 'your-key',
 *   wsEnabled: true,
 * });
 *
 * await monitor.connect();
 *
 * for await (const event of monitor.subscribeAllTransfers()) {
 *   console.log(`${event.from} → ${event.to}: ${event.amount} tokens`);
 * }
 * ```
 */
import { ethers, Contract } from 'ethers';
import { EventEmitter } from 'events';
// ===== Contract Addresses =====
/** Polymarket CTF Exchange (ERC1155) */
export const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
/** NegRisk CTF Exchange */
export const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
/** 实际的 CTF 条件代币合约 - ERC1155 代币转移发生在这里 */
export const CTF_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
/** NegRisk 适配器 */
export const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';
/** Polymarket 官方地址（用于过滤） */
export const OFFICIAL_ADDRESSES = [
    '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E'.toLowerCase(), // CTF Exchange
    '0xC5d563A36AE78145C45a50134d48A1215220f80a'.toLowerCase(), // NegRisk Exchange
    '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045'.toLowerCase(), // CTF Contract
    '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296'.toLowerCase(), // NegRisk Adapter
    '0x0000000000000000000000000000000000000000'.toLowerCase(), // Zero address
];
// ===== ABIs =====
const ERC1155_ABI = [
    // TransferSingle(operator, from, to, id, value)
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
    // TransferBatch(operator, from, to, ids, values)  
    'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
];
// ===== Chain Monitor Client =====
export class ChainMonitorClient extends EventEmitter {
    config;
    httpProvider = null;
    wsProvider = null;
    ctfContract = null;
    negRiskContract = null;
    isRunning = false;
    currentMode = 'disconnected';
    pollingTimer = null;
    lastScannedBlock = 0;
    reconnectAttempts = 0;
    stats = {
        mode: 'disconnected',
        connected: false,
        eventsObserved: 0,
        reconnectCount: 0,
    };
    constructor(config) {
        super();
        this.config = {
            infuraApiKey: config.infuraApiKey,
            infuraNetwork: config.infuraNetwork || 'polygon-mainnet',
            wsEnabled: config.wsEnabled ?? true,
            pollingIntervalMs: config.pollingIntervalMs || 3000,
            minTransferValue: config.minTransferValue || '0',
            autoReconnect: config.autoReconnect ?? true,
            reconnectDelayMs: config.reconnectDelayMs || 5000,
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
        };
    }
    // ===== Public API =====
    /**
     * 连接到 Polygon 链
     */
    async connect() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.stats.startedAt = new Date();
        // 初始化 HTTP Provider（始终需要）
        const httpUrl = `https://${this.config.infuraNetwork}.infura.io/v3/${this.config.infuraApiKey}`;
        this.httpProvider = new ethers.providers.JsonRpcProvider(httpUrl);
        // 获取当前区块
        this.lastScannedBlock = await this.httpProvider.getBlockNumber();
        this.stats.currentBlock = this.lastScannedBlock;
        // 尝试 WebSocket 连接
        if (this.config.wsEnabled) {
            try {
                await this.connectWebSocket();
            }
            catch (error) {
                // eslint-disable-next-line no-console
                console.warn('[ChainMonitor] WebSocket connection failed, falling back to polling:', error);
                this.startPolling();
            }
        }
        else {
            this.startPolling();
        }
    }
    /**
     * 断开连接
     */
    disconnect() {
        this.isRunning = false;
        // 停止轮询
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        // 关闭 WebSocket
        if (this.wsProvider) {
            this.wsProvider.destroy();
            this.wsProvider = null;
        }
        // 清理合约
        this.ctfContract = null;
        this.negRiskContract = null;
        this.currentMode = 'disconnected';
        this.stats.mode = 'disconnected';
        this.stats.connected = false;
        this.emit('disconnected');
    }
    /**
     * 获取服务状态
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * 是否已连接
     */
    isConnected() {
        return this.stats.connected;
    }
    /**
     * 获取当前模式
     */
    getMode() {
        return this.currentMode;
    }
    /**
     * 订阅所有 CTF 转移事件（AsyncIterable）
     */
    async *subscribeAllTransfers() {
        const eventQueue = [];
        let resolveNext = null;
        const handler = (event) => {
            if (resolveNext) {
                resolveNext(event);
                resolveNext = null;
            }
            else {
                eventQueue.push(event);
            }
        };
        this.on('transfer', handler);
        try {
            while (this.isRunning) {
                if (eventQueue.length > 0) {
                    yield eventQueue.shift();
                }
                else {
                    yield await new Promise((resolve) => {
                        resolveNext = resolve;
                    });
                }
            }
        }
        finally {
            this.off('transfer', handler);
        }
    }
    /**
     * 获取指定区块范围的历史事件
     */
    async getHistoricalTransfers(fromBlock, toBlock) {
        if (!this.httpProvider) {
            throw new Error('Not connected');
        }
        const events = [];
        // CTF Exchange
        const ctfContract = new Contract(CTF_EXCHANGE, ERC1155_ABI, this.httpProvider);
        const ctfFilter = ctfContract.filters.TransferSingle();
        const ctfLogs = await ctfContract.queryFilter(ctfFilter, fromBlock, toBlock);
        for (const log of ctfLogs) {
            const event = this.parseTransferLog(log, false);
            if (event)
                events.push(event);
        }
        // NegRisk Exchange
        const negRiskContract = new Contract(NEG_RISK_CTF_EXCHANGE, ERC1155_ABI, this.httpProvider);
        const negRiskFilter = negRiskContract.filters.TransferSingle();
        const negRiskLogs = await negRiskContract.queryFilter(negRiskFilter, fromBlock, toBlock);
        for (const log of negRiskLogs) {
            const event = this.parseTransferLog(log, false);
            if (event)
                events.push(event);
        }
        return events.sort((a, b) => a.blockNumber - b.blockNumber);
    }
    // ===== Private Methods =====
    async connectWebSocket() {
        const wsUrl = `wss://${this.config.infuraNetwork}.infura.io/ws/v3/${this.config.infuraApiKey}`;
        try {
            this.wsProvider = new ethers.providers.WebSocketProvider(wsUrl);
            // 添加全局错误处理防止 429 等错误导致崩溃
            this.wsProvider._websocket.on('error', (error) => {
                // eslint-disable-next-line no-console
                console.error('[ChainMonitor] WebSocket error:', error.message);
                // 不立即处理，让 close 事件处理断开连接
            });
            // 等待连接
            await this.wsProvider.ready;
        }
        catch (error) {
            // 处理 429 或其他连接错误
            // eslint-disable-next-line no-console
            console.error(`[ChainMonitor] WebSocket connection failed: ${error.message}`);
            if (error.message?.includes('429')) {
                // eslint-disable-next-line no-console
                console.warn('[ChainMonitor] Rate limited (429), waiting 30s before retry...');
                await new Promise(r => setTimeout(r, 30000));
            }
            throw error; // 让上层处理降级到轮询
        }
        // 设置合约 - 监听实际的 CTF 合约而非交易所合约
        // CTF 代币转移发生在 CTF_CONTRACT 上
        this.ctfContract = new Contract(CTF_CONTRACT, ERC1155_ABI, this.wsProvider);
        this.negRiskContract = new Contract(NEG_RISK_ADAPTER, ERC1155_ABI, this.wsProvider);
        // eslint-disable-next-line no-console
        console.log(`[ChainMonitor] 订阅合约: ${CTF_CONTRACT.slice(0, 10)}..., ${NEG_RISK_ADAPTER.slice(0, 10)}...`);
        // 订阅 TransferSingle 事件
        this.ctfContract.on('TransferSingle', this.handleTransferSingle.bind(this));
        this.negRiskContract.on('TransferSingle', this.handleTransferSingle.bind(this));
        // 订阅 TransferBatch 事件
        this.ctfContract.on('TransferBatch', this.handleTransferBatch.bind(this));
        this.negRiskContract.on('TransferBatch', this.handleTransferBatch.bind(this));
        this.wsProvider._websocket.on('close', () => {
            // eslint-disable-next-line no-console
            console.warn('[ChainMonitor] WebSocket closed');
            this.handleDisconnect();
        });
        this.currentMode = 'websocket';
        this.stats.mode = 'websocket';
        this.stats.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { mode: 'websocket' });
    }
    handleTransferSingle(operator, from, to, id, value, event) {
        const transferEvent = {
            txHash: event.transactionHash,
            from: from.toLowerCase(),
            to: to.toLowerCase(),
            tokenId: id.toString(),
            amount: value.toString(),
            blockNumber: event.blockNumber,
            timestamp: Math.floor(Date.now() / 1000), // WebSocket 没有实时时间戳
            isBatch: false,
            operator: operator.toLowerCase(),
        };
        this.processEvent(transferEvent);
    }
    handleTransferBatch(operator, from, to, ids, values, event) {
        for (let i = 0; i < ids.length; i++) {
            const transferEvent = {
                txHash: event.transactionHash,
                from: from.toLowerCase(),
                to: to.toLowerCase(),
                tokenId: ids[i].toString(),
                amount: values[i].toString(),
                blockNumber: event.blockNumber,
                timestamp: Math.floor(Date.now() / 1000),
                isBatch: true,
                operator: operator.toLowerCase(),
            };
            this.processEvent(transferEvent);
        }
    }
    processEvent(event) {
        // 过滤小额交易
        const minValue = ethers.BigNumber.from(this.config.minTransferValue);
        if (minValue.gt(0) && ethers.BigNumber.from(event.amount).lt(minValue)) {
            return;
        }
        // 更新统计
        this.stats.eventsObserved++;
        this.stats.lastEventAt = new Date();
        this.stats.currentBlock = event.blockNumber;
        // 发射事件
        this.emit('transfer', event);
    }
    parseTransferLog(log, isBatch) {
        try {
            const args = log.args;
            if (!args)
                return null;
            return {
                txHash: log.transactionHash,
                from: args[1].toLowerCase(),
                to: args[2].toLowerCase(),
                tokenId: args[3].toString(),
                amount: args[4].toString(),
                blockNumber: log.blockNumber,
                timestamp: 0, // 需要额外查询区块时间
                isBatch,
                operator: args[0].toLowerCase(),
            };
        }
        catch {
            return null;
        }
    }
    startPolling() {
        if (this.pollingTimer) {
            return;
        }
        this.currentMode = 'polling';
        this.stats.mode = 'polling';
        this.stats.connected = true;
        this.emit('connected', { mode: 'polling' });
        this.pollingTimer = setInterval(async () => {
            await this.pollNewBlocks();
        }, this.config.pollingIntervalMs);
    }
    async pollNewBlocks() {
        if (!this.httpProvider || !this.isRunning) {
            return;
        }
        try {
            const currentBlock = await this.httpProvider.getBlockNumber();
            if (currentBlock > this.lastScannedBlock) {
                const events = await this.getHistoricalTransfers(this.lastScannedBlock + 1, currentBlock);
                for (const event of events) {
                    this.processEvent(event);
                }
                this.lastScannedBlock = currentBlock;
                this.stats.currentBlock = currentBlock;
            }
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error('[ChainMonitor] Polling error:', error);
            this.emit('error', error);
        }
    }
    handleDisconnect() {
        if (!this.isRunning) {
            return;
        }
        this.stats.connected = false;
        // 清理 WebSocket
        if (this.wsProvider) {
            try {
                this.wsProvider.destroy();
            }
            catch {
                // Ignore
            }
            this.wsProvider = null;
            this.ctfContract = null;
            this.negRiskContract = null;
        }
        // 自动重连
        if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.stats.reconnectCount++;
            // eslint-disable-next-line no-console
            console.log(`[ChainMonitor] Reconnecting (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
            setTimeout(async () => {
                if (this.isRunning) {
                    try {
                        await this.connectWebSocket();
                    }
                    catch {
                        // 降级到轮询
                        this.startPolling();
                    }
                }
            }, this.config.reconnectDelayMs);
        }
        else if (this.currentMode === 'websocket') {
            // 降级到轮询
            // eslint-disable-next-line no-console
            console.log('[ChainMonitor] Falling back to polling mode');
            this.startPolling();
        }
    }
}
// ===== 辅助函数 =====
/**
 * 检查地址是否为合约
 */
export async function isContractAddress(provider, address) {
    try {
        const code = await provider.getCode(address);
        return code !== '0x';
    }
    catch {
        return false;
    }
}
/**
 * 检查地址是否为官方地址
 */
export function isOfficialAddress(address) {
    return OFFICIAL_ADDRESSES.includes(address.toLowerCase());
}
