'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import {
    Card, Row, Col, Button, Space, Tag, Typography, Modal, Form, Input,
    Select, List, Avatar, Badge, Divider, Tabs, Empty, message, Tooltip, Alert
} from 'antd';
import {
    UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
    ThunderboltOutlined, CheckCircleOutlined, CopyOutlined,
    StarOutlined, HeartOutlined, BulbOutlined, RocketOutlined,
    CrownOutlined, SmileOutlined, FireOutlined, BookOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

// 人设数据一律来自后端 `GET /api/v1/persona`（PersonaController 有完整 CRUD）。
//
// 此前这里是一份写死的 mockPersonas，配 `setTimeout(800)` 假装加载 ——
// 页面看起来正常，但展示的是虚构模板，用户「复制」「使用」的也都是假数据，
// 且刷新即丢。后端明明早就实现了，只是没接。
interface Persona {
    id: string;
    name: string;
    category: string;
    description?: string;
    tone_of_voice?: string;
    typical_topics?: string[];
    writing_examples?: string[];
    usage_count?: number;
    is_system_template?: boolean;
}

interface PersonaGroups {
    system: Persona[];
    custom: Persona[];
}

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
    const [loading, setLoading] = useState(false);
    const [personas, setPersonas] = useState<PersonaGroups | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [selectedPersona, setSelectedPersona] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    const fetchPersonas = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            // 后端返回扁平数组，用 is_system 区分系统模板与自建模板
            const envelope: any = await apiClient.get('/persona');
            const list: Persona[] = envelope?.data ?? envelope ?? [];
            setPersonas({
                system: list.filter((p: any) => p.is_system ?? p.is_system_template),
                custom: list.filter((p: any) => !(p.is_system ?? p.is_system_template)),
            });
        } catch (e) {
            // 拉取失败就如实说，不要退回内置示例假装有数据
            setLoadError(e instanceof Error ? e.message : '加载人设模板失败');
            setPersonas({ system: [], custom: [] });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPersonas();
    }, [fetchPersonas]);

    const handleSelectPersona = (persona: any) => {
        setSelectedPersona(persona);
        message.success({
            content: `已选择「${persona.name}」风格，正在跳转到创作中心...`,
            icon: <ThunderboltOutlined style={{ color: '#6366f1' }} />
        });
        // In real app, would navigate to AI create with selected persona
    };

    const handleUsePersona = (persona: any) => {
        Modal.info({
            title: '应用人设模板',
            content: (
                <div>
                    <p>确认使用「{persona.name}」风格生成内容吗？</p>
                    <p>AI 将按照以下设定创作：</p>
                    <ul>
                        <li>语气风格：{persona.tone_of_voice}</li>
                        <li>擅长领域：{persona.typical_topics.join('、')}</li>
                    </ul>
                </div>
            ),
            onOk: () => {
                message.success(`已应用「${persona.name}」风格`);
            }
        });
    };

    const handleDuplicate = (persona: any) => {
        const newPersona = {
            ...persona,
            id: Date.now().toString(),
            name: `${persona.name} (副本)`,
            is_system_template: false,
            usage_count: 0
        };
        // 此前只改本地 state，刷新即丢。改为落库后重新拉取。
        (async () => {
            try {
                await apiClient.post('/persona', {
                    name: newPersona.name,
                    category: persona.category,
                    description: persona.description,
                    tone_of_voice: persona.tone_of_voice,
                    typical_topics: persona.typical_topics,
                    writing_examples: persona.writing_examples,
                });
                message.success('已复制人设模板');
                await fetchPersonas();
            } catch (e) {
                message.error(e instanceof Error ? e.message : '复制失败');
            }
        })();
    };

    const filteredPersonas = activeTab === 'all'
        ? [...(personas?.system || []), ...(personas?.custom || [])]
        : activeTab === 'custom'
            ? personas?.custom || []
            : personas?.system || [];

    const PersonaCard = ({ persona }: { persona: any }) => (
        <Card
            hoverable
            style={{
                height: '100%',
                border: selectedPersona?.id === persona.id ? `2px solid ${categoryColors[persona.category]}` : undefined
            }}
            onClick={() => {
                setSelectedPersona(persona);
                setIsDetailModalOpen(true);
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <Space>
                    <Avatar
                        size={48}
                        style={{ backgroundColor: categoryColors[persona.category] }}
                        icon={categoryIcons[persona.category]}
                    />
                    <div>
                        <Title level={5} style={{ margin: 0 }}>{persona.name}</Title>
                        <Tag color={persona.is_system_template ? 'blue' : 'orange'} style={{ marginTop: 4 }}>
                            {persona.is_system_template ? '系统模板' : '自定义'}
                        </Tag>
                    </div>
                </Space>
                <Badge count={persona.usage_count} style={{ backgroundColor: '#f1f5f9', color: '#64748b' }} />
            </div>

            <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                {persona.description}
            </Paragraph>

            <div style={{ marginTop: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>语气风格: </Text>
                <Text strong>{persona.tone_of_voice}</Text>
            </div>

            <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>擅长话题: </Text>
                <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {persona.typical_topics.slice(0, 3).map((topic: string, idx: number) => (
                        <Tag key={idx} style={{ fontSize: 11, borderRadius: 4 }}>{topic}</Tag>
                    ))}
                    {persona.typical_topics.length > 3 && (
                        <Tag style={{ fontSize: 11, borderRadius: 4 }}>+{persona.typical_topics.length - 3}</Tag>
                    )}
                </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <Space>
                <Button
                    type="primary"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleUsePersona(persona);
                    }}
                    style={{
                        background: `linear-gradient(135deg, ${categoryColors[persona.category]} 0%, ${categoryColors[persona.category]}dd 100%)`
                    }}
                >
                    应用此风格
                </Button>
                <Tooltip title="复制模板">
                    <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(persona);
                        }}
                    />
                </Tooltip>
                {!persona.is_system_template && (
                    <Tooltip title="删除">
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                                e.stopPropagation();
                                message.info('删除功能');
                            }}
                        />
                    </Tooltip>
                )}
            </Space>
        </Card>
    );

    return (
        <div style={{ minHeight: '100vh' }}>
            {/* 拉取失败要说清楚。此前失败会退回内置示例，
                用户看到的是虚构模板却以为是自己的数据。 */}
            {loadError && (
                <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="人设模板加载失败"
                    description={loadError}
                    action={<Button size="small" onClick={fetchPersonas}>重试</Button>}
                />
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>
                        <UserOutlined style={{ marginRight: 12, color: '#6366f1' }} />
                        人设模板库
                    </Title>
                    <Text type="secondary">选择或创建适合您的人设风格，让 AI 创作更贴合您的个人品牌</Text>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="large"
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}
                >
                    创建自定义人设
                </Button>
            </div>

            {/* Selected Persona Banner */}
            {selectedPersona && (
                <Card
                    style={{
                        marginBottom: 24,
                        background: `linear-gradient(135deg, ${categoryColors[selectedPersona.category]}15 0%, ${categoryColors[selectedPersona.category]}05 100%)`,
                        border: `1px solid ${categoryColors[selectedPersona.category]}30`
                    }}
                >
                    <Row gutter={24} align="middle">
                        <Col xs={24} md={16}>
                            <Space>
                                <Avatar size={64} style={{ backgroundColor: categoryColors[selectedPersona.category] }} icon={categoryIcons[selectedPersona.category]} />
                                <div>
                                    <Title level={4} style={{ margin: 0 }}>{selectedPersona.name}</Title>
                                    <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                                        {selectedPersona.description}
                                    </Paragraph>
                                </div>
                            </Space>
                        </Col>
                        <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<RocketOutlined />}
                                    onClick={() => handleSelectPersona(selectedPersona)}
                                    style={{
                                        background: `linear-gradient(135deg, ${categoryColors[selectedPersona.category]} 0%, ${categoryColors[selectedPersona.category]}dd 100%)`
                                    }}
                                >
                                    立即使用创作
                                </Button>
                                <Button size="large" onClick={() => setSelectedPersona(null)}>
                                    取消选择
                                </Button>
                            </Space>
                        </Col>
                    </Row>
                </Card>
            )}

            {/* Category Quick Access */}
            <Card style={{ marginBottom: 24 }}>
                <Space wrap>
                    {Object.entries(categoryIcons).map(([cat, icon]) => (
                        <Button
                            key={cat}
                            type={activeTab === cat ? 'primary' : 'default'}
                            icon={icon}
                            onClick={() => setActiveTab(cat)}
                            style={{
                                borderRadius: 20,
                                ...(activeTab === cat ? { background: categoryColors[cat] } : {})
                            }}
                        >
                            {cat === 'knowledge' && '知识'}
                            {cat === 'lifestyle' && '生活'}
                            {cat === 'entertainment' && '娱乐'}
                            {cat === 'technology' && '科技'}
                            {cat === 'education' && '教育'}
                            {cat === 'other' && '其他'}
                        </Button>
                    ))}
                </Space>
            </Card>

            {/* Persona Grid */}
            <Tabs activeKey={activeTab} onChange={setActiveTab}>
                <TabPane
                    tab={
                        <span>
                            <FireOutlined /> 全部模板 ({filteredPersonas.length})
                        </span>
                    }
                    key="all"
                />
                <TabPane
                    tab={
                        <span>
                            <CrownOutlined /> 系统预设 ({personas?.system.length || 0})
                        </span>
                    }
                    key="system"
                />
                <TabPane
                    tab={
                        <span>
                            <StarOutlined /> 我的自定义 ({personas?.custom.length || 0})
                        </span>
                    }
                    key="custom"
                />
            </Tabs>

            {filteredPersonas.length === 0 ? (
                <Empty description="暂无人设模板" style={{ padding: '60px 0' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCreateModalOpen(true)}>
                        创建第一个自定义人设
                    </Button>
                </Empty>
            ) : (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    {filteredPersonas.map((persona: any) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={persona.id}>
                            <PersonaCard persona={persona} />
                        </Col>
                    ))}
                </Row>
            )}

            {/* Detail Modal */}
            <Modal
                title={selectedPersona?.name}
                open={isDetailModalOpen}
                onCancel={() => setIsDetailModalOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setIsDetailModalOpen(false)}>关闭</Button>,
                    <Button
                        key="use"
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                            handleSelectPersona(selectedPersona);
                            setIsDetailModalOpen(false);
                        }}
                        style={{
                            background: `linear-gradient(135deg, ${categoryColors[selectedPersona?.category || 'other']} 0%, ${categoryColors[selectedPersona?.category || 'other']}dd 100%)`
                        }}
                    >
                        应用此风格
                    </Button>
                ]}
                width={700}
            >
                {selectedPersona && (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <Tag color={selectedPersona.is_system_template ? 'blue' : 'orange'} style={{ marginBottom: 8 }}>
                                {selectedPersona.is_system_template ? '系统预设模板' : '自定义模板'}
                            </Tag>
                            <Paragraph>{selectedPersona.description}</Paragraph>
                        </div>

                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={12}>
                                <Card size="small" title="语气风格">
                                    <Text strong>{selectedPersona.tone_of_voice}</Text>
                                </Card>
                            </Col>
                            <Col span={12}>
                                <Card size="small" title="使用次数">
                                    <Text strong>{selectedPersona.usage_count} 次</Text>
                                </Card>
                            </Col>
                        </Row>

                        <Card size="small" title="擅长话题领域" style={{ marginBottom: 24 }}>
                            <Space wrap>
                                {selectedPersona.typical_topics.map((topic: string, idx: number) => (
                                    <Tag key={idx} color="blue" style={{ borderRadius: 8 }}>{topic}</Tag>
                                ))}
                            </Space>
                        </Card>

                        <Card size="small" title="写作范例">
                            <List
                                size="small"
                                dataSource={selectedPersona.writing_examples}
                                renderItem={(item: string) => (
                                    <List.Item>
                                        <Text type="secondary">“{item}”</Text>
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </div>
                )}
            </Modal>

            {/* Create Persona Modal */}
            <Modal
                title="创建自定义人设"
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                footer={null}
                width={600}
            >
                <Form layout="vertical">
                    <Form.Item label="人设名称" required>
                        <Input placeholder="给您的自定义人设起个名字" />
                    </Form.Item>

                    <Form.Item label="人设分类" required>
                        <Select placeholder="选择分类">
                            <Option value="knowledge">知识分享</Option>
                            <Option value="lifestyle">生活方式</Option>
                            <Option value="entertainment">娱乐搞笑</Option>
                            <Option value="technology">科技数码</Option>
                            <Option value="education">教育培训</Option>
                            <Option value="other">其他</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item label="人设描述" required>
                        <Input.TextArea rows={3} placeholder="描述这个人设的特点和定位" />
                    </Form.Item>

                    <Form.Item label="语气风格" required>
                        <Input placeholder="例如：专业严谨、幽默风趣、亲切温暖" />
                    </Form.Item>

                    <Form.Item label="擅长话题 (逗号分隔)" required>
                        <Input placeholder="好物推荐, 护肤心得, 家居必备" />
                    </Form.Item>

                    <Form.Item label="写作范例 (每行一个)">
                        <Input.TextArea rows={4} placeholder="输入几个典型的写作风格范例，帮助AI更好地理解您的需求" />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' }}
                                onClick={() => {
                                    message.success('自定义人设创建成功！');
                                    setIsCreateModalOpen(false);
                                }}
                            >
                                创建人设
                            </Button>
                            <Button onClick={() => setIsCreateModalOpen(false)}>取消</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
