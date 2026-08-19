'use client';

import React, { useState } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, message, Tabs, Tooltip, Alert, Divider } from 'antd';
import {
    ApiOutlined,
    KeyOutlined,
    SafetyOutlined,
    InfoCircleOutlined,
    QuestionCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    BookOutlined,
} from '@ant-design/icons';

const { Option } = Select;

export default function APIManagementPage() {
    const [loading, setLoading] = useState(false);
    const [isKeyModalVisible, setIsKeyModalVisible] = useState(false);
    const [form] = Form.useForm();

    const apiKeys = [
        {
            id: '1',
            provider: 'SiliconFlow',
            type: 'LLM',
            key: 'sk-siliconflow-••••••••••••',
            status: 'active',
            lastUsed: '2024-03-24 10:15:22',
        },
        {
            id: '2',
            provider: 'OpenRouter',
            type: 'LLM',
            key: 'sk-openrouter-••••••••••••',
            status: 'active',
            lastUsed: '2024-03-23 15:44:10',
        },
        {
            id: '3',
            provider: 'Fal.ai',
            type: 'Image/Video',
            key: 'sk-falai-••••••••••••',
            status: 'active',
            lastUsed: '2024-03-24 09:30:15',
        },
    ];

    const platformRules = [
        {
            platform: '小红书 (Xiaohongshu)',
            icon: '📕',
            videoRules: '建议 3:4 或 9:16; 60s 以内',
            imageRules: '建议 3:4; 最多 9 张',
            textRules: '标题 < 20字; 语气亲切; 包含 Emoji',
            requirements: ['必须包含标签', '首图需极其精美', '种草语气'],
        },
        {
            platform: '抖音 (Douyin)',
            icon: '🎵',
            videoRules: '必须 9:16; 15-60s 最佳',
            imageRules: '支持图集 (9:16)',
            textRules: '标题 < 50字; 话题 3-5 个',
            requirements: ['前3秒抓人', '伴奏音乐关键', '引导点赞'],
        },
        {
            platform: '微信视频号 (Channels)',
            icon: '📹',
            videoRules: '建议 9:16; 支持 1-30min',
            imageRules: '不支持纯图; 封面 3:4 或 1:1',
            textRules: '文案建议 < 100字; 适合转发',
            requirements: ['私域流量属性', '内容生活化', '引导添加微信'],
        },
        {
            platform: '微信公众号 (WeChat)',
            icon: '💬',
            videoRules: '建议 16:9; 高质量原创',
            imageRules: '封面 2.35:1; 正文无限制',
            textRules: '标题长且信息量大; 深度长文',
            requirements: ['排版精美', '提供深度价值', '固定发布时间'],
        },
        {
            platform: '哔哩哔哩 (Bilibili)',
            icon: '📺',
            videoRules: '必须 16:9; 1080P/4K',
            imageRules: '动态支持多图; 封面吸引',
            textRules: '标题 < 80字; 逻辑严密',
            requirements: ['原创度高', '一键三连', '中长内容'],
        },
        {
            platform: '微博 (Weibo)',
            icon: '👁️',
            videoRules: '建议 16:9 或 1:1; 短快传达',
            imageRules: '九宫格模式; 长图属性',
            textRules: '字数 < 140/2000字; 热搜话题',
            requirements: ['追溯热点', '转发抽奖', '实时互动'],
        },
        {
            platform: '知乎 (Zhihu)',
            icon: '🎓',
            videoRules: '建议 16:9; 专业科普',
            imageRules: '插图辅助理解; 封面 16:9',
            textRules: '逻辑清晰; 结构化叙事',
            requirements: ['谢邀体', '专业可靠', '解决具体问题'],
        },
        {
            platform: '今日头条 (Toutiao)',
            icon: '📰',
            videoRules: '建议 16:9; 横屏短视频',
            imageRules: '三图模式封面 (3:2)',
            textRules: '标题党 (非贬义); 信息量爆表',
            requirements: ['高点击率标题', '热点新闻', '正能量'],
        },
        {
            platform: '快手 (Kuaishou)',
            icon: '🧡',
            videoRules: '必须 9:16; 接地气/生活化',
            imageRules: '图集形式 (9:16)',
            textRules: '简单直白; 兄弟家人称呼',
            requirements: ['老铁文化', '真实感', '直播导流'],
        },
        {
            platform: '百家号 (Baijiahao)',
            icon: '🦅',
            videoRules: '建议 16:9; 权重高',
            imageRules: '高清美图; 封面 3:2',
            textRules: '权威性语气; SEO 友好',
            requirements: ['独家首发', '图片清晰', '百度搜索优化'],
        },
    ];

    const apiKeyColumns = [
        {
            title: '服务商',
            dataIndex: 'provider',
            key: 'provider',
            render: (text: string) => (
                <Space>
                    <ApiOutlined />
                    <span style={{ fontWeight: 500 }}>{text}</span>
                </Space>
            ),
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => <Tag>{type}</Tag>,
        },
        {
            title: 'API Key',
            dataIndex: 'key',
            key: 'key',
            render: (key: string) => <code>{key}</code>,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'success' : 'error'} icon={status === 'active' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                    {status === 'active' ? '正' : '异常'}
                </Tag>
            ),
        },
        {
            title: '最后使用',
            dataIndex: 'lastUsed',
            key: 'lastUsed',
        },
        {
            title: '操作',
            key: 'action',
            render: () => (
                <Space size="middle">
                    <Button type="link" size="small">重置</Button>
                    <Button type="link" size="small" danger>删除</Button>
                </Space>
            ),
        },
    ];

    const tabItems = [
        {
            key: 'aiservices',
            label: (
                <span>
                    <KeyOutlined /> AI 服务端点
                </span>
            ),
            children: (
                <div>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>管理连接到 AI 创作中心的服务商 API</span>
                        <Button type="primary" icon={<ApiOutlined />} onClick={() => setIsKeyModalVisible(true)}>
                            添加 API Key
                        </Button>
                    </div>
                    <Alert
                        message="安全提示"
                        description="您的 API Key 会经过加密处理后存储。请勿将 Key 泄露给他人。本系统支持使用自有 Key (BYOK) 以获得更稳定的生成体验。"
                        type="info"
                        showIcon
                        style={{ marginBottom: 24 }}
                    />
                    <Table columns={apiKeyColumns} dataSource={apiKeys} rowKey="id" pagination={false} />
                </div>
            ),
        },
        {
            key: 'rules',
            label: (
                <span>
                    <BookOutlined /> 平台分发规则
                </span>
            ),
            children: (
                <div>
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ marginBottom: 8 }}>分发规则参考</h3>
                        <p style={{ color: '#6b7280' }}>各平台对内容、视频参数和文字长度有不同限制，AI 创作中心会自动应用这些规则。</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
                        {platformRules.map((rule, index) => (
                            <Card
                                key={index}
                                title={<Space><span style={{ fontSize: 20 }}>{rule.icon}</span> {rule.platform}</Space>}
                                hoverable
                            >
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div>
                                        <Tag color="blue">视频</Tag>
                                        <span style={{ fontSize: 13 }}>{rule.videoRules}</span>
                                    </div>
                                    <div>
                                        <Tag color="cyan">图片</Tag>
                                        <span style={{ fontSize: 13 }}>{rule.imageRules}</span>
                                    </div>
                                    <div>
                                        <Tag color="purple">文本</Tag>
                                        <span style={{ fontSize: 13 }}>{rule.textRules}</span>
                                    </div>
                                    <Divider style={{ margin: '12px 0' }} />
                                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>核心要求：</div>
                                    <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: '#4b5563' }}>
                                        {rule.requirements.map((req, i) => (
                                            <li key={i} style={{ marginBottom: 4 }}>{req}</li>
                                        ))}
                                    </ul>
                                </Space>
                            </Card>
                        ))}
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>API 管理</h1>
                <p style={{ color: '#6b7280', marginTop: 4 }}>配置外部 AI 服务和查看各平台分发规则</p>
            </div>

            <Card styles={{ body: { padding: '24px' } }}>
                <Tabs items={tabItems} />
            </Card>

            <Modal
                title="添加 API Key"
                open={isKeyModalVisible}
                onCancel={() => setIsKeyModalVisible(false)}
                footer={null}
            >
                <Form layout="vertical">
                    <Form.Item label="服务提供商" name="provider" rules={[{ required: true }]}>
                        <Select placeholder="选择服务商">
                            <Select.Option value="siliconflow">SiliconFlow (硅基流动)</Select.Option>
                            <Select.Option value="openrouter">OpenRouter</Select.Option>
                            <Select.Option value="falai">Fal.ai</Select.Option>
                            <Select.Option value="custom">自定义 Endpoint</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="API Key" name="key" rules={[{ required: true }]}>
                        <Input.Password placeholder="输入您的 sk-..." />
                    </Form.Item>
                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setIsKeyModalVisible(false)}>取消</Button>
                            <Button type="primary">保存配置</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
