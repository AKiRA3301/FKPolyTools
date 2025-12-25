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
import { ethers } from 'ethers';
import { EventEmitter } from 'events';
/** Polymarket CTF Exchange (ERC1155) */
export declare const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
/** NegRisk CTF Exchange */
export declare const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
/** 实际的 CTF 条件代币合约 - ERC1155 代币转移发生在这里 */
export declare const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
/** NegRisk 适配器 */
export declare const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
/** Polymarket 官方地址（用于过滤） */
export declare const OFFICIAL_ADDRESSES: string[];
export interface ChainMonitorConfig {
    /** Infura API Key */
    infuraApiKey: string;
    /** Infura 网络 (default: 'polygon-mainnet') */
    infuraNetwork?: string;
    /** 启用 WebSocket (default: true) */
    wsEnabled?: boolean;
    /** 轮询间隔毫秒 (default: 3000) */
    pollingIntervalMs?: number;
    /** 最小交易金额过滤 (default: 0，不过滤) */
    minTransferValue?: string;
    /** 自动重连 (default: true) */
    autoReconnect?: boolean;
    /** 重连延迟毫秒 (default: 5000) */
    reconnectDelayMs?: number;
    /** 最大重连次数 (default: 10) */
    maxReconnectAttempts?: number;
}
export interface TransferEvent {
    /** 交易哈希 */
    txHash: string;
    /** 发送方地址 */
    from: string;
    /** 接收方地址 */
    to: string;
    /** CTF Token ID */
    tokenId: string;
    /** 代币数量 (字符串，避免 BigInt 兼容性问题) */
    amount: string;
    /** 区块号 */
    blockNumber: number;
    /** 时间戳 (秒) */
    timestamp: number;
    /** 是否为批量转移的一部分 */
    isBatch: boolean;
    /** 操作者地址 */
    operator: string;
}
export interface ChainMonitorStats {
    /** 连接模式 */
    mode: 'websocket' | 'polling' | 'disconnected';
    /** 是否已连接 */
    connected: boolean;
    /** 启动时间 */
    startedAt?: Date;
    /** 观察到的事件数 */
    eventsObserved: number;
    /** 最后收到事件时间 */
    lastEventAt?: Date;
    /** 重连次数 */
    reconnectCount: number;
    /** 当前区块号 */
    currentBlock?: number;
}
export declare class ChainMonitorClient extends EventEmitter {
    private config;
    private httpProvider;
    private wsProvider;
    private ctfContract;
    private negRiskContract;
    private isRunning;
    private currentMode;
    private pollingTimer;
    private lastScannedBlock;
    private reconnectAttempts;
    private stats;
    constructor(config: ChainMonitorConfig);
    /**
     * 连接到 Polygon 链
     */
    connect(): Promise<void>;
    /**
     * 断开连接
     */
    disconnect(): void;
    /**
     * 获取服务状态
     */
    getStats(): ChainMonitorStats;
    /**
     * 是否已连接
     */
    isConnected(): boolean;
    /**
     * 获取当前模式
     */
    getMode(): 'websocket' | 'polling' | 'disconnected';
    /**
     * 订阅所有 CTF 转移事件（AsyncIterable）
     */
    subscribeAllTransfers(): AsyncIterable<TransferEvent>;
    /**
     * 获取指定区块范围的历史事件
     */
    getHistoricalTransfers(fromBlock: number, toBlock: number): Promise<TransferEvent[]>;
    private connectWebSocket;
    private handleTransferSingle;
    private handleTransferBatch;
    private processEvent;
    private parseTransferLog;
    private startPolling;
    private pollNewBlocks;
    private handleDisconnect;
}
/**
 * 检查地址是否为合约
 */
export declare function isContractAddress(provider: ethers.providers.Provider, address: string): Promise<boolean>;
/**
 * 检查地址是否为官方地址
 */
export declare function isOfficialAddress(address: string): boolean;
