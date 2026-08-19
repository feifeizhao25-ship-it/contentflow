'use client';

import React, { useState, useEffect } from 'react';
import {
    Button,
    Card,
    Input,
    Table,
    Tag,
    Tabs,
    message,
    Typography,
    Space,
    Tooltip,
    Modal,
    Statistic,
    Empty
} from 'antd';
import {
    Key,
    Plus,
    Copy,
    Terminal,
    Activity,
    Code,
    ShieldCheck,
    Trash2,
    ExternalLink,
    BookOpen,
    Zap,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api-client';

const { Title, Text, Paragraph } = Typography;

interface ApiKey {
    id: string;
    name: string;
    key?: string;
    created_at: string;
    last_used_at: string | null;
    status: 'active' | 'revoked';
}

export default function DeveloperSettings() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [isNewKeyModalVisible, setIsNewKeyModalVisible] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    // Mock data for initial view
    useEffect(() => {
        setKeys([
            { id: '1', name: '生产环境 - 自媒体助手', created_at: '2024-01-20', last_used_at: '2024-02-04 10:20:15', status: 'active' },
            { id: '2', name: '测试环境', created_at: '2024-01-15', last_used_at: null, status: 'active' },
        ]);
    }, []);

    const handleCreateKey = () => {
        if (!newKeyName.trim()) {
            message.error('请先输入 Key 名称');
            return;
        }

        // Simulate API call
        const mockKey = `sk_ff_${Math.random().toString(36).substring(7)}${Math.random().toString(36).substring(7)}`;
        setCreatedKey(mockKey);

        // In real app, we'd send newKeyName to backend
        // apiClient.post('/developer/keys', { name: newKeyName })
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('已复制到剪贴板');
    };

    const columns = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'success' : 'default'} className="rounded-full px-3">
                    {status === 'active' ? '运行中' : '已撤销'}
                </Tag>
            ),
        },
        {
            title: '最后使用日期',
            dataIndex: 'last_used_at',
            key: 'last_used_at',
            render: (date: string | null) => (
                <div className="flex items-center gap-2 text-zinc-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs">{date || '从未'}</span>
                </div>
            ),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: ApiKey) => (
                <Space size="middle">
                    <Tooltip title="复制 ID">
                        <Button type="text" icon={<Copy className="w-4 h-4" />} onClick={() => copyToClipboard(record.id)} />
                    </Tooltip>
                    <Tooltip title="撤销 Key">
                        <Button type="text" danger icon={<Trash2 className="w-4 h-4" />} />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-10 min-h-screen">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-end justify-between gap-6"
            >
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider border border-blue-100">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Developer Center</span>
                    </div>
                    <Title level={1} className="font-serif !mb-0 tracking-tight">
                        开放平台 <span className="text-zinc-400 font-light italic">Integration</span>
                    </Title>
                    <Paragraph className="text-zinc-500 text-base max-w-xl mb-0">
                        集成 Fenfaxia ContentFlow 的核心 AI 能力到您的自有系统或工作流中。
                    </Paragraph>
                </div>
                <div className="flex gap-3">
                    <Button icon={<BookOpen className="w-4 h-4" />} size="large" className="rounded-xl">阅读文档</Button>
                    <Button
                        type="primary"
                        size="large"
                        className="bg-[#1f4d4f] border-none rounded-xl px-6"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => {
                            setCreatedKey(null);
                            setNewKeyName('');
                            setIsNewKeyModalVisible(true);
                        }}
                    >
                        创建 API Key
                    </Button>
                </div>
            </motion.div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { title: '本月请求数', value: '12,840', suffix: '', icon: <Activity className="text-blue-500" /> },
                    { title: '接口成功率', value: '99.9', suffix: '%', icon: <CheckCircle2 className="text-emerald-500" /> },
                    { title: '当前并发限额', value: '20', suffix: 'QPS', icon: <Zap className="text-amber-500" /> },
                    { title: '剩余免费额度', value: '1,500', suffix: '次', icon: <Terminal className="text-zinc-400" /> },
                ].map((stat, i) => (
                    <Card key={i} className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all">
                        <Statistic
                            title={<span className="flex items-center gap-2 text-zinc-400 font-medium">{stat.icon} {stat.title}</span>}
                            value={stat.value}
                            suffix={<span className="text-zinc-400 text-sm font-normal ml-1">{stat.suffix}</span>}
                            valueStyle={{ fontWeight: 700, fontFamily: 'serif' }}
                        />
                    </Card>
                ))}
            </div>

            {/* Main Content Tabs */}
            <Card className="rounded-[28px] border-none shadow-lg shadow-zinc-200/50 p-6 md:p-10">
                <Tabs
                    defaultActiveKey="keys"
                    size="large"
                    className="studio-tabs"
                    items={[
                        {
                            key: 'keys',
                            label: (
                                <span className="flex items-center gap-2">
                                    <Key className="w-4 h-4" /> API Keys
                                </span>
                            ),
                            children: (
                                <div className="pt-6">
                                    <div className="mb-6 flex justify-between items-center">
                                        <Text type="secondary">API 密钥用于验证您的应用程序向 Fenfa AI 发出的请求。请勿在客户端代码中泄露。</Text>
                                    </div>
                                    <Table
                                        columns={columns}
                                        dataSource={keys}
                                        pagination={false}
                                        rowKey="id"
                                        className="custom-table"
                                    />
                                    <div className="mt-8 p-6 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 text-center">
                                        <Text type="secondary" text-xs>如果您怀疑某个密钥已泄露，请立即在该页面点击“撤销”并生成新密钥。</Text>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'playground',
                            label: (
                                <span className="flex items-center gap-2">
                                    <Code className="w-4 h-4" /> Playground
                                </span>
                            ),
                            children: (
                                <div className="pt-6">
                                    <div className="grid lg:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div>
                                                <Text strong className="block mb-2 text-xs uppercase tracking-widest text-zinc-400">Endpoint Selector</Text>
                                                <Input
                                                    addonBefore={<span className="px-2 font-bold text-emerald-600">POST</span>}
                                                    value="v1/content-pack/generate"
                                                    className="rounded-xl overflow-hidden h-12"
                                                    readOnly
                                                />
                                            </div>
                                            <div>
                                                <Text strong className="block mb-2 text-xs uppercase tracking-widest text-zinc-400">Request Body (JSON)</Text>
                                                <TextArea
                                                    rows={8}
                                                    className="font-mono text-sm bg-zinc-900 text-emerald-400 rounded-2xl p-6"
                                                    defaultValue={JSON.stringify({
                                                        topic: "2024年最值得入手的3款数码单品",
                                                        style: "xhs_influencer",
                                                        generate_visual: true
                                                    }, null, 2)}
                                                />
                                            </div>
                                            <Button type="primary" size="large" block className="h-14 rounded-2xl bg-zinc-900 border-none font-bold">运行测试请求</Button>
                                        </div>
                                        <div className="space-y-6 flex flex-col">
                                            <Text strong className="block text-xs uppercase tracking-widest text-zinc-400">Response Header</Text>
                                            <div className="flex-1 rounded-2xl bg-zinc-800 border-zinc-700 p-6 overflow-hidden">
                                                <Empty description={<span className="text-zinc-500">点击运行以查看实时响应数据</span>} className="mt-20" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'docs',
                            label: (
                                <span className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" /> 文档速查
                                </span>
                            ),
                            children: (
                                <div className="pt-10 max-w-3xl mx-auto space-y-10 pb-10">
                                    <div className="space-y-4">
                                        <Text strong className="text-xl">快速开始</Text>
                                        <Paragraph className="text-zinc-600">
                                            每个 API 请求都必须在 HTTP 标头中包含您的密钥，格式如下：
                                        </Paragraph>
                                        <div className="p-6 bg-zinc-900 rounded-2xl text-white font-mono text-sm relative group">
                                            <button
                                                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all p-2 bg-white/10 rounded-lg hover:bg-white/20"
                                                onClick={() => copyToClipboard('Authorization: Bearer YOUR_API_KEY')}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <code className="text-emerald-400">Authorization:</code> Bearer <span className="text-amber-400">YOUR_API_KEY</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <Text strong className="text-xl">常用端点</Text>
                                        <div className="space-y-3">
                                            {[
                                                { method: 'POST', path: '/v1/ai/generate', desc: '全能内容生成接口' },
                                                { method: 'POST', path: '/v1/ai/visual', desc: 'AI 图像与创意配图' },
                                                { method: 'GET', path: '/v1/analytics/stats', desc: '获取作品实时流量数据' },
                                            ].map((api, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                                                    <div className="flex items-center gap-4">
                                                        <Tag color={api.method === 'POST' ? 'blue' : 'green'} className="m-0 font-bold">{api.method}</Tag>
                                                        <code className="text-sm">{api.path}</code>
                                                    </div>
                                                    <Text type="secondary" className="text-xs">{api.desc}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex justify-center pt-6">
                                        <Button type="link" icon={<ExternalLink className="w-4 h-4" />} className="text-zinc-500">跳转完整文档中心</Button>
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />
            </Card>

            {/* New Key Modal */}
            <Modal
                title={null}
                open={isNewKeyModalVisible}
                onCancel={() => setIsNewKeyModalVisible(false)}
                footer={null}
                centered
                className="custom-modal"
            >
                <div className="p-4 space-y-6">
                    {!createdKey ? (
                        <>
                            <div className="text-center space-y-2">
                                <Title level={4} className="font-serif !mb-0">创建新 API 密钥</Title>
                                <Text type="secondary">给您的 Key 起个名字，以便在日志中区分不同的应用。</Text>
                            </div>
                            <Input
                                size="large"
                                placeholder="名称 (例如: Telegram 机器人)"
                                className="rounded-xl h-12"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                            />
                            <Button
                                type="primary"
                                block
                                size="large"
                                className="h-12 rounded-xl bg-[#1f4d4f] border-none font-bold"
                                onClick={handleCreateKey}
                            >
                                生成密钥
                            </Button>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                                <Title level={4} className="font-serif !mb-0">已成功生成密钥</Title>
                                <Text type="warning" className="text-xs font-bold bg-amber-50 px-3 py-1 rounded-full text-amber-600 block w-fit mx-auto">
                                    请务必立即复制并安全保存，关闭后将无法再次查看原文
                                </Text>
                            </div>

                            <div className="p-4 bg-zinc-900 rounded-2xl text-white font-mono text-xs break-all relative group flex items-center justify-between gap-4">
                                <div className="flex-1">{createdKey}</div>
                                <Button
                                    ghost
                                    size="small"
                                    icon={<Copy className="w-3.5 h-3.5" />}
                                    onClick={() => copyToClipboard(createdKey)}
                                    className="border-zinc-700 text-zinc-400 hover:text-white"
                                />
                            </div>

                            <Button
                                type="primary"
                                block
                                size="large"
                                className="h-12 rounded-xl bg-zinc-900 border-none font-bold"
                                onClick={() => setIsNewKeyModalVisible(false)}
                            >
                                我已安全保存
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            <style jsx global>{`
        .studio-tabs .ant-tabs-nav::before {
          display: none;
        }
        .studio-tabs .ant-tabs-tab {
          font-weight: 500;
          color: #71717a !important;
          transition: all 0.3s;
          padding: 12px 16px !important;
        }
        .studio-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #1f4d4f !important;
          font-weight: 700;
        }
        .studio-tabs .ant-tabs-ink-bar {
          background: #1f4d4f !important;
          height: 3px !important;
          border-radius: 3px 3px 0 0;
        }
        .custom-table .ant-table {
          background: transparent;
        }
        .custom-table .ant-table-thead > tr > th {
          background: transparent !important;
          border-bottom: 2px solid #f4f4f5 !important;
          color: #a1a1aa !important;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 700;
        }
        .custom-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #f4f4f5 !important;
          padding: 20px 16px !important;
        }
        .custom-table .ant-table-row:hover > td {
          background: #fafafa !important;
        }
      `}</style>
        </div>
    );
}
