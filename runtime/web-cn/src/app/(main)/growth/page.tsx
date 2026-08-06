'use client';

import React, { useState, useEffect } from 'react';
import {
    Card, Row, Col, Statistic, Progress, Button, Space, Tag, Typography,
    List, Alert, Modal, Form, Input, Select, DatePicker,
    Badge, Spin
} from 'antd';
import {
    ArrowUpOutlined, ArrowDownOutlined, AimOutlined, BulbOutlined,
    TrophyOutlined, CheckCircleOutlined, WarningOutlined,
    RocketOutlined, CalendarOutlined, ThunderboltOutlined,
    RiseOutlined, FallOutlined, HeartOutlined, DollarOutlined,
    BarChartOutlined, ExclamationCircleOutlined, FireOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Mock data for demonstration
const mockGrowthData = {
    overall_score: 72,
    platform_scores: [
        { platform: '小红书', score: 85, potential: 'high' },
        { platform: '抖音', score: 68, potential: 'high' },
        { platform: '微信', score: 55, potential: 'medium' },
        { platform: 'B站', score: 42, potential: 'low' },
        { platform: '微博', score: 38, potential: 'low' },
    ],
    content_performance: [
        { type: '干货教程', avg_views: 12500, avg_engagement: 8.5 },
        { type: '好物推荐', avg_views: 8200, avg_engagement: 12.3 },
        { type: '日常分享', avg_views: 4500, avg_engagement: 6.2 },
        { type: '热点追踪', avg_views: 15600, avg_engagement: 15.8 },
    ],
    weekly_trend: [
        { day: '周一', views: 8500, engagement: 6.2 },
        { day: '周二', views: 9200, engagement: 7.1 },
        { day: '周三', views: 11500, engagement: 8.5 },
        { day: '周四', views: 10800, engagement: 7.8 },
        { day: '周五', views: 12500, engagement: 9.2 },
        { day: '周六', views: 15200, engagement: 11.5 },
        { day: '周日', views: 16800, engagement: 12.3 },
    ],
    smart_recommendations: [
        {
            id: '1',
            type: 'publish_time',
            title: '最佳发布时间',
            description: '根据您的数据，周三和周日的下午2-4点发布效果最好，比平均数据高 35%',
            confidence: 0.85,
            action: '立即调整'
        },
        {
            id: '2',
            type: 'platform_focus',
            title: '平台资源重分配',
            description: '小红书投入产出比最高，建议将 40% 资源从微博转移到小红书',
            confidence: 0.92,
            action: '查看详情'
        },
        {
            id: '3',
            type: 'topic',
            title: '蓝海话题发现',
            description: '「AI 工具测评」搜索量上涨 180%，但竞品内容较少，是切入好时机',
            confidence: 0.78,
            action: '立即创作'
        },
    ],
    growth_goals: [
        { type: '粉丝', current: 12500, target: 20000, period: '本月' },
        { type: '互动', current: 45000, target: 60000, period: '本周' },
        { type: '收入', current: 3500, target: 10000, period: '本月' },
    ]
};

export default function GrowthPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<typeof mockGrowthData>(null as any);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);

    useEffect(() => {
        // Simulate API call
        setLoading(true);
        setTimeout(() => {
            setData(mockGrowthData);
            setLoading(false);
        }, 1000);
    }, []);

    const getPotentialColor = (potential: string) => {
        switch (potential) {
            case 'high': return '#10b981';
            case 'medium': return '#f59e0b';
            case 'low': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    const radarOption = {
        tooltip: {},
        radar: {
            indicator: data?.platform_scores.map(p => ({
                name: p.platform,
                max: 100
            })) || [],
            center: ['50%', '50%'],
            radius: '65%',
        },
        series: [{
            type: 'radar',
            data: [{
                value: data?.platform_scores.map(p => p.score) || [],
                name: '平台表现',
                areaStyle: {
                    color: 'rgba(99, 102, 241, 0.3)'
                },
                lineStyle: {
                    color: '#6366f1'
                },
                itemStyle: {
                    color: '#6366f1'
                }
            }]
        }]
    };

    const trendOption = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['预估曝光', '互动率'] },
        xAxis: {
            type: 'category',
            data: data?.weekly_trend.map(d => d.day) || []
        },
        yAxis: [
            { type: 'value', name: '曝光量' },
            { type: 'value', name: '互动率', min: 0, max: 20 }
        ],
        series: [
            {
                name: '预估曝光',
                type: 'bar',
                data: data?.weekly_trend.map(d => d.views) || [],
                itemStyle: { color: '#6366f1' }
            },
            {
                name: '互动率',
                type: 'line',
                yAxisIndex: 1,
                data: data?.weekly_trend.map(d => d.engagement) || [],
                itemStyle: { color: '#a855f7' },
                smooth: true
            }
        ]
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>
                    <Text type="secondary">正在分析您的增长数据...</Text>
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
                        <AimOutlined style={{ marginRight: 12, color: '#6366f1' }} />
                        增长诊断中心
                    </Title>
                    <Text type="secondary">AI 驱动的增长策略分析，助您找到最优增长路径</Text>
                </div>
                <Space>
                    <Button
                        icon={<CalendarOutlined />}
                        onClick={() => setIsGoalModalOpen(true)}
                    >
                        设置增长目标
                    </Button>
                    <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}
                        onClick={() => {
                            Modal.info({
                                title: '🔄 重新诊断',
                                content: '正在重新分析您的数据...',
                            });
                        }}
                    >
                        重新诊断
                    </Button>
                </Space>
            </div>

            {/* Overall Score Card */}
            <Card
                style={{
                    marginBottom: 24,
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                }}
            >
                <Row gutter={24} align="middle">
                    <Col xs={24} md={6} style={{ textAlign: 'center' }}>
                        <div style={{
                            width: 140,
                            height: 140,
                            borderRadius: '50%',
                            background: `conic-gradient(${getScoreColor(data?.overall_score || 0)} ${(data?.overall_score || 0) * 3.6}deg, #e5e7eb 0deg)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto'
                        }}>
                            <div style={{
                                width: 110,
                                height: 110,
                                borderRadius: '50%',
                                background: '#fff',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Text style={{ fontSize: 36, fontWeight: 700, color: getScoreColor(data?.overall_score || 0) }}>
                                    {data?.overall_score}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>综合评分</Text>
                            </div>
                        </div>
                    </Col>
                    <Col xs={24} md={18}>
                        <Title level={4} style={{ marginBottom: 16 }}>
                            <TrophyOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
                            增长健康度诊断结果
                        </Title>
                        <Row gutter={[16, 16]}>
                            {data?.growth_goals.map((goal, idx) => (
                                <Col xs={24} sm={8} key={idx}>
                                    <Card size="small" style={{ background: '#f8fafc' }}>
                                        <Statistic
                                            title={goal.type}
                                            value={goal.current}
                                            suffix={`/ ${goal.target}`}
                                            valueStyle={{ color: '#6366f1' }}
                                        />
                                        <Progress
                                            percent={Math.round((goal.current / goal.target) * 100)}
                                            strokeColor="#6366f1"
                                            size="small"
                                            style={{ marginTop: 8 }}
                                        />
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {goal.period}目标
                                        </Text>
                                    </Card>
                                </Col>
                            ))}
                        </Row>
                        <div style={{ marginTop: 16 }}>
                            <Tag color="green" icon={<CheckCircleOutlined />}>
                                表现优于同层级创作者 23%
                            </Tag>
                            <Tag color="blue" icon={<ArrowUpOutlined />}>
                                本周环比增长 12.5%
                            </Tag>
                        </div>
                    </Col>
                </Row>
            </Card>

            {/* Smart Recommendations */}
            <Title level={4} style={{ marginBottom: 16 }}>
                <BulbOutlined style={{ color: '#f59e0b', marginRight: 8 }} />
                智能增长建议
            </Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {data?.smart_recommendations.map((rec, idx) => (
                    <Col xs={24} lg={8} key={rec.id}>
                        <Card
                            hoverable
                            style={{ height: '100%' }}
                            onClick={() => setSelectedRecommendation(rec)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Tag color={rec.type === 'platform_focus' ? 'purple' : rec.type === 'publish_time' ? 'blue' : 'green'}>
                                    {rec.type === 'publish_time' && '⏰ 最佳时机'}
                                    {rec.type === 'platform_focus' && '📊 资源分配'}
                                    {rec.type === 'topic' && '🔥 蓝海话题'}
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    置信度 {Math.round(rec.confidence * 100)}%
                                </Text>
                            </div>
                            <Title level={5} style={{ marginBottom: 8 }}>{rec.title}</Title>
                            <Paragraph type="secondary" ellipsis={{ rows: 3 }}>
                                {rec.description}
                            </Paragraph>
                            <Button type="link" style={{ padding: 0, marginTop: 8 }}>
                                {rec.action} →
                            </Button>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Charts Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                    <Card title="平台表现雷达图">
                        <ReactECharts option={radarOption} style={{ height: 350 }} />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card title="周度增长趋势">
                        <ReactECharts option={trendOption} style={{ height: 350 }} />
                    </Card>
                </Col>
            </Row>

            {/* Content Performance */}
            <Card title="📈 内容类型表现分析" style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                    {data?.content_performance.map((item, idx) => (
                        <Col xs={24} sm={12} md={6} key={idx}>
                            <Card size="small">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text strong>{item.type}</Text>
                                    <Badge
                                        count={item.avg_engagement > 10 ? '爆款' : item.avg_engagement > 7 ? '优质' : '普通'}
                                        style={{ backgroundColor: item.avg_engagement > 10 ? '#ef4444' : item.avg_engagement > 7 ? '#10b981' : '#6b7280' }}
                                    />
                                </div>
                                <Statistic
                                    title="平均曝光"
                                    value={item.avg_views}
                                    prefix={<EyeOutlined style={{ color: '#6366f1' }} />}
                                    valueStyle={{ fontSize: 20 }}
                                    formatter={(val) => `${(val as number).toLocaleString()}`}
                                />
                                <div style={{ marginTop: 8 }}>
                                    <Text type="secondary">互动率: </Text>
                                    <Text strong style={{ color: item.avg_engagement > 7 ? '#10b981' : '#f59e0b' }}>
                                        {item.avg_engagement}%
                                    </Text>
                                    {item.avg_engagement > 7 ? (
                                        <ArrowUpOutlined style={{ color: '#10b981', marginLeft: 4 }} />
                                    ) : (
                                        <FallOutlined style={{ color: '#f59e0b', marginLeft: 4 }} />
                                    )}
                                </div>
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Card>

            {/* Next Steps */}
            <Card
                title="🎯 下一步行动建议"
                style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)'
                }}
            >
                <List
                    dataSource={[
                        { priority: 'high', action: '调整发布时间到周三/周日', impact: '预计曝光提升 35%', icon: <FireOutlined style={{ color: '#ef4444' }} /> },
                        { priority: 'high', action: '增加「热点追踪」类内容', impact: '预计互动率提升 40%', icon: <RiseOutlined style={{ color: '#f59e0b' }} /> },
                        { priority: 'medium', action: '将资源向小红书倾斜', impact: '预计粉丝增长提速 25%', icon: <BarChartOutlined style={{ color: '#6366f1' }} /> },
                        { priority: 'medium', action: '尝试 AI 工具测评蓝海话题', impact: '预计获得新流量入口', icon: <AimOutlined style={{ color: '#10b981' }} /> },
                    ]}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        background: item.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                    {(item.icon as React.ReactElement<{ style?: React.CSSProperties }>)}
                                    </div>
                                }
                                title={
                                    <Space>
                                        {item.action}
                                        <Tag color={item.priority === 'high' ? 'red' : 'blue'}>
                                            {item.priority === 'high' ? '高优先级' : '中优先级'}
                                        </Tag>
                                    </Space>
                                }
                                description={`预期影响: ${item.impact}`}
                            />
                            <Button type="primary" size="small" icon={<ThunderboltOutlined />}>
                                立即执行
                            </Button>
                        </List.Item>
                    )}
                />
            </Card>

            {/* Goal Setting Modal */}
            <Modal
                title="🎯 设置增长目标"
                open={isGoalModalOpen}
                onCancel={() => setIsGoalModalOpen(false)}
                footer={null}
                width={600}
            >
                <Form layout="vertical">
                    <Form.Item label="目标类型" required>
                        <Select placeholder="选择目标类型">
                            <Option value="followers">粉丝增长</Option>
                            <Option value="views">曝光量提升</Option>
                            <Option value="engagement">互动率提升</Option>
                            <Option value="revenue">收入目标</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="目标数值" required>
                        <Input type="number" placeholder="输入目标数值" />
                    </Form.Item>
                    <Form.Item label="目标周期" required>
                        <Select placeholder="选择周期">
                            <Option value="weekly">本周</Option>
                            <Option value="monthly">本月</Option>
                            <Option value="quarterly">本季度</Option>
                            <Option value="yearly">本年度</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}>
                                保存目标
                            </Button>
                            <Button onClick={() => setIsGoalModalOpen(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Recommendation Detail Modal */}
            <Modal
                title={selectedRecommendation?.title}
                open={!!selectedRecommendation}
                onCancel={() => setSelectedRecommendation(null)}
                footer={[
                    <Button key="close" onClick={() => setSelectedRecommendation(null)}>
                        关闭
                    </Button>,
                    <Button key="action" type="primary" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}>
                        {selectedRecommendation?.action}
                    </Button>
                ]}
                width={600}
            >
                {selectedRecommendation && (
                    <div>
                        <Alert
                            type="info"
                            message="AI 智能分析"
                            description={selectedRecommendation.description}
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                            <Text strong>置信度: </Text>
                            <Progress percent={Math.round(selectedRecommendation.confidence * 100)} size="small" style={{ marginTop: 8 }} />
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

// Helper component for views icon
const EyeOutlined = ({ style }: { style?: React.CSSProperties }) => (
    <span style={{ fontSize: 16, ...style }}>👁️</span>
);
