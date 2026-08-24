'use client';

import React from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress } from 'antd';
import {
    ArrowUpOutlined,
    ArrowDownOutlined,
    EyeOutlined,
    LikeOutlined,
    UserAddOutlined,
    FileTextOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';

export default function DashboardPage() {
    // Mock data
    const stats = [
        {
            title: '今日发布',
            value: 12,
            prefix: <FileTextOutlined />,
            suffix: '条',
            trend: 8.5,
            trendUp: true,
        },
        {
            title: '总曝光',
            value: 125680,
            prefix: <EyeOutlined />,
            trend: 12.3,
            trendUp: true,
        },
        {
            title: '总互动',
            value: 8542,
            prefix: <LikeOutlined />,
            trend: 5.2,
            trendUp: true,
        },
        {
            title: '新增粉丝',
            value: 342,
            prefix: <UserAddOutlined />,
            trend: 2.1,
            trendUp: false,
        },
    ];

    const trendChartOption = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow',
            },
        },
        legend: {
            data: ['曝光', '互动', '涨粉'],
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        },
        yAxis: {
            type: 'value',
        },
        series: [
            {
                name: '曝光',
                type: 'line',
                smooth: true,
                data: [12000, 13200, 10100, 13400, 9000, 23000, 21000],
                itemStyle: { color: '#6366f1' },
            },
            {
                name: '互动',
                type: 'line',
                smooth: true,
                data: [1200, 1320, 1010, 1340, 900, 2300, 2100],
                itemStyle: { color: '#10b981' },
            },
            {
                name: '涨粉',
                type: 'line',
                smooth: true,
                data: [50, 60, 45, 70, 40, 110, 95],
                itemStyle: { color: '#f59e0b' },
            },
        ],
    };

    const platformChartOption = {
        tooltip: {
            trigger: 'item',
        },
        legend: {
            orient: 'vertical',
            left: 'left',
        },
        series: [
            {
                name: '平台分布',
                type: 'pie',
                radius: '50%',
                data: [
                    { value: 1048, name: '抖音' },
                    { value: 735, name: '小红书' },
                    { value: 580, name: '微信视频号' },
                    { value: 484, name: '微博' },
                    { value: 300, name: 'B站' },
                ],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)',
                    },
                },
            },
        ],
    };

    const topContents = [
        {
            key: '1',
            title: '如何用AI提升内容创作效率10倍',
            platform: ['抖音', '小红书'],
            views: 125680,
            likes: 8542,
            status: 'published',
        },
        {
            key: '2',
            title: '2024年自媒体运营必备工具推荐',
            platform: ['微博', '公众号'],
            views: 98234,
            likes: 6721,
            status: 'published',
        },
        {
            key: '3',
            title: '小红书爆款标题的5个秘诀',
            platform: ['小红书'],
            views: 87456,
            likes: 5432,
            status: 'published',
        },
    ];

    const columns = [
        {
            title: '标题',
            dataIndex: 'title',
            key: 'title',
            width: '40%',
        },
        {
            title: '平台',
            dataIndex: 'platform',
            key: 'platform',
            render: (platforms: string[]) => (
                <>
                    {platforms.map((platform) => (
                        <Tag key={platform} color="blue">
                            {platform}
                        </Tag>
                    ))}
                </>
            ),
        },
        {
            title: '曝光',
            dataIndex: 'views',
            key: 'views',
            render: (views: number) => views.toLocaleString(),
        },
        {
            title: '互动',
            dataIndex: 'likes',
            key: 'likes',
            render: (likes: number) => likes.toLocaleString(),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color="success">已发布</Tag>
            ),
        },
    ];

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>工作台</h1>

            {/* Stats Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                {stats.map((stat, index) => (
                    <Col xs={24} sm={12} lg={6} key={index}>
                        <Card>
                            <Statistic
                                title={stat.title}
                                value={stat.value}
                                prefix={stat.prefix}
                                suffix={stat.suffix}
                                valueStyle={{ color: '#1890ff', fontSize: 28, fontWeight: 600 }}
                            />
                            <div style={{ marginTop: 8, fontSize: 12 }}>
                                {stat.trendUp ? (
                                    <span style={{ color: '#10b981' }}>
                                        <ArrowUpOutlined /> {stat.trend}%
                                    </span>
                                ) : (
                                    <span style={{ color: '#ef4444' }}>
                                        <ArrowDownOutlined /> {stat.trend}%
                                    </span>
                                )}
                                <span style={{ marginLeft: 8, color: '#6b7280' }}>较昨日</span>
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Charts */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={16}>
                    <Card title="数据趋势" bordered={false}>
                        <ReactECharts option={trendChartOption} style={{ height: 350 }} />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title="平台分布" bordered={false}>
                        <ReactECharts option={platformChartOption} style={{ height: 350 }} />
                    </Card>
                </Col>
            </Row>

            {/* Top Contents */}
            <Card title="本周爆款内容 TOP 3" bordered={false}>
                <Table
                    columns={columns}
                    dataSource={topContents}
                    pagination={false}
                />
            </Card>
        </div>
    );
}
