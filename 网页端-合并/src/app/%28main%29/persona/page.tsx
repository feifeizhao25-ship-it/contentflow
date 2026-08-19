'use client';

import React, { useState, useEffect } from 'react';
import {
    Card, Row, Col, Button, Space, Tag, Typography, Modal, Form, Input,
    Select, List, Avatar, Badge, Divider, Tabs, Empty, message, Tooltip
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

// Mock persona templates
const mockPersonas = {
    system: [
        {
            id: '1',
            name: '知识博主',
            category: 'knowledge',
            description: '专业、严谨、善于深度分析的知识分享者',
            tone_of_voice: '专业且易懂',
            typical_topics: ['干货教程', '行业洞察', '技能提升', '读书笔记'],
            writing_examples: ['今天我们来聊聊...', '很多人不知道的是...', '背后的逻辑是...'],
            usage_count: 1250,
            is_system_template: true
        },
        {
            id: '2',
            name: '种草达人',
            category: 'lifestyle',
            description: '擅长发现好物、分享生活的种草博主',
            tone_of_voice: '亲切热情',
            typical_topics: ['好物推荐', '护肤心得', '家居必备', '零食测评'],
            writing_examples: ['姐妹们！这个真的绝了！', '入手不亏系列！', '跪求你们一定要试试！'],
            usage_count: 980,
            is_system_template: true
        },
        {
            id: '3',
            name: '情感导师',
            category: 'entertainment',
            description: '洞察人心、治愈情感的情感博主',
            tone_of_voice: '温暖治愈',
            typical_topics: ['情感故事', '两性分析', '自我成长', '心理疗愈'],
            writing_examples: ['其实每个人...', '有时候我们...', '我想告诉你的是...'],
            usage_count: 756,
            is_system_template: true
        },
        {
            id: '4',
            name: '科技极客',
            category: 'technology',
            description: '热爱科技、追求前沿的数码爱好者',
            tone_of_voice: '硬核专业',
            typical_topics: ['新品测评', '数码教程', 'AI工具', '编程技术'],
            writing_examples: ['技术角度来说...', '实测数据表明...', '底层逻辑是...'],
            usage_count: 543,
            is_system_template: true
        },
        {
            id: '5',
            name: '美食探店',
            category: 'lifestyle',
            description: '热爱美食、分享美味的美食博主',
            tone_of_voice: '活泼生动',
            typical_topics: ['餐厅测评', '食谱分享', '街头美食', '烘焙教程'],
            writing_examples: ['这家店真的绝了！', '答应我一定要去吃！', '在家也能做出店的味道！'],
            usage_count: 432,
            is_system_template: true
        },
        {
            id: '6',
            name: '职场导师',
            category: 'education',
            description: '职场经验分享、职业规划指导',
            tone_of_voice: '专业务实',
            typical_topics: ['职场干货', '面试技巧', '升职加薪', '领导力'],
            writing_examples: ['职场中...', '很多人误区在于...', '正确的做法是...'],
            usage_count: 621,
            is_system_template: true
        },
    ],
    custom: [
        {
            id: '101',
            name: '我的专属风格',
            category: 'other',
            description: '适合我的个人品牌风格',
            tone_of_voice: '轻松幽默',
            typical_topics: ['日常Vlog', '好物分享', '成长记录'],
            writing_examples: ['今天又是元气满满的一天！', '来聊聊最近的小确幸~'],
            usage_count: 45,
            is_system_template: false
        }
    ]
};

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
    const [personas, setPersonas] = useState<typeof mockPersonas>(null as any);
    const [selectedPersona, setSelectedPersona] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        setLoading(true);
        setTimeout(() => {
            setPersonas(mockPersonas);
            setLoading(false);
        }, 800);
    }, []);

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
        setPersonas({
            ...personas!,
            custom: [...(personas?.custom || []), newPersona]
        });
        message.success('已复制人设模板');
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
                                        <Text type="secondary">"{item}"</Text>
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
