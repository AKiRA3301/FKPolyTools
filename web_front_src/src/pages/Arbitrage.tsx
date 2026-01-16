import { useEffect, useState } from 'react';
import { Table, Typography, Card, Alert, Button, Tag, Row, Col, Statistic, Empty } from 'antd';
import { SyncOutlined, ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { arbitrageApi } from '../api/client';

const { Title, Paragraph } = Typography;

interface Opportunity {
    market: {
        conditionId: string;
        question: string;
        volume24hr: number;
    };
    arbType: 'long' | 'short';
    profit: number;
    profitPercent: number;
    description: string;
    orderbook: {
        yesAsk: number;
        yesBid: number;
        noAsk: number;
        noBid: number;
    };
}

function Arbitrage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [scannedAt, setScannedAt] = useState<string>('');
    const [scanSuccess, setScanSuccess] = useState(false); // 新增：标记扫描是否成功

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            setScanSuccess(false);
            
            // Debug mode: minVolume $100, minProfit 0%
            const res = await arbitrageApi.scan(100, 500, 0);
            
            // ✅ 扫描成功
            setScanSuccess(true);
            setOpportunities(res.data.opportunities || []);
            setScannedAt(res.data.scannedAt);
            
        } catch (err) {
            // ❌ 真正的错误（网络错误、API 失败等）
            setScanSuccess(false);
            const errorMessage = err instanceof Error ? err.message : '未知错误';
            setError(`扫描失败: ${errorMessage}`);
            console.error('套利扫描错误:', err);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: '类型',
            dataIndex: 'arbType',
            key: 'arbType',
            render: (t: string) => (
                <Tag color={t === 'long' ? 'green' : 'orange'}>
                    {t === 'long' ? '多头' : '空头'}
                </Tag>
            ),
            width: 80,
        },
        {
            title: '市场',
            dataIndex: ['market', 'question'],
            key: 'question',
            ellipsis: true,
        },
        {
            title: '利润',
            dataIndex: 'profitPercent',
            key: 'profitPercent',
            render: (v: number) => (
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                    +{v.toFixed(2)}%
                </span>
            ),
            width: 100,
            sorter: (a: Opportunity, b: Opportunity) => a.profitPercent - b.profitPercent,
            defaultSortOrder: 'descend' as const,
        },
        {
            title: '24h 交易量',
            dataIndex: ['market', 'volume24hr'],
            key: 'volume24hr',
            render: (v: number) => `$${(v / 1000).toFixed(1)}K`,
            width: 120,
        },
        {
            title: 'YES Ask',
            dataIndex: ['orderbook', 'yesAsk'],
            key: 'yesAsk',
            render: (v: number) => v?.toFixed(4),
            width: 100,
        },
        {
            title: 'NO Ask',
            dataIndex: ['orderbook', 'noAsk'],
            key: 'noAsk',
            render: (v: number) => v?.toFixed(4),
            width: 100,
        },
    ];

    const profitableCount = opportunities.filter((o) => o.profitPercent > 0.5).length;

    // ❌ 真正的错误提示
    if (error) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Title level={3} style={{ color: '#fff', margin: 0 }}>
                        <ThunderboltOutlined style={{ marginRight: 8 }} />
                        套利 YES+NO=1
                    </Title>
                    <Button
                        type="primary"
                        icon={<SyncOutlined />}
                        onClick={loadData}
                    >
                        重试
                    </Button>
                </div>
                <Alert 
                    message="扫描失败" 
                    description={
                        <div>
                            <p>{error}</p>
                            <p style={{ marginTop: 8, color: '#666' }}>
                                可能的原因：网络连接问题、API 服务异常、请求超时等
                            </p>
                        </div>
                    }
                    type="error" 
                    showIcon 
                />
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={3} style={{ color: '#fff', margin: 0 }}>
                    <ThunderboltOutlined style={{ marginRight: 8 }} />
                    套利 YES+NO=1
                </Title>
                <Button
                    type="primary"
                    icon={<SyncOutlined spin={loading} />}
                    onClick={loadData}
                    loading={loading}
                >
                    刷新扫描
                </Button>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card className="stat-card">
                        <Statistic
                            title="发现机会"
                            value={opportunities.length}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card className="stat-card">
                        <Statistic
                            title="高利润机会 (>0.5%)"
                            value={profitableCount}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card className="stat-card">
                        <Statistic
                            title="最后扫描"
                            value={scannedAt ? new Date(scannedAt).toLocaleTimeString() : '-'}
                            valueStyle={{ fontSize: 18 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* ✅ 扫描成功但无机会的友好提示 */}
            {scanSuccess && opportunities.length === 0 && !loading && (
                <Card style={{ marginBottom: 24, background: '#fffbe6', borderColor: '#ffe58f' }}>
                    <Alert
                        message="✅ 扫描完成"
                        description={`当前未发现套利机会（扫描时间: ${scannedAt ? new Date(scannedAt).toLocaleString('zh-CN') : ''}）`}
                        type="warning"
                        showIcon
                        icon={<InfoCircleOutlined />}
                        style={{ marginBottom: 16 }}
                    />
                    
                    <Card 
                        size="small" 
                        title="💡 关于套利机会"
                        style={{ background: '#fff' }}
                    >
                        <Paragraph>
                            <strong>为什么没有套利机会？</strong>
                        </Paragraph>
                        <ul style={{ marginBottom: 16 }}>
                            <li>Polymarket 市场通常很高效，做市商会快速填补价格差异</li>
                            <li>Gas 费用（约 $0.01-0.05）会消耗小额利润</li>
                            <li>套利机会通常只存在几秒到几分钟</li>
                            <li>大多数机会被自动化机器人抢先执行</li>
                        </ul>
                        
                        <Paragraph>
                            <strong>如何提高发现机会的概率：</strong>
                        </Paragraph>
                        <ul>
                            <li>✅ 增加扫描频率（建议每 5-10 分钟扫描一次）</li>
                            <li>✅ 关注重大新闻发布时段（市场波动大）</li>
                            <li>✅ 降低最小利润阈值（但需考虑 Gas 成本）</li>
                            <li>✅ 扫描更多市场和新开市场</li>
                        </ul>
                    </Card>
                </Card>
            )}

            {/* ✅ 有机会时的成功提示 */}
            {scanSuccess && opportunities.length > 0 && !loading && (
                <Alert
                    message={`🎉 发现 ${opportunities.length} 个套利机会！`}
                    description={`其中 ${profitableCount} 个高利润机会（>0.5%）`}
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Table
                dataSource={opportunities}
                columns={columns}
                rowKey={(r) => r.market.conditionId}
                pagination={{ pageSize: 20 }}
                loading={loading}
                style={{ background: '#1f1f1f', borderRadius: 8 }}
                locale={{
                    emptyText: loading ? '加载中...' : scanSuccess ? '当前无套利机会' : '开始扫描'
                }}
            />
        </div>
    );
}

export default Arbitrage;
