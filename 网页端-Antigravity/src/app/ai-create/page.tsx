'use client';

import React, { useState } from 'react';
import { Card, Row, Col, Button, Input, Select, Space, Tabs, message, Spin } from 'antd';
import {
    EditOutlined,
    BulbOutlined,
    FileTextOutlined,
    PictureOutlined,
    VideoCameraOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

export default function AICreatePage() {
    const [loading, setLoading] = useState(false);
    const [topic, setTopic] = useState('');
    const [style, setStyle] = useState('professional');
    const [generatedContent, setGeneratedContent] = useState('');
    const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);

    const handleGenerateArticle = async () => {
        if (!topic.trim()) {
            message.warning('请输入主题或关键词');
            return;
        }

        setLoading(true);
        // Simulate AI generation
        setTimeout(() => {
            setGeneratedContent(`# ${topic}\n\n这是一篇关于"${topic}"的AI生成文章。\n\n## 引言\n\n在当今快速发展的数字时代，${topic}已经成为了一个备受关注的话题。本文将深入探讨这个主题的各个方面。\n\n## 核心要点\n\n1. **第一个要点**：${topic}的基本概念和重要性\n2. **第二个要点**：实际应用场景和案例分析\n3. **第三个要点**：未来发展趋势和展望\n\n## 详细分析\n\n通过深入研究，我们发现${topic}在多个领域都有着广泛的应用...\n\n## 结论\n\n综上所述，${topic}不仅是当前的热点，更是未来发展的重要方向。`);
            setLoading(false);
            message.success('文章生成成功！');
        }, 2000);
    };

    const handleGenerateTitles = async () => {
        if (!topic.trim()) {
            message.warning('请输入主题或关键词');
            return;
        }

        setLoading(true);
        // Simulate AI generation
        setTimeout(() => {
            setGeneratedTitles([
                `🔥 ${topic}：你不知道的5个秘密`,
                `💡 2024最新！${topic}完整指南`,
                `⚡ 3分钟学会${topic}，效率提升10倍`,
                `🎯 ${topic}实战技巧，建议收藏！`,
                `✨ ${topic}终极攻略，小白也能轻松上手`,
                `🚀 ${topic}的正确打开方式，99%的人都不知道`,
                `💪 ${topic}从入门到精通，这一篇就够了`,
                `🌟 ${topic}避坑指南，帮你省下90%的时间`,
                `📈 ${topic}最佳实践，亲测有效！`,
                `🎁 ${topic}保姆级教程，建议收藏转发`,
            ]);
            setLoading(false);
            message.success('标题生成成功！');
        }, 1500);
    };

    const tabItems = [
        {
            key: 'article',
            label: (
                <span>
                    <FileTextOutlined /> 文章生成
                </span>
            ),
            children: (
                <div>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                                主题/关键词
                            </label>
                            <Input
                                size="large"
                                placeholder="例如：AI内容创作、自媒体运营技巧..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                prefix={<BulbOutlined />}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                                写作风格
                            </label>
                            <Select
                                size="large"
                                style={{ width: '100%' }}
                                value={style}
                                onChange={setStyle}
                            >
                                <Option value="professional">专业严谨</Option>
                                <Option value="casual">轻松活泼</Option>
                                <Option value="emotional">情感共鸣</Option>
                                <Option value="marketing">种草带货</Option>
                            </Select>
                        </div>
                        <Button
                            type="primary"
                            size="large"
                            icon={<ThunderboltOutlined />}
                            onClick={handleGenerateArticle}
                            loading={loading}
                            block
                        >
                            AI 生成文章
                        </Button>
                        {generatedContent && (
                            <Card
                                title="生成结果"
                                extra={
                                    <Button type="link" onClick={() => navigator.clipboard.writeText(generatedContent)}>
                                        复制
                                    </Button>
                                }
                            >
                                <TextArea
                                    value={generatedContent}
                                    onChange={(e) => setGeneratedContent(e.target.value)}
                                    rows={15}
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </Card>
                        )}
                    </Space>
                </div>
            ),
        },
        {
            key: 'title',
            label: (
                <span>
                    <EditOutlined /> 标题生成
                </span>
            ),
            children: (
                <div>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                                内容主题
                            </label>
                            <Input
                                size="large"
                                placeholder="输入你的内容主题..."
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                prefix={<BulbOutlined />}
                            />
                        </div>
                        <Button
                            type="primary"
                            size="large"
                            icon={<ThunderboltOutlined />}
                            onClick={handleGenerateTitles}
                            loading={loading}
                            block
                        >
                            生成爆款标题
                        </Button>
                        {generatedTitles.length > 0 && (
                            <Card title="生成的标题（点击复制）">
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {generatedTitles.map((title, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                padding: '12px 16px',
                                                background: '#f8fafc',
                                                borderRadius: 8,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                            onClick={() => {
                                                navigator.clipboard.writeText(title);
                                                message.success('已复制到剪贴板');
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#e0e7ff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = '#f8fafc';
                                            }}
                                        >
                                            {index + 1}. {title}
                                        </div>
                                    ))}
                                </Space>
                            </Card>
                        )}
                    </Space>
                </div>
            ),
        },
        {
            key: 'image',
            label: (
                <span>
                    <PictureOutlined /> 图片生成
                </span>
            ),
            children: (
                <Card>
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
                        <PictureOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                        <p style={{ fontSize: 16 }}>AI图片生成功能即将上线</p>
                        <p>敬请期待...</p>
                    </div>
                </Card>
            ),
        },
        {
            key: 'video',
            label: (
                <span>
                    <VideoCameraOutlined /> 视频生成
                </span>
            ),
            children: (
                <Card>
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
                        <VideoCameraOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                        <p style={{ fontSize: 16 }}>AI视频生成功能即将上线</p>
                        <p>敬请期待...</p>
                    </div>
                </Card>
            ),
        },
    ];

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>AI 创作中心</h1>
            <Card>
                <Tabs items={tabItems} />
            </Card>
        </div>
    );
}
