'use client';

import React, { useState, useEffect } from 'react';
import {
    Card, Row, Col, Button, Space, Tag, Typography, Modal, Form, Input,
    Select, Table, Progress, Statistic, Badge, Tabs, Alert, List, Avatar,
    Divider, Tooltip, message, Empty, Spin
} from 'antd';
import {
    TeamOutlined, PlusOutlined, RiseOutlined, FallOutlined,
    ThunderboltOutlined, EyeOutlined, HeartOutlined, MessageOutlined,
    FireOutlined, WarningOutlined, CheckCircleOutlined, SyncOutlined,
    ArrowRightOutlined, StarOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// Mock competitor data
const mockCompetitors = [
    {
        id: '1',
        name: '科技大V',
        platform: '抖音',
        followers: 520000,
        avg_likes: 12500,
        avg_comments: 856,
        posting_frequency: 5,
        last_post_date: '2026-01-09',
        is_vip: true,
        recent_posts: [
            { title: '2026年AI手机实测', views: 125000, likes: 8500, comments: 623, is_viral: true },
            { title: '苹果发布会解读', views: 98000, likes: 6200, comments: 456, is_viral: false },
            { title: '数码省钱攻略', views: 156000, likes: 12000, comments: 892, is_viral: true },
        ],
        engagement_trend: [6.2, 5.8, 6.5, 7.2, 6.8, 7.5, 7.1]
    },
    {
        id: '2',
        name: '生活美学',
        platform: '小红书',
        followers: 350000,
        avg_likes: 8200,
        avg_comments: 423,
        posting_frequency: 8,
        last_post_date: '2026-01-10',
        is_vip: true,
        recent_posts: [
            { title: '北欧风家居布置', views: 45000, likes: 3200, comments: 156, is_viral: false },
            { title: '周末 brunch 推荐', views: 38000, likes: 2800, comments: 134, is_viral: false },
            { title: '收纳神器分享', views: 89000, likes: 7800, comments: 423, is_viral: true },
        ],
        engagement_trend: [8.5, 8.2, 8.8, 9.1, 8.9, 9.3, 9.0]
    },
    {
        id: '3',
        name: '职场进化论',
        platform: 'B站',
        followers: 280000,
        avg_likes: 6500,
        avg_comments: 1200,
        posting_frequency: 3,
        last_post_date: '2026-01-08',
        is_vip: false,
        recent_posts: [
            { title: '面试技巧大公开', views: 68000, likes: 4500, comments: 890, is_viral: false },
            { title: '职场沟通心理学', views: 52000, likes: 3800, comments: 567, is_viral: false },
        ],
        engagement_trend: [5.2, 4.8, 5.5, 5.1, 5.8, 5.3, 5.6]
    }
];

const platformColors: Record<string, string> = {
    '抖音': '#000000',
    '小红书': '#ff2442',
    'B站': '#00a1d6',
    '微信': '#07c160',
    '微博': '#e6162d'
};

export default function CompetitorPage() {
    const [loading, setLoading] = useState(false);
    const [competitors, setCompetitors] = useState<typeof mockCompetitors>(null as any);
    const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('list');

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            setCompetitors(mockCompetitors);
            setLoading(false);
        }, 1000);
    }, []);

    const getEngagementRate = (competitor: any) => {
        const rate = ((competitor.avg_likes + competitor.avg_comments) / competitor.followers * 100).toFixed(2);
        return parseFloat(rate);
    };

    const comparisonChartOption = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['您', '竞品'] },
        xAxis: { type: 'category', data: ['粉丝量', '平均点赞', '平均评论', '发布频率'] },
        yAxis: { type: 'value' },
        series: [
            {
                name: '您',
                type: 'bar',
                data: [25000, 4200, 256, 4],
                itemStyle: { color: '#6366f1' }
            },
            {
                name: '竞品',
                type: 'bar',
                data: [520000, 12500, 856, 5],
                itemStyle: { color: '#a855f7' }
            }
        ]
    };

    const trendChartOption = {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
        yAxis: { type: 'value' },
        series: [{
            data: selectedCompetitor?.engagement_trend || [],
            type: 'line',
            smooth: true,
            areaStyle: { color: 'rgba(168, 85, 247, 0.2)' },
            itemStyle: { color: '#a855f7' }
        }]
    };

    const columns = [
        {
            title: '竞品账号',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: any) => (
                <Space>
                    <Avatar style={{ backgroundColor: platformColors[record.platform] }}>{name[0]}</Avatar>
                    <div>
                        <Text strong>{name}</Text>
                        <Tag color={record.is_vip ? 'gold' : 'default'} style={{ marginLeft: 8, fontSize: 10 }}>
                            {record.is_vip ? '头部' : '优质'}
                        </Tag>
                    </div>
                </Space>
            )
        },
        {
            title: '平台',
            dataIndex: 'platform',
            key: 'platform',
            render: (platform: string) => (
                <Tag color={platformColors[platform]}>{platform}</Tag>
            )
        },
        {
            title: '粉丝量',
            dataIndex: 'followers',
            key: 'followers',
            render: (v: number) => v.toLocaleString()
        },
        {
            title: '互动率',
            key: 'engagement',
            render: (_: any, record: any) => (
                <Text type="secondary">{getEngagementRate(record).toFixed(2)}%</Text>
            )
        },
        {
            title: '日均发布',
            dataIndex: 'posting_frequency',
            key: 'posting_frequency',
            render: (v: number) => `${v}篇/天`
        },
        {
            title: '最近发布',
            dataIndex: 'last_post_date',
            key: 'last_post_date',
            render: (date: string) => {
                const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
                return (
                    <Tag color={days <= 1 ? 'green' : days <= 3 ? 'orange' : 'red'}>
                        {days === 0 ? '今天' : `${days}天前`}
                    </Tag>
                );
            }
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button type="link" size="small" onClick={() => setSelectedCompetitor(record)}>
                        分析
                    </Button>
                    <Button type="link" size="small" danger onClick={() => message.info('取消关注')}>
                        取消
                    </Button>
                </Space>
            )
        }
    ];

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                    <Text type="secondary">正在加载竞品数据...</Text>
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
                        <TeamOutlined style={{ marginRight: 12, color: '#a855f7' }} />
                        竞品监控
                    </Title>
                    <Text type="secondary">关注行业标杆，学习爆款逻辑，助您快速成长</Text>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="large"
                    onClick={() => setIsAddModalOpen(true)}
                    style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
                >
                    添加竞品
                </Button>
            </div>

            {/* Stats Overview */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="监控竞品"
                            value={competitors?.length || 0}
                            prefix={<TeamOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="发现爆款"
                            value={competitors?.reduce((sum: number, c: any) => sum + c.recent_posts.filter((p: any) => p.is_viral).length, 0) || 0}
                            prefix={<FireOutlined style={{ color: '#ef4444' }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card>
                        <Statistic
                            title="您的平均互动"
                            value={4.2}
                            suffix="%"
                            valueStyle={{ color: '#10b981' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane tab="竞品列表" key="list">
                    <Table
                        dataSource={competitors}
                        columns={columns}
                        rowKey="id"
                        pagination={{ pageSize: 5 }}
                    />
                </TabPane>

                <TabPane tab="爆款分析" key="analysis">
                    <Row gutter={[16, 16]}>
                        {competitors?.flatMap((c: any) =>
                            c.recent_posts.filter((p: any) => p.is_viral).map((p: any, idx: number) => (
                                <Col xs={24} md={12} lg={8} key={`${c.id}-${idx}`}>
                                    <Card
                                        hoverable
                                        style={{ border: '1px solid #f59e0b' }}
                                    >
                                        <Tag color="gold" style={{ marginBottom: 8 }}>🔥 爆款</Tag>
                                        <Tag color={platformColors[c.platform]}>{c.platform}</Tag>
                                        <Title level={5} style={{ margin: '12px 0' }}>{p.title}</Title>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span><EyeOutlined /> {(p.views / 1000).toFixed(1)}K</span>
                                            <span><HeartOutlined /> {(p.likes / 1000).toFixed(1)}K</span>
                                            <span><MessageOutlined /> {p.comments}</span>
                                        </div>
                                        <Button type="primary" size="small" icon={<ThunderboltOutlined />} block>
                                            AI 拆解此爆款
                                        </Button>
                                    </Card>
                                </Col>
                            ))
                        )}
                    </Row>
                </TabPane>

                <TabPane tab="对标分析" key="compare">
                    {selectedCompetitor ? (
                        <Row gutter={[16, 16]}>
                            <Col xs={24} lg={16}>
                                <Card
                                    title={
                                        <Space>
                                            <Avatar style={{ backgroundColor: platformColors[selectedCompetitor.platform] }}>
                                                {selectedCompetitor.name[0]}
                                            </Avatar>
                                            <Text strong>{selectedCompetitor.name}</Text>
                                            <Tag color={platformColors[selectedCompetitor.platform]}>{selectedCompetitor.platform}</Tag>
                                        </Space>
                                    }
                                    extra={
                                        <Button onClick={() => setSelectedCompetitor(null)}>关闭</Button>
                                    }
                                >
                                    <Alert
                                        type="success"
                                        message="分析结果"
                                        description={
                                            <div>
                                                <p>该竞品平均互动率 <Text strong>{getEngagementRate(selectedCompetitor).toFixed(2)}%</Text>，高于行业平均水平。</p>
                                                <p>建议：学习其内容结构和发布时间策略，重点关注其高互动内容的选题方向。</p>
                                            </div>
                                        }
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />

                                    <Row gutter={16} style={{ marginBottom: 16 }}>
                                        <Col span={6}>
                                            <Statistic title="粉丝量" value={selectedCompetitor.followers} />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic title="平均点赞" value={selectedCompetitor.avg_likes} />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic title="平均评论" value={selectedCompetitor.avg_comments} />
                                        </Col>
                                        <Col span={6}>
                                            <Statistic title="日均发布" value={selectedCompetitor.posting_frequency} suffix="篇" />
                                        </Col>
                                    </Row>

                                    <Divider />

                                    <Title level={5}>互动趋势 (近7天)</Title>
                                    <ReactECharts option={trendChartOption} style={{ height: 250 }} />
                                </Card>
                            </Col>

                            <Col xs={24} lg={8}>
                                <Card title="📊 您 vs 竞品 对比">
                                    <ReactECharts option={comparisonChartOption} style={{ height: 300 }} />
                                </Card>

                                <Card title="💡 优化建议" style={{ marginTop: 16 }}>
                                    <List
                                        size="small"
                                        dataSource={[
                                            { title: '增加发布频率', desc: '建议从每天 4 篇增加到 5-6 篇' },
                                            { title: '优化发布时间', desc: '竞品在晚 8-10 点发布效果最好' },
                                            { title: '学习标题技巧', desc: '竞品标题更注重悬念和数字' },
                                        ]}
                                        renderItem={(item: any) => (
                                            <List.Item>
                                                <List.Item.Meta
                                                    title={<Space><CheckCircleOutlined style={{ color: '#10b981' }} /> {item.title}</Space>}
                                                    description={item.desc}
                                                />
                                            </List.Item>
                                        )}
                                    />
                                </Card>
                            </Col>
                        </Row>
                    ) : (
                        <Empty description="选择一个竞品进行深度分析" style={{ padding: '60px 0' }}>
                            <Button type="primary" onClick={() => setActiveTab('list')}>去选择</Button>
                        </Empty>
                    )}
                </TabPane>
            </Tabs>

            {/* Add Competitor Modal */}
            <Modal
                title="添加竞品监控"
                open={isAddModalOpen}
                onCancel={() => setIsAddModalOpen(false)}
                footer={null}
                width={500}
            >
                <Form layout="vertical">
                    <Form.Item label="竞品名称" required>
                        <Input placeholder="输入竞品账号名称" />
                    </Form.Item>

                    <Form.Item label="所在平台" required>
                        <Select placeholder="选择平台">
                            <Option value="douyin">抖音</Option>
                            <Option value="xiaohongshu">小红书</Option>
                            <Option value="bilibili">B站</Option>
                            <Option value="wechat">微信</Option>
                            <Option value="weibo">微博</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label="主页链接" required>
                        <Input placeholder="粘贴竞品主页链接" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                onClick={() => {
                                    message.success('竞品添加成功，AI正在抓取数据...');
                                    setIsAddModalOpen(false);
                                }}
                                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' }}
                            >
                                添加监控
                            </Button>
                            <Button onClick={() => setIsAddModalOpen(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
