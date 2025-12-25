/**
 * Whale Discovery REST API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WhaleDiscoveryService, WhaleDiscoveryConfig } from '../services/whale-discovery-service.js';
// 使用编译后的 SDK dist
import { PolymarketSDK } from '../../../dist/index.js';
import * as fs from 'fs';
import * as path from 'path';

// 配置文件路径
const CONFIG_FILE_PATH = path.resolve(process.cwd(), '..', 'config.json');

// 全局服务实例
let whaleService: WhaleDiscoveryService | null = null;
let sdk: PolymarketSDK | null = null;

// 读取配置文件
function readConfigFile(): any {
    try {
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch {
        console.error('[Config] Failed to read config file');
    }
    return {};
}

// 保存配置文件
function saveConfigFile(config: any): void {
    try {
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 4), 'utf-8');
    } catch (error) {
        console.error('[Config] Failed to save config file:', error);
    }
}

// ===== Routes =====

export async function whaleDiscoveryRoutes(fastify: FastifyInstance): Promise<void> {

    // POST /api/whale/start - 启动服务
    fastify.post('/start', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '启动鲸鱼发现服务',
            body: {
                type: 'object',
                properties: {
                    infuraApiKey: { type: 'string', description: 'Infura API Key' },
                    minTradeUsdcValue: { type: 'number', description: '最小交易金额' },
                    minWinRate: { type: 'number', description: '最低胜率' },
                    minPnl: { type: 'number', description: '最低盈利' },
                    minVolume: { type: 'number', description: '最低交易量' },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        startedAt: { type: 'string' },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: Partial<WhaleDiscoveryConfig> }>, reply: FastifyReply) => {
        if (whaleService?.getStatus().running) {
            return reply.code(400).send({ error: 'Service already running' });
        }

        const infuraApiKey = request.body.infuraApiKey || process.env.INFURA_API_KEY;
        if (!infuraApiKey) {
            return reply.code(400).send({ error: 'Infura API key required' });
        }

        // 从配置文件读取保存的配置
        const fileConfig = readConfigFile();
        const savedConfig = fileConfig.whaleDiscovery || {};

        // 创建服务 - 优先使用配置文件的值
        whaleService = new WhaleDiscoveryService({
            infuraApiKey,
            minTradeUsdcValue: request.body.minTradeUsdcValue ?? savedConfig.minTradeUsdcValue ?? 100,
            minWinRate: request.body.minWinRate ?? savedConfig.minWinRate ?? 0.55,
            minPnl: request.body.minPnl ?? savedConfig.minPnl ?? 1000,
            minVolume: request.body.minVolume ?? savedConfig.minVolume ?? 5000,
            minTradesObserved: request.body.minTradesObserved ?? savedConfig.minTradesObserved ?? 1,
            analysisIntervalSec: request.body.analysisIntervalSec ?? savedConfig.analysisIntervalSec ?? 10,
            maxAnalysisPerBatch: 10,
        });

        // 设置钱包分析函数
        sdk = new PolymarketSDK();
        whaleService.setWalletAnalyzer(async (address: string) => {
            try {
                const profile = await sdk!.wallets.getWalletProfile(address);
                if (!profile) return null;
                // 从 WalletProfile 映射到 WhaleDiscovery 的 WalletProfile
                // SDK WalletProfile: totalPnL, realizedPnL, positionCount, tradeCount, smartScore
                return {
                    pnl: profile.realizedPnL || 0,
                    // 无法直接获取胜率，暂时用 avgPercentPnL 估算
                    winRate: profile.avgPercentPnL > 0 ? Math.min(0.8, 0.5 + profile.avgPercentPnL / 200) : 0.4,
                    totalVolume: Math.abs(profile.totalPnL) * 10, // 估算交易量
                    smartScore: profile.smartScore || 0,
                    totalTrades: profile.tradeCount || 0,
                };
            } catch {
                return null;
            }
        });

        // 注意：Polymarket 是 SPA，profile 页面不返回服务器重定向
        // 无法通过 HTTP 请求获取用户名，用户名显示为地址缩写
        // 用户可以点击链接跳转到 Polymarket 查看完整用户名

        await whaleService.start();

        return {
            status: 'started',
            startedAt: whaleService.getStatus().startedAt?.toISOString(),
        };
    });

    // POST /api/whale/stop - 停止服务
    fastify.post('/stop', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '停止鲸鱼发现服务',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        runtime: { type: 'string' },
                    },
                },
            },
        },
    }, async (_request: FastifyRequest, reply: FastifyReply) => {
        if (!whaleService?.getStatus().running) {
            return reply.code(400).send({ error: 'Service not running' });
        }

        const stats = whaleService.getStatus();
        whaleService.stop();
        whaleService = null;
        sdk = null;

        return {
            status: 'stopped',
            runtime: stats.runtime,
        };
    });

    // GET /api/whale/status - 服务状态
    fastify.get('/status', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '获取服务状态',
            response: {
                200: {
                    type: 'object',
                    properties: {
                        running: { type: 'boolean' },
                        mode: { type: 'string' },
                        startedAt: { type: 'string', nullable: true },
                        runtime: { type: 'string' },
                        tradesObserved: { type: 'number' },
                        addressesAnalyzed: { type: 'number' },
                        whalesDiscovered: { type: 'number' },
                        queueSize: { type: 'number' },
                    },
                },
            },
        },
    }, async () => {
        if (!whaleService) {
            return {
                running: false,
                mode: 'disconnected',
                startedAt: null,
                runtime: '0s',
                tradesObserved: 0,
                addressesAnalyzed: 0,
                whalesDiscovered: 0,
                queueSize: 0,
            };
        }

        const status = whaleService.getStatus();
        return {
            ...status,
            startedAt: status.startedAt?.toISOString() || null,
        };
    });

    // GET /api/whale/whales - 鲸鱼列表
    fastify.get('/whales', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '获取发现的鲸鱼列表',
            querystring: {
                type: 'object',
                properties: {
                    sort: { type: 'string', enum: ['pnl', 'volume', 'winRate'], default: 'pnl' },
                    limit: { type: 'number', default: 50 },
                },
            },
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            address: { type: 'string' },
                            discoveredAt: { type: 'string' },
                            tradesObserved: { type: 'number' },
                            volumeObserved: { type: 'number' },
                            profile: {
                                type: 'object',
                                nullable: true,
                                properties: {
                                    pnl: { type: 'number' },
                                    winRate: { type: 'number' },
                                    totalVolume: { type: 'number' },
                                    smartScore: { type: 'number' },
                                    totalTrades: { type: 'number' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Querystring: { sort?: string; limit?: number } }>) => {
        if (!whaleService) {
            return [];
        }

        const sort = (request.query.sort || 'pnl') as 'pnl' | 'volume' | 'winRate';
        const limit = request.query.limit || 50;

        return whaleService.getWhales(sort, limit).map((w) => ({
            ...w,
            discoveredAt: w.discoveredAt.toISOString(),
        }));
    });

    // GET /api/whale/trades - 最近交易
    fastify.get('/trades', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '获取最近交易',
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'number', default: 100 },
                },
            },
            response: {
                200: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            txHash: { type: 'string' },
                            from: { type: 'string' },
                            to: { type: 'string' },
                            tokenId: { type: 'string' },
                            amount: { type: 'string' },
                            blockNumber: { type: 'number' },
                            timestamp: { type: 'number' },
                        },
                    },
                },
            },
        },
    }, async (request: FastifyRequest<{ Querystring: { limit?: number } }>) => {
        if (!whaleService) {
            return [];
        }

        return whaleService.getRecentTrades(request.query.limit || 100);
    });

    // GET /api/whale/config - 获取配置（优先从文件读取）
    fastify.get('/config', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '获取当前配置',
        },
    }, async () => {
        // 从配置文件读取
        const fileConfig = readConfigFile();
        const whaleConfig = fileConfig.whaleDiscovery || {};

        // 如果服务在运行，用运行时配置覆盖
        if (whaleService) {
            const runtimeConfig = whaleService.getConfig();
            return {
                minTradeUsdcValue: runtimeConfig.minTradeUsdcValue,
                minWinRate: runtimeConfig.minWinRate,
                minPnl: runtimeConfig.minPnl,
                minVolume: runtimeConfig.minVolume,
                minTradesObserved: runtimeConfig.minTradesObserved,
                maxAnalysisPerBatch: runtimeConfig.maxAnalysisPerBatch,
                analysisIntervalSec: runtimeConfig.analysisIntervalSec,
            };
        }

        // 服务未运行，从文件返回
        return {
            minTradeUsdcValue: whaleConfig.minTradeUsdcValue ?? 100,
            minWinRate: whaleConfig.minWinRate ?? 0.55,
            minPnl: whaleConfig.minPnl ?? 1000,
            minVolume: whaleConfig.minVolume ?? 5000,
            minTradesObserved: whaleConfig.minTradesObserved ?? 1,
            analysisIntervalSec: whaleConfig.analysisIntervalSec ?? 10,
        };
    });

    // PUT /api/whale/config - 更新配置（同时保存到文件）
    fastify.put('/config', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '更新配置',
            body: {
                type: 'object',
                properties: {
                    minTradeUsdcValue: { type: 'number' },
                    minWinRate: { type: 'number' },
                    minPnl: { type: 'number' },
                    minVolume: { type: 'number' },
                    minTradesObserved: { type: 'number' },
                    maxAnalysisPerBatch: { type: 'number' },
                    analysisIntervalSec: { type: 'number' },
                },
            },
        },
    }, async (request: FastifyRequest<{ Body: Partial<WhaleDiscoveryConfig> }>) => {
        const updates = request.body;

        // 保存到配置文件
        const fileConfig = readConfigFile();
        fileConfig.whaleDiscovery = {
            ...(fileConfig.whaleDiscovery || {}),
            ...updates,
        };
        saveConfigFile(fileConfig);

        // 如果服务在运行，同时更新运行时配置
        if (whaleService) {
            whaleService.updateConfig(updates);
            return whaleService.getConfig();
        }

        return fileConfig.whaleDiscovery;
    });

    // 获取鲸鱼交易统计（使用 Data API /trades）
    async function getWhaleTradeStats(address: string, periodDays: number): Promise<{
        pnl: number;
        volume: number;
        tradeCount: number;
        buyVolume: number;
        sellVolume: number;
    }> {
        const DATA_API = 'https://data-api.polymarket.com';
        const normalizedAddress = address.toLowerCase();

        // 计算时间范围
        const now = Date.now();
        const sinceTimestamp = periodDays > 0 ? now - periodDays * 24 * 60 * 60 * 1000 : 0;

        try {
            // 获取全局交易（限制 5000 条以覆盖更长时间范围）
            const response = await fetch(`${DATA_API}/trades?limit=5000`);
            if (!response.ok) {
                throw new Error(`Data API error: ${response.status}`);
            }

            const allTrades = await response.json() as Array<{
                proxyWallet: string;
                side: string;
                size: number;
                price: number;
                timestamp: number;
            }>;

            // 过滤该地址的交易
            const whaleTrades = allTrades.filter(t =>
                t.proxyWallet?.toLowerCase() === normalizedAddress &&
                t.timestamp >= sinceTimestamp
            );

            // 计算统计
            let buyVolume = 0;
            let sellVolume = 0;

            for (const trade of whaleTrades) {
                const value = trade.size * trade.price;
                if (trade.side === 'BUY') {
                    buyVolume += value;
                } else {
                    sellVolume += value;
                }
            }

            return {
                pnl: sellVolume - buyVolume, // 简化 PnL = 卖出 - 买入
                volume: buyVolume + sellVolume,
                tradeCount: whaleTrades.length,
                buyVolume,
                sellVolume,
            };
        } catch (error) {
            console.error(`[WhaleStats] Error fetching trades for ${address}:`, error);
            return { pnl: 0, volume: 0, tradeCount: 0, buyVolume: 0, sellVolume: 0 };
        }
    }

    // GET /api/whale/profile/:address - 获取钱包时间段统计
    fastify.get('/profile/:address', {
        schema: {
            tags: ['鲸鱼发现'],
            summary: '获取钱包时间段统计',
            params: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                },
                required: ['address'],
            },
            querystring: {
                type: 'object',
                properties: {
                    period: { type: 'string', enum: ['24h', '7d', '30d', 'all'], default: 'all' },
                },
            },
        },
    }, async (request: FastifyRequest<{ Params: { address: string }; Querystring: { period?: string } }>) => {
        const { address } = request.params;
        const period = request.query.period || 'all';

        // "all" 时使用 SDK 获取完整 profile
        if (period === 'all') {
            if (!sdk) {
                sdk = new PolymarketSDK();
            }
            try {
                const profile = await sdk.wallets.getWalletProfile(address);
                return {
                    address,
                    period,
                    pnl: profile.realizedPnL || 0,
                    volume: Math.abs(profile.totalPnL) * 10, // 估算
                    tradeCount: profile.tradeCount || 0,
                    winRate: profile.avgPercentPnL > 0 ? 0.55 : 0.45,
                    smartScore: profile.smartScore || 50,
                };
            } catch {
                // SDK 失败，返回默认值
                return {
                    address,
                    period,
                    pnl: 0,
                    volume: 0,
                    tradeCount: 0,
                    winRate: 0.5,
                    smartScore: 50,
                    error: 'Data unavailable',
                };
            }
        }

        // 其他时间段尝试 Data API trades
        const periodDays = period === '24h' ? 1 : period === '7d' ? 7 : 30;
        const stats = await getWhaleTradeStats(address, periodDays);

        // 如果没有数据，返回提示
        if (stats.tradeCount === 0) {
            return {
                address,
                period,
                pnl: 0,
                volume: 0,
                tradeCount: 0,
                winRate: 0.5,
                smartScore: 50,
                noData: true,
                message: '该时间段无交易数据',
            };
        }

        return {
            address,
            period,
            pnl: stats.pnl,
            volume: stats.volume,
            tradeCount: stats.tradeCount,
            buyVolume: stats.buyVolume,
            sellVolume: stats.sellVolume,
            winRate: stats.pnl > 0 ? 0.6 : 0.4,
            smartScore: Math.min(100, Math.max(0, 50 + stats.pnl / 1000)),
        };
    });
}

