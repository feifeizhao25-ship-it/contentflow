'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Space, Tag, Typography, Modal, Form, Input, Select, Table, Statistic, Badge, List, Avatar, Divider, Alert, message } from 'antd';
import { TeamOutlined, PlusOutlined, ThunderboltOutlined, RocketOutlined, AimOutlined, FunnelPlotOutlined, ShareAltOutlined, ClockCircleOutlined, AreaChartOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ReactECharts from 'echarts-for-react';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function CompetitorPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [competitors, setCompetitors] = useState<any[]>([]);
    const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        fetchCompetitors();
    }, []);

    const fetchCompetitors = async () => {
        setLoading(true);
        const mockData = [
            { id: '1', name: '全能生活官', platform: 'xhs', followers: '52.4w', fansGrowth: '+12%', engagement: '8.5%', tags: ['家居', 'Vlog'], lastPost: '2h前' },
            { id: '2', name: '极客评测', platform: 'douyin', followers: '128.0w', fansGrowth: '+5%', engagement: '6.2%', tags: ['数码', '硬核'], lastPost: '1d前' },
            { id: '3', name: '职场指南', platform: 'bilibili', followers: '25.6w', fansGrowth: '+25%', engagement: '12.1%', tags: ['职场', '干货'], lastPost: '5h前' },
        ];
        setCompetitors(mockData);
        setLoading(false);
    };

    const handleAdd = async () => {
        await form.validateFields();
        setLoading(true);
        message.loading('AI 正在扫描账号数据...');
        setTimeout(() => {
            message.success('已成功添加监控账号');
            setIsAddModalOpen(false);
            setLoading(false);
        }, 1500);
    };

    const chartOption = {
        radar: {
            indicator: [
                { name: '内容垂直度', max: 100 },
                { name: '更新频率', max: 100 },
                { name: '互动深度', max: 100 },
                { name: '商业化潜力', max: 100 },
                { name: '爆款概率', max: 100 },
            ],
            shape: 'circle',
            splitNumber: 4,
            axisName: { color: '#94a3b8' },
        },
        series: [{
            type: 'radar',
            data: [{ value: [85, 90, 70, 60, 95], name: '能力值' }],
            itemStyle: { color: '#6366f1' },
            areaStyle: { opacity: 0.1 }
        }]
    };

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 border-b-4 border-indigo-500 inline-block pb-1">情报局 / 竞品对标</h1>
                    <p className="text-zinc-500 mt-3 text-lg">AI 深度扫描并拆解对标账号，为您生成专属的爆款复刻策略。</p>
                </div>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setIsAddModalOpen(true)} className="h-14 px-8 rounded-2xl bg-indigo-600 font-bold border-none shadow-lg">添加监控账号</Button>
            </header>

            <Row gutter={[24, 24]}>
                <Col span={24} lg={18}>
                    <Card className="rounded-[32px] border-none shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
                        <Table
                            dataSource={competitors}
                            pagination={false}
                            className="competitor-table"
                            columns={[
                                {
                                    title: '监控目标',
                                    dataIndex: 'name',
                                    render: (text, record) => (
                                        <div className="flex items-center gap-4 py-2">
                                            <Avatar size={48} className="bg-gradient-to-br from-indigo-500 to-purple-500 font-bold">{text[0]}</Avatar>
                                            <div>
                                                <div className="font-black text-zinc-800 text-base">{text}</div>
                                                <div className="flex gap-1 mt-1">
                                                    {record.tags.map((t: string) => <Tag key={t} className="m-0 text-[10px] bg-zinc-100 border-none rounded-md px-1">{t}</Tag>)}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                },
                                {
                                    title: '核心数据',
                                    render: (_, record) => (
                                        <div className="flex gap-8">
                                            <Statistic title="粉丝量" value={record.followers} valueStyle={{ fontSize: 16, fontWeight: 900 }} />
                                            <Statistic title="互动率" value={record.engagement} valueStyle={{ fontSize: 16, fontWeight: 900, color: '#10b981' }} />
                                            <Statistic title="增速" value={record.fansGrowth} valueStyle={{ fontSize: 16, fontWeight: 900, color: '#6366f1' }} />
                                        </div>
                                    )
                                },
                                {
                                    title: '最后动态',
                                    dataIndex: 'lastPost',
                                    render: (v) => <Text className="text-xs text-zinc-400 font-bold"><ClockCircleOutlined /> {v}</Text>
                                },
                                {
                                    title: '操作',
                                    className: 'text-right',
                                    render: (_, record) => (
                                        <Space>
                                            <Button shape="circle" icon={<AimOutlined />} onClick={() => setSelectedCompetitor(record)} />
                                            <Button shape="circle" icon={<RocketOutlined />} className="bg-zinc-900 text-white border-none" />
                                        </Space>
                                    )
                                }
                            ]}
                        />
                    </Card>
                </Col>

                <Col span={24} lg={6} className="space-y-6">
                    <Card title="📈 行业爆款雷达" className="rounded-3xl border-none shadow-sm">
                        <div className="h-64 mt-4">
                            <ReactECharts option={chartOption} style={{ height: '100%' }} />
                        </div>
                    </Card>
                </Col>
            </Row>

            <Modal title={null} open={!!selectedCompetitor} footer={null} onCancel={() => setSelectedCompetitor(null)} width={800} centered>
                {selectedCompetitor && (
                    <div className="space-y-8 p-4">
                        <div className="flex items-center gap-6">
                            <Avatar size={70} className="bg-indigo-600 font-black">{selectedCompetitor.name[0]}</Avatar>
                            <div>
                                <h2 className="text-2xl font-black mb-1">{selectedCompetitor.name} 账号画像</h2>
                                <p className="text-zinc-400">目前加权排名：<span className="text-indigo-600 font-bold">TOP 5%</span></p>
                            </div>
                        </div>
                        <Divider />
                        <Title level={4}><FunnelPlotOutlined /> 核心爆款逻辑</Title>
                        <Paragraph className="text-zinc-600">该账号擅长通过「视觉反差」引导点击，前3秒留存率极高。建议复刻其选题模型并加入个人化特色。</Paragraph>
                        <Button type="primary" block size="large" className="h-14 rounded-xl bg-indigo-600 font-bold" onClick={() => router.push('/create')}>立即生成同款</Button>
                    </div>
                )}
            </Modal>

            <Modal title="监控新账号" open={isAddModalOpen} onCancel={() => setIsAddModalOpen(false)} onOk={handleAdd} width={500} centered>
                <Form form={form} layout="vertical" className="mt-8">
                    <Form.Item name="url" label="账号主页链接" rules={[{ required: true }]}><Input size="large" placeholder="粘贴对标账号 URL..." className="rounded-xl" /></Form.Item>
                    <Alert type="info" message="AI 将会自动分析该内容的频率与粉丝偏好。" showIcon />
                </Form>
            </Modal>
        </div>
    );
}
