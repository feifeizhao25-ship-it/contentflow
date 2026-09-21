'use client';

import React, { useState, useEffect } from 'react';
import {
    PlusOutlined,
    CheckCircleFilled,
    ExclamationCircleFilled,
    UserOutlined,
    DeleteOutlined,
    ReloadOutlined,
    LinkOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import { Avatar, Tooltip, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface PlatformAccount {
    id: string;
    platform: string;
    platformName: string;
    accountName: string;
    avatar?: string;
    followers: number;
    status: 'active' | 'expired' | 'error';
    authType: string;
    expiresAt?: string;
    color: string;
}

const availablePlatforms = [
    { key: 'douyin', name: '抖音', color: '#000000', icon: '🎵' },
    { key: 'xiaohongshu', name: '小红书', color: '#ff2442', icon: '📕' },
    { key: 'weixin', name: '微信视频号', color: '#07c160', icon: '💬' },
    { key: 'bilibili', name: 'B站', color: '#00a1d6', icon: '📺' },
    { key: 'weibo', name: '微博', color: '#ff8200', icon: '👁️' },
    { key: 'kuaishou', name: '快手', color: '#ff6600', icon: '⚡' },
];

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
    const [loading, setLoading] = useState<string | null>(null);
    const [authorizing, setAuthorizing] = useState<string | null>(null);
    const [accountLimit, setAccountLimit] = useState<number | null>(null);

    useEffect(() => {
        fetchAccounts();
        // 可绑定账号数以当前套餐为准（原来写死 5，而套餐是 1 / 10 / 30 / 不限）
        fetch('/api/v1/billing/subscription')
            .then((res) => (res.ok ? res.json() : null))
            .then((envelope) => {
                const limit = Number(envelope?.data?.limits?.max_accounts);
                if (Number.isFinite(limit)) setAccountLimit(limit);
            })
            .catch(() => undefined);
    }, []);

    const fetchAccounts = async () => {
        try {
            // 路径修正：后端是 GET /api/v1/accounts（AccountController @Controller('accounts')），
            // 而不是 /api/accounts/authorize —— 后者既不匹配 NestJS 的 api/v1 全局前缀，
            // web-cn 里也没有对应的本地 route.ts，请求一直是 404。
            const response = await fetch('/api/v1/accounts');
            const envelope = await response.json();
            // 响应被 TransformInterceptor 包成 { success, data, meta }
            const data = { success: envelope?.success, accounts: envelope?.data ?? [] };
            if (data.success && Array.isArray(data.accounts)) {
                const mappedAccounts: PlatformAccount[] = data.accounts.map((acc: any) => ({
                    id: acc.id,
                    platform: acc.platform,
                    platformName: availablePlatforms.find(p => p.key === acc.platform)?.name || acc.platform,
                    accountName: acc.account_name,
                    followers: acc.follower_count || 0,
                    status: (acc.status as any) || 'active',
                    authType: acc.auth_type || 'OAuth',
                    expiresAt: acc.expires_at ? new Date(acc.expires_at).toLocaleDateString() : '永久',
                    color: availablePlatforms.find(p => p.key === acc.platform)?.color || '#9ca3af',
                    avatar: acc.avatar_url,
                }));
                setAccounts(mappedAccounts);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        }
    };

    /**
     * 只走平台官方开放平台的 OAuth：向后端要授权地址，拿到就跳转；
     * 没开通时后端会说明原因。
     *
     * 红线：不向用户索要账号密码或登录凭证。原来这里让用户「粘贴网页版登录后的 Cookie」——
     * 那是模拟登录，违反平台规则，也等于把用户的登录凭证交给我们保管。
     */
    const handleAuthorize = async (platformKey: string) => {
        setAuthorizing(platformKey);
        try {
            const response = await fetch(`/api/v1/accounts/${encodeURIComponent(platformKey)}/auth-url`);
            const envelope = await response.json().catch(() => ({}));
            const url = envelope?.data?.auth_url;
            if (response.ok && typeof url === 'string' && url.startsWith('https://')) {
                window.location.href = url;
                return;
            }
            const reason = Array.isArray(envelope?.message) ? envelope.message[0] : envelope?.message;
            message.info(typeof reason === 'string' && reason ? reason : '该平台授权暂未开通');
        } catch {
            message.error('网络连接失败，请稍后重试');
        } finally {
            setAuthorizing(null);
        }
    };

    const handleUnbind = async (id: string) => {
        try {
            // 后端是 DELETE /api/v1/accounts/:id（路径参数），不是 ?id= 查询串
            const response = await fetch(`/api/v1/accounts/${id}`, {
                method: 'DELETE',
            });
            const envelope = await response.json();
            const data = { success: envelope?.success, error: envelope?.message };
            if (data.success) {
                setAccounts(prev => prev.filter(a => a.id !== id));
                message.success('账号已成功解绑');
            } else {
                throw new Error(data.error || '解绑失败');
            }
        } catch (error: any) {
            message.error(error.message);
        }
    };

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 mb-2">账号管理</h1>
                    <p className="text-zinc-500">管理您的社交平台账号授权与状态</p>
                </div>
                <div className="flex gap-4">
                    <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-3 border border-zinc-200 bg-white/50">
                        <span className="text-zinc-500 text-sm">已绑定</span>
                        <span className="text-xl font-bold text-zinc-900">{accounts.length} / {accountLimit == null ? '—' : accountLimit === -1 ? '不限' : accountLimit}</span>
                    </div>
                </div>
            </motion.div>

            {/* Platform Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Account List */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                        <SafetyCertificateOutlined className="text-emerald-500" />
                        已授权账号
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {accounts.map((account) => (
                                <motion.div
                                    key={account.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass-card p-5 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-all group relative overflow-hidden bg-white/60"
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: account.color }} />

                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                src={account.avatar}
                                                size={48}
                                                className="border-2 border-white"
                                                style={{ backgroundColor: account.color }}
                                            >
                                                {account.accountName[0]}
                                            </Avatar>
                                            <div>
                                                <h3 className="font-bold text-zinc-900 truncate max-w-[120px]">{account.accountName}</h3>
                                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                    <span>{account.platformName}</span>
                                                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                                    <span>官方授权</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5",
                                            account.status === 'active' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                        )}>
                                            <span className={clsx("w-1.5 h-1.5 rounded-full animate-pulse",
                                                account.status === 'active' ? "bg-emerald-400" : "bg-red-400"
                                            )} />
                                            {account.status === 'active' ? '运行中' : '异常'}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-100">
                                        <div className="text-xs text-zinc-500">
                                            粉丝数 <span className="text-zinc-900 font-medium ml-1">{account.followers.toLocaleString()}</span>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Tooltip title="解绑">
                                                <button
                                                    onClick={() => handleUnbind(account.id)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                                                >
                                                    <DeleteOutlined />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Add New Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => document.getElementById('platform-list')?.scrollIntoView({ behavior: 'smooth' })}
                            className="glass-card p-5 rounded-2xl border border-dashed border-zinc-300 hover:border-indigo-500/50 flex flex-col items-center justify-center gap-3 text-zinc-400 hover:text-indigo-600 transition-colors min-h-[160px] bg-white/40"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl">
                                <PlusOutlined />
                            </div>
                            <span className="text-sm font-medium">添加新账号</span>
                        </motion.button>
                    </div>
                </div>

                {/* Right: Available Platforms */}
                <div id="platform-list" className="space-y-6">
                    <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                        <LinkOutlined className="text-indigo-500" />
                        支持平台
                    </h2>
                    <div className="glass-card p-2 rounded-2xl border border-zinc-200 bg-white/60">
                        {availablePlatforms.map((platform) => (
                            <div
                                key={platform.key}
                                className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-xl transition-colors group cursor-pointer"
                                onClick={() => authorizing === null && handleAuthorize(platform.key)}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-md"
                                        style={{ backgroundColor: platform.color, color: '#fff' }}
                                    >
                                        {platform.icon || platform.name[0]}
                                    </div>
                                    <span className="text-zinc-700 font-medium group-hover:text-zinc-900 transition-colors">{platform.name}</span>
                                </div>
                                {authorizing === platform.key
                                    ? <ReloadOutlined spin className="text-zinc-400" />
                                    : <PlusOutlined className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
                        <span className="font-bold block mb-1">📢 注意事项</span>
                        仅支持各平台官方开放平台授权。我们不会向你索要账号密码或登录凭证，也不会模拟登录。
                    </div>
                </div>
            </div>

        </div>
    );
}
