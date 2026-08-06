'use client';

import React, { useState, useEffect } from 'react';
import {
    Card, Tabs, Form, Input, Button, Avatar, Space, Tag, Select,
    Divider, message, Switch, List, InputNumber, Row, Col, Typography, Progress
} from 'antd';
import {
    UserOutlined,
    TeamOutlined,
    SafetyOutlined,
    CreditCardOutlined,
    BellOutlined,
    GlobalOutlined,
    SaveOutlined,
    CalendarOutlined,
    ClockCircleOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store/appStore';

const { Option } = Select;
const { Text, Title, Paragraph } = Typography;

export default function SettingsPage() {
    const { user, tenant } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [profileForm] = Form.useForm();
    const [tenantForm] = Form.useForm();
    const [scheduleForm] = Form.useForm();

    const platformsList = [
        { key: 'xhs', name: '小红书', icon: '📕' },
        { key: 'douyin', name: '抖音', icon: '🎵' },
        { key: 'channels', name: '视频号', icon: '📹' },
        { key: 'wechat', name: '公众号', icon: '💬' },
        { key: 'bilibili', name: 'Bilibili', icon: '📺' },
        { key: 'weibo', name: '微博', icon: '👁️' },
        { key: 'zhihu', name: '知乎', icon: '🎓' },
        { key: 'toutiao', name: '今日头条', icon: '📰' },
        { key: 'kuaishou', name: '快手', icon: '🧡' },
        { key: 'baijiahao', name: '百家号', icon: '🦅' },
    ];

    useEffect(() => {
        if (user) {
            profileForm.setFieldsValue({
                name: user.name,
                email: user.email,
            });
        }
        if (tenant) {
            tenantForm.setFieldsValue({
                tenantName: tenant.name,
                plan: tenant.plan,
            });
        }
    }, [user, tenant, profileForm, tenantForm]);

    const handleUpdateProfile = async (values: any) => {
        setLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            message.success('个人资料已更新');
        } catch (error) {
            message.error('更新失败');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSchedule = async (values: any) => {
        setLoading(true);
        try {
            console.log('Schedule Preferences:', values);
            await new Promise(resolve => setTimeout(resolve, 1000));
            message.success('创作频率与计划偏好已保存');
        } catch (error) {
            message.error('保存失败');
        } finally {
            setLoading(false);
        }
    };

    const tabItems = [
        {
            key: 'profile',
            label: (<span><UserOutlined /> 个人资料</span>),
            children: (
                <div style={{ maxWidth: 600, padding: '24px 0' }}>
                    <Card bordered={false}>
                        <div style={{ marginBottom: 24, textAlign: 'center' }}>
                            <Avatar size={100} src={user?.avatar_url} icon={<UserOutlined />} />
                            <div style={{ marginTop: 16 }}>
                                <Button size="small">更换头像</Button>
                            </div>
                        </div>
                        <Form form={profileForm} layout="vertical" onFinish={handleUpdateProfile}>
                            <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
                                <Input prefix={<UserOutlined />} />
                            </Form.Item>
                            <Form.Item label="电子邮箱" name="email">
                                <Input prefix={<UserOutlined />} disabled />
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                                    保存修改
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </div>
            ),
        },
        {
            key: 'schedule',
            label: (<span><CalendarOutlined /> 创作计划偏好</span>),
            children: (
                <div style={{ padding: '24px 0' }}>
                    <Card
                        bordered={false}
                        title={<Space><ThunderboltOutlined style={{ color: '#6366f1' }} /> AI 内容连贯性与频率设置</Space>}
                    >
                        <Paragraph style={{ color: '#64748b', marginBottom: 24 }}>
                            设置不同社交媒体的内容分发逻辑，确保内容的前后呼应与节奏感。
                        </Paragraph>
                        <Form
                            form={scheduleForm}
                            layout="vertical"
                            onFinish={handleUpdateSchedule}
                            initialValues={{
                                global_logic: 'progressive',
                                sync_enabled: true,
                            }}
                        >
                            <Row gutter={48}>
                                <Col span={12} style={{ maxHeight: 600, overflowY: 'auto' }}>
                                    <Title level={5}>平台发帖频率设置</Title>
                                    <Divider style={{ margin: '12px 0' }} />

                                    {platformsList.map(p => (
                                        <Form.Item key={p.key} label={`${p.icon} ${p.name}发帖频率`} style={{ marginBottom: 16 }}>
                                            <Space>
                                                <Form.Item name={`${p.key}_freq`} noStyle>
                                                    <Select style={{ width: 100 }}>
                                                        <Option value="daily">每天</Option>
                                                        <Option value="weekly">每周</Option>
                                                        <Option value="monthly">每月</Option>
                                                    </Select>
                                                </Form.Item>
                                                <Form.Item name={`${p.key}_count`} noStyle>
                                                    <InputNumber min={1} max={10} />
                                                </Form.Item>
                                                <Text>次</Text>
                                            </Space>
                                        </Form.Item>
                                    ))}
                                </Col>

                                <Col span={12}>
                                    <Title level={5}>内容逻辑与连贯性</Title>
                                    <Divider style={{ margin: '12px 0' }} />

                                    <Form.Item label="内容编排逻辑" name="global_logic" tooltip="AI 将根据此逻辑生成前后呼应的内容系列">
                                        <Select style={{ width: '100%' }}>
                                            <Option value="progressive">循序渐进 (由浅入深讲解主题)</Option>
                                            <Option value="series">专题系列 (围绕一个核心分解为多个点)</Option>
                                            <Option value="hook_loop">钩子循环 (每篇结尾为下一篇预热)</Option>
                                            <Option value="random">独立发布 (各篇内容相互独立)</Option>
                                        </Select>
                                    </Form.Item>

                                    <Form.Item label="启用跨平台协同" name="sync_enabled" valuePropName="checked">
                                        <Switch defaultChecked />
                                        <Text style={{ marginLeft: 8, fontSize: 13, color: '#64748b' }}>
                                            在不同平台发布相互补充的内容（如：公众号发长文，抖音发精华视频）
                                        </Text>
                                    </Form.Item>

                                    <Form.Item label="年度主题规划 (Meta-Planning)" name="meta_plan">
                                        <Input.TextArea
                                            rows={4}
                                            placeholder="在此输入您的年度内容目标，AI 将以此为核心规划季、月度内容..."
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider />
                            <Form.Item>
                                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                                    保存计划偏好
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </div>
            ),
        },
        {
            key: 'tenant',
            label: (<span><TeamOutlined /> 团队设置</span>),
            children: (
                <div style={{ maxWidth: 600, padding: '24px 0' }}>
                    <Card bordered={false}>
                        <Form form={tenantForm} layout="vertical">
                            <Form.Item label="团队名称" name="tenantName" rules={[{ required: true }]}>
                                <Input prefix={<TeamOutlined />} />
                            </Form.Item>
                            <Form.Item label="当前版本" name="plan">
                                <Select disabled>
                                    <Option value="free">免费版</Option>
                                    <Option value="pro">专业版</Option>
                                    <Option value="team">团队版</Option>
                                    <Option value="enterprise">企业版</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" icon={<SaveOutlined />}>
                                    更新团队信息
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                </div>
            ),
        },
        {
            key: 'plan',
            label: (<span><CreditCardOutlined /> 套餐与用量</span>),
            children: (
                <div style={{ padding: '24px 0' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Card title="当前版本" extra={<Button type="primary">升级版本</Button>}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ margin: 0 }}>{tenant?.plan === 'pro' ? '专业版' : '免费版'}</h2>
                                    <p style={{ color: '#6b7280' }}>下次账单日期：2024年1月31日</p>
                                </div>
                                <Tag color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>运行中</Tag>
                            </div>
                        </Card>
                        <Card title="资源使用情况">
                            <List
                                itemLayout="horizontal"
                                dataSource={[
                                    { title: '账号绑定', current: 2, limit: 5, unit: '个' },
                                    { title: 'AI 生成额度', current: 450, limit: 1000, unit: '次' },
                                    { title: '存储空间', current: 0.2, limit: 1, unit: 'GB' },
                                ]}
                                renderItem={(item) => (
                                    <List.Item>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <span>{item.title}</span>
                                                <span>{item.current} / {item.limit} {item.unit}</span>
                                            </div>
                                            <Progress percent={(item.current / item.limit) * 100} showInfo={false} strokeColor="#6366f1" />
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </Space>
                </div>
            ),
        },
        {
            key: 'notifications',
            label: (<span><BellOutlined /> 通知设置</span>),
            children: (
                <div style={{ padding: '24px 0' }}>
                    <Card bordered={false}>
                        <List
                            itemLayout="horizontal"
                            dataSource={[
                                { title: '发布状态通知', desc: '当内容发布成功或失败时发送通知', default: true },
                                { title: '团队动态', desc: '当有新成员加入或被移除时提醒', default: true },
                                { title: '计划偏移提醒', desc: '当内容生成不符合预设频率时发送提醒', default: true },
                                { title: '系统更新', desc: '重要版本更新和功能上线提醒', default: false },
                            ]}
                            renderItem={(item) => (
                                <List.Item actions={[<Switch defaultChecked={item.default} />]}>
                                    <List.Item.Meta title={item.title} description={item.desc} />
                                </List.Item>
                            )}
                        />
                    </Card>
                </div>
            ),
        },
    ];

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>管理设置</h1>
                <p style={{ color: '#6b7280', marginTop: 4 }}>配置您的创作逻辑、团队权限与账户订阅</p>
            </div>

            <Card styles={{ body: { padding: '0 24px 24px' } }} style={{ borderRadius: 16 }}>
                <Tabs items={tabItems} size="large" />
            </Card>
        </div>
    );
}
