'use client';

import React, { useState, useEffect } from 'react';
import {
    Card, Row, Col, Statistic, Progress, Button, Space, Tag, Typography,
    Table, Modal, Form, Input, Select, Slider, List, Alert, Tabs, Divider,
    Tooltip, Badge, Spin, Empty, Timeline
} from 'antd';
import {
    DollarOutlined, RiseOutlined, ShoppingOutlined, BulbOutlined,
    CalculatorOutlined, ThunderboltOutlined, TrophyOutlined,
    FileTextOutlined, EditOutlined, PlusOutlined, ExportOutlined,
    CheckCircleOutlined, InfoCircleOutlined, RocketOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// Mock data for monetization
const mockMonetizationData = {
    total_revenue: 28500,
    ad_revenue: 15200,
    product_sales: 8500,
    consultation_revenue: 4800,
    monthly_trend: [
        { month: '8月', revenue: 12500 },
        { month: '9月', revenue: 15800 },
        { month: '10月', revenue: 19200 },
        { month: '11月', revenue: 22500 },
        { month: '12月', revenue: 26800 },
        { month: '1月', revenue: 28500 },
    ],
    top_performing: [
        { title: 'AI工具测评合集', platform: '小红书', revenue: 5200, roi: 320 },
        { title: '2026年赚钱指南', platform: 'B站', revenue: 4800, roi: 280 },
        { title: '副业变现攻略', platform: '公众号', revenue: 3500, roi: 245 },
        { title: '直播带货复盘', platform: '抖音', revenue: 2900, roi: 195 },
    ],
    ad_quotes: [
        { platform: '小红书', follower_count: 25000, avg_engagement: 8.5, price_range: { min: 800, max: 1500 } },
        { platform: '抖音', follower_count: 45000, avg_engagement: 5.2, price_range: { min: 1500, max: 3000 } },
        { platform: 'B站', follower_count: 18000, avg_engagement: 12.3, price_range: { min: 1000, max: 2000 } },
    ],
    products: [
        { id: '1', name: 'AI创作课', price: 299, sales: 156, revenue: 46644, status: 'active' },
        { id: '2', name: '变现工具包', price: 99, sales: 423, revenue: 41877, status: 'active' },
        { id: '3', name: '1v1咨询', price: 500, sales: 32, revenue: 16000, status: 'active' },
    ]
};

export default function MonetizationPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<typeof mockMonetizationData>(null as any);
    const [activeTab, setActiveTab] = useState('overview');
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            setData(mockMonetizationData);
            setLoading(false);
        }, 1000);
    }, []);

    const revenueChartOption = {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data?.monthly_trend.map(m => m.month) || [] },
        yAxis: { type: 'value' },
        series: [{
            data: data?.monthly_trend.map(m => m.revenue) || [],
            type: 'line',
            smooth: true,
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(99, 102, 241, 0.5)' },
                        { offset: 1, color: 'rgba(99, 102, 241, 0.05)' }
                    ]
                }
            },
            itemStyle: { color: '#6366f1' }
        }]
    };

    const breakdownChartOption = {
        tooltip: { trigger: 'item' },
        series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            data: [
                { value: data?.ad_revenue || 0, name: '广告分成', itemStyle: { color: '#6366f1' } },
                { value: data?.product_sales || 0, name: '商品销售', itemStyle: { color: '#a855f7' } },
                { value: data?.consultation_revenue || 0, name: '咨询服务', itemStyle: { color: '#10b981' } },
            ]
        }]
    };

    const revenueColumns = [
        { title: '内容标题', dataIndex: 'title', key: 'title' },
        { title: '平台', dataIndex: 'platform', key: 'platform', render: (p: string) => <Tag>{p}</Tag> },
        { title: '收益', dataIndex: 'revenue', key: 'revenue', render: (v: number) => `¥${v.toLocaleString()}` },
        { title: 'ROI', dataIndex: 'roi', key: 'roi', render: (v: number) => <Text strong style={{ color: v > 200 ? '#10b981' : '#f59e0b' }}>{v}%</Text> },
        { title: '操作', key: 'action', render: () => <Button type="link" size="small">分析</Button> },
    ];

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                    <Text type="secondary">正在加载收益数据...</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>
                        <DollarOutlined style={{ marginRight: 12, color: '#10b981' }} />
                        变现中心
                    </Title>
                    <Text type="secondary">全方位管理您的内容变现，让创作产生实际收益</Text>
                </div>
                <Space>
                    <Button icon={<ExportOutlined />}>导出报表</Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}
                        onClick={() => setIsProductModalOpen(true)}
                    >
                        添加商品
                    </Button>
                </Space>
            </div>

            {/* Revenue Overview */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="本月总收益"
                            value={data?.total_revenue}
                            prefix="¥"
                            valueStyle={{ color: '#10b981', fontWeight: 700 }}
                        />
                        <div style={{ marginTop: 8 }}>
                            <Text type="secondary">较上月 </Text>
                            <Text style={{ color: '#10b981' }}><RiseOutlined /> 23.5%</Text>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="广告分成"
                            value={data?.ad_revenue}
                            prefix="¥"
                            valueStyle={{ color: '#6366f1' }}
                        />
                        <Progress percent={Math.round((data?.ad_revenue / data?.total_revenue) * 100)} size="small" strokeColor="#6366f1" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="商品销售"
                            value={data?.product_sales}
                            prefix="¥"
                            valueStyle={{ color: '#a855f7' }}
                        />
                        <Progress percent={Math.round((data?.product_sales / data?.total_revenue) * 100)} size="small" strokeColor="#a855f7" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="咨询服务"
                            value={data?.consultation_revenue}
                            prefix="¥"
                            valueStyle={{ color: '#f59e0b' }}
                        />
                        <Progress percent={Math.round((data?.consultation_revenue / data?.total_revenue) * 100)} size="small" strokeColor="#f59e0b" />
                    </Card>
                </Col>
            </Row>

            {/* Tabs */}
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane tab="收益概览" key="overview">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={16}>
                            <Card title="收益趋势">
                                <ReactECharts option={revenueChartOption} style={{ height: 300 }} />
                            </Card>
                        </Col>
                        <Col xs={24} lg={8}>
                            <Card title="收益构成">
                                <ReactECharts option={breakdownChartOption} style={{ height: 300 }} />
                            </Card>
                        </Col>
                    </Row>

                    <Card title="🏆 收益TOP内容" style={{ marginTop: 16 }}>
                        <Table
                            dataSource={data?.top_performing}
                            columns={revenueColumns}
                            rowKey="title"
                            pagination={false}
                        />
                    </Card>
                </TabPane>

                <TabPane tab="广告报价" key="quotes">
                    <Alert
                        type="info"
                        message="AI智能定价"
                        description="基于您的账号数据（粉丝量、互动率、内容质量），AI为您推荐最优广告报价。实际报价可根据品牌方需求灵活调整。"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />

                    <Row gutter={[16, 16]}>
                        {data?.ad_quotes.map((quote, idx) => (
                            <Col xs={24} md={8} key={idx}>
                                <Card
                                    title={
                                        <Space>
                                            <span>{quote.platform}</span>
                                            <Tag color="green">推荐</Tag>
                                        </Space>
                                    }
                                    extra={
                                        <Button type="link" onClick={() => setIsQuoteModalOpen(true)}>
                                            调整
                                        </Button>
                                    }
                                >
                                    <div style={{ marginBottom: 16 }}>
                                        <Text type="secondary">粉丝量: </Text>
                                        <Text strong>{quote.follower_count.toLocaleString()}</Text>
                                    </div>
                                    <div style={{ marginBottom: 16 }}>
                                        <Text type="secondary">平均互动率: </Text>
                                        <Text strong>{quote.avg_engagement}%</Text>
                                    </div>
                                    <Divider />
                                    <div>
                                        <Text type="secondary">建议报价范围</Text>
                                        <Title level={4} style={{ margin: '8px 0', color: '#10b981' }}>
                                            ¥{quote.price_range.min.toLocaleString()} - ¥{quote.price_range.max.toLocaleString()}
                                        </Title>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            单条图文/视频广告
                                        </Text>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>

                    <Card style={{ marginTop: 16, background: '#f8fafc' }}>
                        <Title level={5}><CalculatorOutlined /> 报价计算器</Title>
                        <Row gutter={24}>
                            <Col xs={24} md={12}>
                                <Form layout="vertical">
                                    <Form.Item label="粉丝数量">
                                        <Input placeholder="输入粉丝数量" defaultValue="25000" />
                                    </Form.Item>
                                    <Form.Item label="平均互动率 (%)">
                                        <Slider min={1} max={20} defaultValue={8.5} />
                                    </Form.Item>
                                </Form>
                            </Col>
                            <Col xs={24} md={12}>
                                <div style={{ background: '#fff', padding: 20, borderRadius: 12 }}>
                                    <Text strong>计算结果：</Text>
                                    <Title level={3} style={{ color: '#10b981' }}>¥1,050 - ¥1,875</Title>
                                    <Text type="secondary">基于行业标准计算，仅供参考</Text>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </TabPane>

                <TabPane tab="商品管理" key="products">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={16}>
                            <Card
                                title="我的商品"
                                extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setIsProductModalOpen(true)}>添加商品</Button>}
                            >
                                <Table
                                    dataSource={data?.products}
                                    columns={[
                                        { title: '商品名称', dataIndex: 'name', key: 'name' },
                                        { title: '价格', dataIndex: 'price', key: 'price', render: (v: number) => `¥${v}` },
                                        { title: '销量', dataIndex: 'sales', key: 'sales' },
                                        { title: '总收入', dataIndex: 'revenue', key: 'revenue', render: (v: number) => `¥${v.toLocaleString()}` },
                                        { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Badge status={s === 'active' ? 'success' : 'default'} text={s === 'active' ? '上架中' : '已下架'} /> },
                                        { title: '操作', key: 'action', render: () => <Space><Button type="link" size="small">编辑</Button><Button type="link" size="small" danger>下架</Button></Space> },
                                    ]}
                                    rowKey="id"
                                />
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card title="带货选品推荐">
                                <List
                                    dataSource={[
                                        { name: 'AI写作助手', commission: '15%', potential: '高' },
                                        { name: '直播设备套装', commission: '12%', potential: '高' },
                                        { name: '知识付费工具', commission: '20%', potential: '中' },
                                        { name: '美妆护肤品牌', commission: '10%', potential: '中' },
                                    ]}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <List.Item.Meta
                                                title={item.name}
                                                description={`佣金比例: ${item.commission}`}
                                            />
                                            <Tag color={item.potential === '高' ? 'green' : 'blue'}>{item.potential}潜力</Tag>
                                        </List.Item>
                                    )}
                                />
                            </Card>
                        </Col>
                    </Row>
                </TabPane>

                <TabPane tab="变现攻略" key="guide">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={12}>
                            <Card title="💡 提升收益的实用技巧">
                                <Timeline
                                    items={[
                                        { color: 'green', children: '保持稳定更新频率，每周至少3-5篇高质量内容' },
                                        { color: 'green', children: '优化封面和标题，提升点击率' },
                                        { color: 'blue', children: '积极回复评论，提升互动数据' },
                                        { color: 'blue', children: '尝试多种内容形式（图文、短视频、直播）' },
                                        { color: 'purple', children: '建立个人IP，提升品牌溢价能力' },
                                        { color: 'gold', children: '拓展多元化变现渠道，降低单一依赖风险' },
                                    ]}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                            <Card title="📊 同行业变现数据对比">
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text>您的平均单篇收益</Text>
                                        <Text strong>¥1,250</Text>
                                    </div>
                                    <Progress percent={75} strokeColor="#6366f1" />
                                </div>
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text>同层级创作者平均</Text>
                                        <Text strong>¥1,680</Text>
                                    </div>
                                    <Progress percent={85} strokeColor="#a855f7" />
                                </div>
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Text>头部创作者平均</Text>
                                        <Text strong>¥5,000+</Text>
                                    </div>
                                    <Progress percent={25} strokeColor="#f59e0b" />
                                </div>
                                <Alert
                                    type="success"
                                    message="您已超过 65% 同层级创作者！"
                                    icon={<TrophyOutlined />}
                                    style={{ marginTop: 16 }}
                                />
                            </Card>
                        </Col>
                    </Row>
                </TabPane>
            </Tabs>

            {/* Quote Adjustment Modal */}
            <Modal
                title="调整广告报价"
                open={isQuoteModalOpen}
                onCancel={() => setIsQuoteModalOpen(false)}
                footer={null}
            >
                <Form layout="vertical">
                    <Form.Item label="图文广告报价 (¥)">
                        <Input type="number" placeholder="输入报价" defaultValue={800} />
                    </Form.Item>
                    <Form.Item label="视频广告报价 (¥)">
                        <Input type="number" placeholder="输入报价" defaultValue={1500} />
                    </Form.Item>
                    <Form.Item label="直播带货坑位费 (¥)">
                        <Input type="number" placeholder="输入报价" defaultValue={3000} />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" onClick={() => setIsQuoteModalOpen(false)}>保存</Button>
                            <Button onClick={() => setIsQuoteModalOpen(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Add Product Modal */}
            <Modal
                title="添加商品"
                open={isProductModalOpen}
                onCancel={() => setIsProductModalOpen(false)}
                footer={null}
                width={600}
            >
                <Form layout="vertical">
                    <Form.Item label="商品名称" required>
                        <Input placeholder="输入商品名称" />
                    </Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="价格 (¥)" required>
                                <Input type="number" placeholder="价格" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="商品类型" required>
                                <Select placeholder="选择类型">
                                    <Option value="course">在线课程</Option>
                                    <Option value="ebook">电子书</Option>
                                    <Option value="tool">工具/软件</Option>
                                    <Option value="consult">咨询服务</Option>
                                    <Option value="physical">实物商品</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="商品描述">
                        <Input.TextArea rows={4} placeholder="描述商品特色和卖点" />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' }}>发布商品</Button>
                            <Button onClick={() => setIsProductModalOpen(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
