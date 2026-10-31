'use client';

import React, { useState, useEffect } from 'react';
import {
    Card,
    Tabs,
    Form,
    Input,
    Button,
    Avatar,
    Space,
    Tag,
    Select,
    Divider,
    Switch,
    List,
    InputNumber,
    Row,
    Col,
    Typography,
    Progress,
    Modal,
    Checkbox,
    Alert,
} from 'antd';
import { message } from '@/lib/antd-app';
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
    DownloadOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store/appStore';
import {
    AccountError,
    deleteMyAccount,
    fetchMyDataExport,
    savePreferences,
    saveProfile,
} from '@/lib/account-service';
import { logout } from '@/lib/session';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { describePlan, type PlanView } from '@/lib/page-data';
import { PhoneBinding } from '@/components/auth/PhoneBinding';

const { Option } = Select;
const { Text, Title, Paragraph } = Typography;

export default function SettingsPage() {
    const { user, tenant, setUser } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [planView, setPlanView] = useState<PlanView | null>(null);
    const [profileForm] = Form.useForm();
    const [tenantForm] = Form.useForm();
    const [scheduleForm] = Form.useForm();

    const platformsList = [
        { key: 'xhs', name: '小红书', icon: '📕' },
        { key: 'douyin', name: '抖音', icon: '🎵' },
        { key: 'channels', name: '视频号', icon: '📹' },
        { key: 'wechat', name: '公众号', icon: '💬' },
        { key: 'bilibili', name: 'B站', icon: '📺' },
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

    // 套餐与用量：来自后端的工作区限额与用量（原来是写死的 2/5、450/1000 与 2024 年账单日）
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            apiClient.get<any>('/users/me'),
            apiClient.get<any>('/billing/subscription').catch(() => null),
        ])
            .then(([res, sub]) => { if (!cancelled) setPlanView(describePlan(res?.user?.tenant, sub?.data ?? sub)); })
            .catch(() => { if (!cancelled) setPlanView(null); });
        return () => { cancelled = true; };
    }, []);

    const errorText = (error: unknown, fallback: string) =>
        error instanceof AccountError ? error.message : fallback;

    // 原来这里 await 一个 1 秒的定时器就提示「已更新」——什么都没保存。
    const handleUpdateProfile = async (values: any) => {
        setLoading(true);
        try {
            await saveProfile(String(values.name ?? '').trim());
            message.success('个人资料已更新');
        } catch (error) {
            message.error(errorText(error, '更新失败，请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSchedule = async (values: any) => {
        setLoading(true);
        try {
            await savePreferences({ schedule: values });
            message.success('创作频率与计划偏好已保存');
        } catch (error) {
            message.error(errorText(error, '保存失败，请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    const [notify, setNotify] = useState<Record<string, boolean>>({
        publish: true, team: true, drift: true, system: false,
    });
    const toggleNotify = async (key: string, on: boolean) => {
        const previous = notify;
        setNotify({ ...notify, [key]: on });
        try {
            await savePreferences({ notifications: { ...notify, [key]: on } });
        } catch (error) {
            setNotify(previous);
            message.error(errorText(error, '保存失败，请稍后重试'));
        }
    };

    // ── 账号与数据 ──
    const [exporting, setExporting] = useState(false);
    const handleExport = async () => {
        setExporting(true);
        try {
            const { filename, text } = await fetchMyDataExport();
            const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            message.success('已导出，文件里不含密码与平台授权凭据');
        } catch (error) {
            message.error(errorText(error, '导出失败，请稍后重试'));
        } finally {
            setExporting(false);
        }
    };

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [understood, setUnderstood] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const openDelete = () => {
        setUnderstood(false);
        setDeletePassword('');
        setDeleteError(null);
        setDeleteOpen(true);
    };
    const handleDelete = async () => {
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteMyAccount(deletePassword || undefined);
        } catch (error) {
            // 密码错误 / 工作区还有成员 / 服务不可用：留在弹窗里说清楚，保持登录，数据没有改动
            setDeleteError(errorText(error, '注销未完成，你的数据没有任何改动，请稍后重试'));
            setDeleting(false);
            return;
        }
        // 账号已注销：清 cookie 并回到登录页
        await logout();
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
                                <Button size="small" disabled title="头像上传暂未开放">更换头像</Button>
                            </div>
                        </div>
                        <Form form={profileForm} layout="vertical" onFinish={handleUpdateProfile}>
                            <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
                                <Input prefix={<UserOutlined />} />
                            </Form.Item>
                            {user?.email ? (
                                <Form.Item label="电子邮箱" name="email">
                                    <Input prefix={<UserOutlined />} disabled />
                                </Form.Item>
                            ) : null}
                            <Form.Item>
                                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                                    保存修改
                                </Button>
                            </Form.Item>
                        </Form>
                    </Card>
                    <Card bordered={false} title="手机号与实名" style={{ marginTop: 16 }}>
                        <PhoneBinding
                            phone={user?.phone}
                            phoneVerified={user?.phone_verified}
                            realNameVerified={user?.real_name_verified}
                            onBound={(maskedPhone) => user && setUser({ ...user, phone: maskedPhone, phone_verified: true })}
                        />
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
                            <Row gutter={[16, 16]}>
                                <Col xs={24} lg={12} style={{ maxHeight: 600, overflowY: 'auto' }}>
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

                                <Col xs={24} lg={12}>
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

                                    <Form.Item label="年度主题规划" name="meta_plan">
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
                                <Input prefix={<TeamOutlined />} disabled />
                            </Form.Item>
                            <Form.Item label="当前版本" name="plan">
                                <Select disabled>
                                    <Option value="free">免费版</Option>
                                    <Option value="pro">个人版</Option>
                                    <Option value="team">团队版</Option>
                                    <Option value="enterprise">商务版</Option>
                                </Select>
                            </Form.Item>
                            <Text type="secondary">团队名称暂不支持在线修改，如需变更请联系客服。</Text>
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
                        <Card title="当前版本" extra={<Link href="/pricing"><Button type="primary">升级版本</Button></Link>}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ margin: 0 }}>{planView?.name ?? (tenant?.plan === 'pro' ? '个人版' : '免费版')}</h2>
                                    <p style={{ color: '#6b7280' }}>{planView ? planView.renewText : '正在读取套餐信息…'}</p>
                                </div>
                                <Tag color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>使用中</Tag>
                            </div>
                        </Card>
                        <Card title="资源使用情况">
                            {planView && planView.usage.length > 0 ? (
                                <List
                                    itemLayout="horizontal"
                                    dataSource={planView.usage}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <div style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <span>{item.title}</span>
                                                    <span>{item.current} / {item.limit} {item.unit}</span>
                                                </div>
                                                <Progress percent={Math.min(100, (item.current / item.limit) * 100)} showInfo={false} strokeColor="#6366f1" />
                                            </div>
                                        </List.Item>
                                    )}
                                />
                            ) : (
                                <Text type="secondary">{planView ? '暂无用量数据' : '正在读取用量…'}</Text>
                            )}
                            <Paragraph style={{ marginTop: 12, marginBottom: 0, color: '#64748b' }}>额度按北京时间自然月计算，每月 1 日恢复。</Paragraph>
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
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="通知发送渠道暂未开通"
                            description="下面的开关会保存您的偏好，渠道开通后按偏好发送；目前不会收到站内信、短信或邮件通知。"
                        />
                        <List
                            itemLayout="horizontal"
                            dataSource={[
                                { key: 'publish', title: '发布状态通知', desc: '当内容发布成功或失败时发送通知' },
                                { key: 'team', title: '团队动态', desc: '当有新成员加入或被移除时提醒' },
                                { key: 'drift', title: '计划偏移提醒', desc: '当内容生成不符合预设频率时发送提醒' },
                                { key: 'system', title: '系统更新', desc: '重要版本更新和功能上线提醒' },
                            ]}
                            renderItem={(item) => (
                                <List.Item actions={[<Switch key="enabled" checked={!!notify[item.key]} onChange={(on) => toggleNotify(item.key, on)} />]}>
                                    <List.Item.Meta title={item.title} description={item.desc} />
                                </List.Item>
                            )}
                        />
                    </Card>
                </div>
            ),
        },
        {
            key: 'data',
            label: (<span><SafetyOutlined /> 账号与数据</span>),
            children: (
                <div style={{ maxWidth: 720, padding: '24px 0' }}>
                    <Card bordered={false} title="导出我的数据">
                        <Paragraph style={{ color: '#64748b' }}>
                            下载一份 JSON 文件：你的账号资料、个人数据，以及你名下工作区的内容、平台账号、素材与 AI 生成记录。
                            文件里不含密码和平台授权凭据。
                        </Paragraph>
                        <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>导出</Button>
                    </Card>
                    <Card bordered={false} title="注销账号" style={{ marginTop: 16 }}>
                        <Paragraph>注销后，以下内容会被<Text strong type="danger">永久删除，无法恢复</Text>：</Paragraph>
                        <ul style={{ color: '#475569', lineHeight: 1.9 }}>
                            <li>个人资料、登录记录、通知、积分与成长记录</li>
                            <li>如果你是工作区里唯一的成员：工作区的全部内容、平台账号及其授权、素材、AI 生成记录和 API 密钥</li>
                        </ul>
                        <Paragraph>依法保留（不再与可识别的个人关联）：</Paragraph>
                        <ul style={{ color: '#475569', lineHeight: 1.9 }}>
                            <li>订单、订阅与支付记录（交易凭证，保存不少于三年）</li>
                            <li>操作日志（保存不少于六个月）</li>
                        </ul>
                        <Paragraph type="secondary">
                            如果工作区里还有其他成员，所有者需要先转让所有权或移除成员，才能注销。
                        </Paragraph>
                        <Button danger icon={<DeleteOutlined />} onClick={openDelete}>注销账号</Button>
                    </Card>
                    <Modal
                        title="确认注销账号"
                        open={deleteOpen}
                        onCancel={() => !deleting && setDeleteOpen(false)}
                        okText="确认注销"
                        okButtonProps={{ danger: true, disabled: !understood, loading: deleting }}
                        cancelText="先不注销"
                        onOk={handleDelete}
                        maskClosable={false}
                    >
                        <Space direction="vertical" style={{ width: '100%' }} size={12}>
                            <Alert type="warning" showIcon message="此操作不可撤销" />
                            <Input.Password
                                placeholder="请输入当前登录密码"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <Checkbox checked={understood} onChange={(e) => setUnderstood(e.target.checked)}>
                                我已了解：账号与个人数据将被永久删除
                            </Checkbox>
                            {deleteError && <Alert type="error" showIcon message={deleteError} />}
                        </Space>
                    </Modal>
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
