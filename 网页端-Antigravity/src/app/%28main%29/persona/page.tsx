'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Space, Tag, Typography, Modal, Form, Input, Select, List, Avatar, Badge, Divider, Tabs, Empty, message, Tooltip } from 'antd';
import { UserOutlined, PlusOutlined, DeleteOutlined, ThunderboltOutlined, CopyOutlined, StarOutlined, HeartOutlined, BulbOutlined, RocketOutlined, CrownOutlined, SmileOutlined, FireOutlined, BookOutlined, LoadingOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const categoryIcons: Record<string, React.ReactNode> = {
    knowledge: <BookOutlined style={{ color: '#6366f1' }} />,
    lifestyle: <HeartOutlined style={{ color: '#ec4899' }} />,
    entertainment: <SmileOutlined style={{ color: '#f59e0b' }} />,
    technology: <BulbOutlined style={{ color: '#3b82f6' }} />,
    education: <CrownOutlined style={{ color: '#10b981' }} />,
    other: <UserOutlined style={{ color: '#6b7280' }} />,
};

const categoryColors: Record<string, string> = {
    knowledge: '#6366f1',
    lifestyle: '#ec4899',
    entertainment: '#f59e0b',
    technology: '#3b82f6',
    education: '#10b981',
    other: '#6b7280',
};

export default function PersonaPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [personas, setPersonas] = useState<any[]>([]);
    const [selectedPersona, setSelectedPersona] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [form] = Form.useForm();

    useEffect(() => {
        fetchPersonas();
    }, []);

    const fetchPersonas = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get<any>('/persona');
            if (res.success && res.data && res.data.length > 0) {
                setPersonas(res.data);
            } else {
                throw new Error('No data');
            }
        } catch (error) {
            console.log('Using fallback personas due to API error');
            const fallbacks = [
                {
                    id: 'p1',
                    name: '极简生活博主',
                    description: '专注于高效率、极简主义生活方式的分享者。语气清冷而理性，注重品质。',
                    category: 'lifestyle',
                    tone_of_voice: '简约、深邃、高级',
                    typical_topics: ['桌搭', '数码', '生活方式'],
                    writing_examples: ['极简不是空无一物，而是恰到好处。'],
                    is_system: true,
                    usage_count: 1240
                },
                {
                    id: 'p2',
                    name: '科技深度测评官',
                    description: '对硬核科技产品有深度见解的极客。参数导向，逻辑严密，公平客观。',
                    category: 'technology',
                    tone_of_voice: '专业、硬核、理性',
                    typical_topics: ['手机', '计算器', 'AI芯片'],
                    writing_examples: ['今天我们不谈参数，谈谈实际体验。'],
                    is_system: true,
                    usage_count: 856
                },
                {
                    id: 'p3',
                    name: '情感共鸣创作者',
                    description: '擅长捕捉生活细微情感，治愈系文字，容易引起粉丝共鸣和转发。',
                    category: 'lifestyle',
                    tone_of_voice: '温暖、治愈、感性',
                    typical_topics: ['情感', '职场故事', '夜读'],
                    writing_examples: ['总有一个瞬间，让你觉得人间值得。'],
                    is_system: true,
                    usage_count: 2100
                }
            ];
            setPersonas(fallbacks);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyPersona = (persona: any) => {
        localStorage.setItem('selected_persona', JSON.stringify(persona));
        message.success({
            content: `已应用「${persona.name}」风格，即将跳转...`,
            icon: <ThunderboltOutlined style={{ color: '#6366f1' }} />
        });
        setTimeout(() => router.push('/create'), 1000);
    };

    const handleCreate = async (values: any) => {
        setLoading(true);
        try {
            const res = await apiClient.post<any>('/persona', {
                ...values,
                typical_topics: values.typical_topics.split(',').map((s: string) => s.trim()),
                writing_examples: values.writing_examples.split('\n').filter((s: string) => s.trim()),
            });
            if (res.success) {
                message.success('自定义人设创建成功');
                setIsCreateModalOpen(false);
                form.resetFields();
                fetchPersonas();
            }
        } catch (e) {
            message.error('创建失败');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await apiClient.delete(`/persona/${id}`);
            message.success('已删除自定义人设');
            fetchPersonas();
        } catch (e) {
            message.error('删除失败');
        }
    };

    const filteredList = personas.filter(p => {
        if (activeTab === 'all') return true;
        if (activeTab === 'system') return p.is_system;
        if (activeTab === 'custom') return !p.is_system;
        return p.category === activeTab;
    });

    return (
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-zinc-900 p-10 rounded-[32px] text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <h1 className="text-3xl md:text-4xl font-black mb-3">人设风格库 <UserOutlined className="text-indigo-400" /></h1>
                        <p className="text-zinc-400 text-lg">定义您的品牌形象，让 AI 创作更懂您的语气和风格。</p>
                    </motion.div>
                </div>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)} className="relative z-10 h-14 px-8 rounded-2xl font-bold bg-indigo-600 border-none shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all">创建自定义人设</Button>
            </div>

            {/* Main Tabs */}
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                className="premium-tabs"
                items={[
                    { key: 'all', label: '全部风格', icon: <FireOutlined /> },
                    { key: 'system', label: '官方预设', icon: <CrownOutlined /> },
                    { key: 'custom', label: '我的自定义', icon: <StarOutlined /> },
                ]}
            />

            {/* Grid */}
            {loading ? <div className="py-20 text-center"><LoadingOutlined className="text-4xl text-indigo-500" /></div> :
                filteredList.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredList.map((p, idx) => (
                            <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}>
                                <Card
                                    hoverable
                                    className="h-full rounded-3xl border-none shadow-sm group hover:shadow-xl transition-all"
                                    onClick={() => { setSelectedPersona(p); setIsDetailModalOpen(true); }}
                                    styles={{ body: { padding: '24px' } }}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <Avatar size={56} style={{ backgroundColor: categoryColors[p.category] || '#6366f1' }} icon={categoryIcons[p.category]} className="shadow-lg group-hover:scale-110 transition-transform" />
                                        <Tag color={p.is_system ? 'blue' : 'orange'} className="m-0 border-none px-2 rounded-lg font-bold">{p.is_system ? 'SYSTEM' : 'CUSTOM'}</Tag>
                                    </div>
                                    <Title level={4} className="!mb-2 group-hover:text-indigo-600 transition-colors">{p.name}</Title>
                                    <Paragraph type="secondary" ellipsis={{ rows: 2 }} className="text-sm h-10 mb-4">{p.description}</Paragraph>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between text-xs">
                                            <Text type="secondary">语气风格</Text>
                                            <Text strong>{p.tone_of_voice}</Text>
                                        </div>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {p.typical_topics?.slice(0, 3).map((t: string) => (
                                                <Tag key={t} className="m-0 border-none bg-zinc-100 text-[10px] rounded-md">{t}</Tag>
                                            ))}
                                        </div>
                                    </div>

                                    <Divider className="my-4" />
                                    <div className="flex gap-2">
                                        <Button block type="primary" icon={<ThunderboltOutlined />} className="rounded-xl bg-indigo-600 font-bold h-10" onClick={(e) => { e.stopPropagation(); handleApplyPersona(p); }}>应用</Button>
                                        {!p.is_system && (
                                            <Button icon={<DeleteOutlined />} danger className="rounded-xl h-10" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} />
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                ) : <Empty description="暂无该类别的人设模板" className="py-20" />}

            {/* Detail Modal */}
            <Modal title={null} open={isDetailModalOpen} onCancel={() => setIsDetailModalOpen(false)} footer={null} width={700} centered className="rounded-[40px] overflow-hidden">
                {selectedPersona && (
                    <div className="p-4 space-y-8">
                        <header className="flex items-center gap-6">
                            <Avatar size={80} style={{ backgroundColor: categoryColors[selectedPersona.category] }} icon={categoryIcons[selectedPersona.category]} className="ring-8 ring-indigo-50" />
                            <div>
                                <h2 className="text-2xl font-black">{selectedPersona.name}</h2>
                                <Tag color="blue" className="mt-2 border-none">累计使用 {selectedPersona.usage_count} 次</Tag>
                            </div>
                        </header>
                        <Paragraph className="text-zinc-500 text-lg leading-relaxed">{selectedPersona.description}</Paragraph>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-50 p-6 rounded-3xl">
                                <Text strong className="block text-xs text-zinc-400 uppercase tracking-widest mb-3">擅长领域</Text>
                                <Space wrap>
                                    {selectedPersona.typical_topics?.map((t: string) => <Tag key={t} className="bg-white border-zinc-200 rounded-md font-bold">{t}</Tag>)}
                                </Space>
                            </div>
                            <div className="bg-zinc-50 p-6 rounded-3xl">
                                <Text strong className="block text-xs text-zinc-400 uppercase tracking-widest mb-3">语气特征</Text>
                                <Text className="font-black text-zinc-800">{selectedPersona.tone_of_voice}</Text>
                            </div>
                        </div>

                        <div>
                            <Text strong className="block text-xs text-zinc-400 uppercase tracking-widest mb-3">写作范例</Text>
                            <List dataSource={selectedPersona.writing_examples} renderItem={(item: string) => <List.Item className="border-zinc-100 py-3 text-zinc-600 font-medium">✨ "{item}"</List.Item>} />
                        </div>

                        <Button type="primary" block size="large" className="h-16 rounded-2xl bg-indigo-600 font-black text-lg" onClick={() => handleApplyPersona(selectedPersona)}>立即按此风格创作</Button>
                    </div>
                )}
            </Modal>

            {/* Create Modal */}
            <Modal title="创建自定义风格" open={isCreateModalOpen} onCancel={() => setIsCreateModalOpen(false)} onOk={() => form.submit()} okText="立即创建" width={600} centered className="rounded-3xl">
                <Form form={form} layout="vertical" onFinish={handleCreate} className="mt-6">
                    <Form.Item name="name" label={<span className="font-bold">人设名称</span>} rules={[{ required: true }]}><Input size="large" placeholder="例如：极简生活博主" className="rounded-xl" /></Form.Item>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="category" label={<span className="font-bold">所属领域</span>} rules={[{ required: true }]}>
                                <Select size="large" className="rounded-xl">
                                    {Object.keys(categoryIcons).map(c => <Option key={c} value={c}>{c}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="tone_of_voice" label={<span className="font-bold">语气风格</span>} rules={[{ required: true }]}><Input size="large" placeholder="例如：亲切、幽默" className="rounded-xl" /></Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="description" label={<span className="font-bold">核心定位</span>} rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="描述这个人设的特点..." className="rounded-xl" /></Form.Item>
                    <Form.Item name="typical_topics" label={<span className="font-bold">擅长话题 (逗号分隔)</span>} rules={[{ required: true }]}><Input size="large" placeholder="数码测评, AI工具..." className="rounded-xl" /></Form.Item>
                    <Form.Item name="writing_examples" label={<span className="font-bold">写作范例 (换行输入)</span>}><Input.TextArea rows={4} placeholder="在此输入几个典型的句子..." className="rounded-xl" /></Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
