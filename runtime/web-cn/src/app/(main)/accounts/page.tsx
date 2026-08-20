'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Avatar, Button, Empty, Modal, Skeleton, Tag, message } from 'antd';
import { DeleteOutlined, LinkOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';

interface PlatformAccount {
    id: string;
    platform: string;
    account_name?: string;
    account_nickname?: string;
    avatar_url?: string;
    follower_count: number;
    status: string;
    health_score: number;
    auth_expires_at?: string;
    error_message?: string;
}

const platforms = [
    ['douyin', '抖音', '🎵'],
    ['xiaohongshu', '小红书', '📕'],
    ['weixin', '微信视频号', '💬'],
    ['bilibili', 'B站', '📺'],
    ['weibo', '微博', '👁️'],
    ['kuaishou', '快手', '⚡'],
] as const;

function unwrapAccounts(response: any): PlatformAccount[] {
    const payload = response?.data ?? response;
    return Array.isArray(payload) ? payload : [];
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setAccounts(unwrapAccounts(await apiClient.get('/accounts')));
        } catch (loadError) {
            setAccounts([]);
            setError(loadError instanceof Error ? loadError.message : '账号加载失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const remove = (account: PlatformAccount) => {
        Modal.confirm({
            title: '确认解绑账号？',
            content: `解绑后不会再向“${account.account_nickname || account.account_name || account.platform}”创建发布任务。`,
            okText: '确认解绑',
            okButtonProps: { danger: true },
            cancelText: '取消',
            onOk: async () => {
                await apiClient.delete(`/accounts/${account.id}`);
                message.success('账号已解绑');
                await load();
            },
        });
    };

    const requestConnection = async (platform: string) => {
        try {
            const response: any = await apiClient.get(`/accounts/${platform}/auth-url`);
            const result = response?.data ?? response;
            if (!result?.available || !result?.auth_url) {
                message.info(result?.message || '该平台授权尚未开放');
                return;
            }
            const url = new URL(result.auth_url);
            if (url.protocol !== 'https:') throw new Error('授权地址未使用 HTTPS');
            window.location.assign(url.toString());
        } catch (connectError) {
            message.error(connectError instanceof Error ? connectError.message : '无法发起授权');
        }
    };

    if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div><h1 className="text-3xl font-bold">账号管理</h1><p className="text-zinc-500 mt-1">只显示服务端确认的授权状态；浏览器不会收集平台 Cookie。</p></div>
                <Button icon={<ReloadOutlined />} onClick={() => void load()}>刷新</Button>
            </div>
            {error && <Alert type="error" showIcon message="无法加载账号" description={error} />}
            <Alert type="info" showIcon icon={<SafetyCertificateOutlined />} message="安全授权原则" description="平台连接必须通过完整 OAuth 或官方令牌流程，并在最终同意后由服务端加密保存。未完成的平台会明确显示为未开放。" />
            <section>
                <h2 className="text-lg font-bold mb-4">已授权账号</h2>
                {accounts.length === 0 ? <Empty description="暂无已验证账号" /> : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {accounts.map(account => (
                            <div key={account.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
                                <div className="flex items-start gap-3">
                                    <Avatar src={account.avatar_url}>{(account.account_nickname || account.account_name || account.platform)[0]}</Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold truncate">{account.account_nickname || account.account_name || account.platform}</div>
                                        <div className="text-xs text-zinc-500">{account.platform} · 健康度 {account.health_score}</div>
                                    </div>
                                    <Tag color={account.status === 'active' ? 'green' : 'red'}>{account.status === 'active' ? '可用' : '异常'}</Tag>
                                </div>
                                <div className="mt-4 text-sm text-zinc-500">粉丝 {account.follower_count.toLocaleString()}</div>
                                {account.error_message && <Alert className="mt-3" type="error" showIcon message={account.error_message} />}
                                <Button className="mt-4" danger icon={<DeleteOutlined />} onClick={() => remove(account)}>解绑</Button>
                            </div>
                        ))}
                    </div>
                )}
            </section>
            <section>
                <h2 className="text-lg font-bold mb-4">支持平台</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {platforms.map(([key, name, icon]) => (
                        <Button key={key} size="large" icon={<LinkOutlined />} onClick={() => void requestConnection(key)}>{icon} 连接{name}</Button>
                    ))}
                </div>
            </section>
        </div>
    );
}
