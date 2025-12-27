/**
 * 套利 API 路由
 */

import { FastifyPluginAsync } from 'fastify';
import { PolymarketSDK, checkArbitrage } from '../../../dist/index.js';
import { config } from '../config.js';

const sdk = new PolymarketSDK();

export const arbitrageRoutes: FastifyPluginAsync = async (fastify) => {
    // 扫描所有市场的套利机会
    fastify.get('/scan', {
        schema: {
            tags: ['套利'],
            summary: '扫描套利机会',
            querystring: {
                type: 'object',
                properties: {
                    minVolume: { type: 'number', default: 5000 },
                    limit: { type: 'number', default: 50 },
                    minProfit: { type: 'number', default: 0.003 },
                },
            },
        },
        handler: async (request, reply) => {
            const { minVolume = 5000, limit = 50, minProfit = 0.003 } = request.query as any;

            const markets = await sdk.gammaApi.getMarkets({
                closed: false,
                active: true,
                limit,
            });

            const opportunities = [];
            let scannedCount = 0;
            let errorCount = 0;
            let noArbCount = 0;

            console.log(`[Arbitrage] Starting scan: ${markets.length} markets, minVolume=${minVolume}, minProfit=${minProfit}`);

            for (const market of markets) {
                if (!market.conditionId) continue;
                if ((market.volume24hr || 0) < minVolume) continue;

                scannedCount++;

                try {
                    const orderbook = await sdk.clobApi.getProcessedOrderbook(market.conditionId);

                    // Debug: Log first 3 orderbooks to see data format
                    if (scannedCount <= 3) {
                        console.log(`[Arbitrage] Sample orderbook for "${market.question?.substring(0, 50)}...":`);
                        console.log(`  YES: ask=${orderbook.yes.ask}, bid=${orderbook.yes.bid}`);
                        console.log(`  NO:  ask=${orderbook.no.ask}, bid=${orderbook.no.bid}`);
                        console.log(`  Sum(asks)=${(orderbook.yes.ask + orderbook.no.ask).toFixed(4)}`);
                    }

                    const arb = checkArbitrage(
                        orderbook.yes.ask,
                        orderbook.no.ask,
                        orderbook.yes.bid,
                        orderbook.no.bid
                    );

                    if (arb && arb.profit > minProfit) {
                        opportunities.push({
                            market: {
                                conditionId: market.conditionId,
                                question: market.question,
                                slug: market.slug,
                                volume24hr: market.volume24hr,
                            },
                            arbType: arb.type,
                            profit: arb.profit,
                            profitPercent: arb.profit * 100,
                            description: arb.description,
                            orderbook: {
                                yesAsk: orderbook.yes.ask,
                                yesBid: orderbook.yes.bid,
                                noAsk: orderbook.no.ask,
                                noBid: orderbook.no.bid,
                            },
                        });
                    } else {
                        noArbCount++;
                    }
                } catch (error) {
                    errorCount++;
                    // Skip markets where orderbook cannot be fetched
                }
            }

            console.log(`[Arbitrage] Scan complete: scanned=${scannedCount}, noArb=${noArbCount}, errors=${errorCount}, found=${opportunities.length}`);

            // 按利润排序
            opportunities.sort((a, b) => b.profit - a.profit);

            return {
                count: opportunities.length,
                opportunities,
                scannedAt: new Date().toISOString(),
            };
        },
    });

    // 检测特定市场的套利
    fastify.get('/:conditionId', {
        schema: {
            tags: ['套利'],
            summary: '检测特定市场套利',
            params: {
                type: 'object',
                properties: {
                    conditionId: { type: 'string' },
                },
                required: ['conditionId'],
            },
        },
        handler: async (request, reply) => {
            const { conditionId } = request.params as { conditionId: string };
            const arb = await sdk.detectArbitrage(conditionId);

            if (arb) {
                return {
                    hasOpportunity: true,
                    type: arb.type,
                    profit: arb.profit,
                    profitPercent: arb.profit * 100,
                    action: arb.action,
                };
            }

            return {
                hasOpportunity: false,
                message: '无套利机会',
            };
        },
    });
};
