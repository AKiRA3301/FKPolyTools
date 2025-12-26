/**
 * API 服务入口
 */

import { buildApp } from './app.js';
import { config } from './config.js';
import { API_VERSION } from './version.js';

// @ts-ignore - SDK 版本从编译后的 dist 目录导入
const SDK_VERSION = '0.2.2'; // 手动同步自 src/version.ts

async function main() {
    console.log('🚀 启动 Polymarket API 服务...');
    console.log(`📦 API 版本: v${API_VERSION}`);
    console.log(`📦 SDK 版本: v${SDK_VERSION}`);

    const app = await buildApp();

    // 优雅关闭处理
    const shutdown = async (signal: string) => {
        console.log(`\n⚠️ 收到 ${signal}，正在关闭服务...`);
        try {
            await app.close();
            console.log('✅ 服务已关闭');
            process.exit(0);
        } catch (err) {
            console.error('❌ 关闭时出错:', err);
            process.exit(1);
        }
    };

    // 监听关闭信号
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    try {
        await app.listen({ port: config.port, host: config.host });
        console.log(`✅ 服务已启动: http://localhost:${config.port}`);
        console.log(`📚 API 文档: http://localhost:${config.port}/docs`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
