'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Avatar, Modal, Form, Input, Select, message, Tabs, List, Typography, Alert } from 'antd';
import {
    UserAddOutlined,
    UserOutlined,
    CrownOutlined,
    SafetyOutlined,
    EditOutlined,
    DeleteOutlined,
    MailOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';

const { Option } = Select;
const { Text } = Typography;
const TAB_MAP: Record<string, string> = { approvals: 'activity' };

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    status: 'active' | 'inactive';
    avatar_url?: string;
    created_at: string;
}

function TeamContent() {
    const searchParams = useSearchParams();
    // Map 'approvals' -> 'activity' tab, others default to 'members'
    const initialTab = TAB_MAP[searchParams.get('tab') || ''] || 'members';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [inviteModalVisible, setInviteModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [activities, setActivities] = useState<any[]>([]);
    const [activitiesLoading, setActivitiesLoading] = useState(false);
    // 区分「后端没有这个接口」与「确实没有动态」
    const [activitiesUnavailable, setActivitiesUnavailable] = useState(false);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            // 路径修正：后端是 GET /api/v1/team/members（TeamController），
            // 而不是 /api/team —— 缺 api/v1 前缀且资源名不对，一直 404。
            const res = await fetch('/api/v1/team/members');
            const envelope = await res.json();
            // 响应被 TransformInterceptor 包成 { success, data, meta }
            if (envelope?.success) {
                setMembers(envelope.data ?? []);
            } else {
                message.error(envelope?.message || '获取成员列表失败');
            }
        } catch (error) {
            message.error('获取成员列表失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchActivities = async () => {
        setActivitiesLoading(true);
        try {
            // ⚠️ 团队动态在后端**没有实现**：TeamController 只有
            //    GET/POST members 两个路由。此前打 /api/team/activity 得到 404，
            //    被 catch 后只在控制台留一行，页面上表现为「一直空白」——
            //    与「暂无动态」无法区分。这里显式区分两者。
            const res = await fetch('/api/v1/team/activity');
            if (res.status === 404) {
                setActivities([]);
                setActivitiesUnavailable(true);
                return;
            }
            const envelope = await res.json();
            if (envelope?.success) {
                setActivities(envelope.data ?? []);
            }
        } catch (error) {
            console.error('Failed to fetch activities');
        } finally {
            setActivitiesLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
        fetchActivities();
    }, []);

    useEffect(() => {
        const tabKey = searchParams.get('tab');
        const mappedTab = TAB_MAP[tabKey || ''] || tabKey || 'members';
        setActiveTab((currentTab) => mappedTab || currentTab);
    }, [searchParams]);

    const roleColors: Record<string, string> = {
        owner: 'gold',
        admin: 'red',
        editor: 'blue',
        viewer: 'default',
    };

    const roleLabels: Record<string, string> = {
        owner: '所有者',
        admin: '管理员',
        editor: '编辑',
        viewer: '查看者',
    };

    const roleIcons: Record<string, React.ReactNode> = {
        owner: <CrownOutlined />,
        admin: <SafetyOutlined />,
        editor: <EditOutlined />,
        viewer: <UserOutlined />,
    };

    const rolePermissions = {
        owner: ['全部权限'],
        admin: ['内容管理', '发布管理', '账号管理', '成员管理'],
        editor: ['内容创作', '内容编辑', '发布内容'],
        viewer: ['查看内容', '查看数据'],
    };

    const handleInvite = async (values: any) => {
        try {
            // 同上：后端是 POST /api/v1/team/members
            const res = await fetch('/api/v1/team/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const envelope = await res.json();
            const data = { success: envelope?.success, error: envelope?.message };
            if (data.success) {
                message.success(`已成功邀请 ${values.email}`);
                setInviteModalVisible(false);
                form.resetFields();
                fetchMembers();
            } else {
                message.error(data.error);
            }
        } catch (error) {
            message.error('发送邀请失败');
        }
    };

    const handleDelete = async (id: string) => {
        Modal.confirm({
            title: '确认移除',
            content: '确定要将该成员从团队中移除吗？',
            okText: '确认',
            cancelText: '取消',
            onOk: async () => {
                try {
                    // ⚠️ 后端 TeamController 只有 GET/POST members，**没有 DELETE**。
                    //    此前打 /api/team?id= 得到 404，被 catch 成一句「移除失败」——
                    //    看起来像临时故障，实际是功能没实现。
                    const res = await fetch(`/api/v1/team/members/${id}`, { method: 'DELETE' });
                    if (res.status === 404) {
                        message.warning('移除成员功能尚未接入后端');
                        return;
                    }
                    const envelope = await res.json();
                    const data = { success: envelope?.success, error: envelope?.message };
                    if (data.success) {
                        message.success('成员已移除');
                        fetchMembers();
                    } else {
                        message.error(data.error);
                    }
                } catch (error) {
                    message.error('移除操作失败');
                }
            },
        });
    };

    const columns = [
        {
            title: '成员',
            key: 'member',
            render: (record: TeamMember) => (
                <Space>
                    <Avatar icon={<UserOutlined />} src={record.avatar_url} />
                    <div>
                        <div style={{ fontWeight: 500 }}>{record.name || record.email.split('@')[0]}</div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>{record.email}</div>
                    </div>
                </Space>
            ),
        },
        {
            title: '角色',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => (
                <Tag icon={roleIcons[role]} color={roleColors[role]}>
                    {roleLabels[role]}
                </Tag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'success' : 'default'}>
                    {status === 'active' ? '活跃' : '待激活'}
                </Tag>
            ),
        },
        {
            title: '加入时间',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date: string) => new Date(date).toLocaleDateString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (record: TeamMember) => (
                <Space size="small">
                    {record.role !== 'owner' && (
                        <>
                            <Button type="link" size="small">
                                编辑
                            </Button>
                            <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
                                移除
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    const tabItems = [
        {
            key: 'members',
            label: '团队成员',
            children: (
                <div>
                    <div style={{ marginBottom: 16 }}>
                        <Button
                            type="primary"
                            icon={<UserAddOutlined />}
                            onClick={() => setInviteModalVisible(true)}
                        >
                            邀请成员
                        </Button>
                    </div>
                    <Table
                        columns={columns as any}
                        dataSource={members}
                        rowKey="id"
                        loading={loading}
                        pagination={false}
                    />
                </div>
            ),
        },
        {
            key: 'roles',
            label: '角色权限',
            children: (
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                    {Object.entries(rolePermissions).map(([role, permissions]) => (
                        <Card
                            key={role}
                            title={
                                <Space>
                                    {roleIcons[role as keyof typeof roleIcons]}
                                    <span>{roleLabels[role as keyof typeof roleLabels]}</span>
                                </Space>
                            }
                            extra={<Tag color={roleColors[role as keyof typeof roleColors]}>权限</Tag>}
                        >
                            <ul style={{ paddingLeft: 20, margin: 0 }}>
                                {permissions.map((permission, index) => (
                                    <li key={index} style={{ marginBottom: 8 }}>
                                        {permission}
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    ))}
                </div>
            ),
        },
        {
            key: 'activity',
            label: '活动日志',
            children: (
                <Card loading={activitiesLoading}>
                    {activitiesUnavailable && (
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="活动日志尚未开放"
                            description="该功能的后端接口还未实现，暂时无法展示团队动态。"
                        />
                    )}
                    <List
                        itemLayout="horizontal"
                        dataSource={activities}
                        renderItem={(item) => (
                            <List.Item>
                                <List.Item.Meta
                                    avatar={<Avatar>{item.user.name?.[0] || 'U'}</Avatar>}
                                    title={
                                        <Space>
                                            <Text strong>{item.user.name}</Text>
                                            <Text>{item.action}</Text>
                                            <Tag color="purple">{item.module}</Tag>
                                            <Text type="secondary">{item.target}</Text>
                                        </Space>
                                    }
                                    description={new Date(item.time).toLocaleString()}
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>团队协作</h1>
            </div>

            <Card>
                <Tabs items={tabItems} activeKey={activeTab} onChange={setActiveTab} />
            </Card>

            <Modal
                title="邀请团队成员"
                open={inviteModalVisible}
                onCancel={() => setInviteModalVisible(false)}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleInvite}
                >
                    <Form.Item
                        name="email"
                        label="邮箱地址"
                        rules={[
                            { required: true, message: '请输入邮箱地址' },
                            { type: 'email', message: '请输入有效的邮箱地址' },
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined />}
                            placeholder="member@example.com"
                            size="large"
                        />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="角色"
                        initialValue="editor"
                        rules={[{ required: true, message: '请选择角色' }]}
                    >
                        <Select size="large">
                            <Option value="admin">
                                <Space>
                                    <SafetyOutlined />
                                    <span>管理员</span>
                                </Space>
                            </Option>
                            <Option value="editor">
                                <Space>
                                    <EditOutlined />
                                    <span>编辑</span>
                                </Space>
                            </Option>
                            <Option value="viewer">
                                <Space>
                                    <UserOutlined />
                                    <span>查看者</span>
                                </Space>
                            </Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="message"
                        label="邀请消息（可选）"
                    >
                        <Input.TextArea
                            rows={4}
                            placeholder="添加一些欢迎消息..."
                        />
                    </Form.Item>

                    <Form.Item>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setInviteModalVisible(false)}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                发送邀请
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

export default function TeamPage() {
    return (
        <React.Suspense fallback={<div>Loading team...</div>}>
            <TeamContent />
        </React.Suspense>
    );
}
