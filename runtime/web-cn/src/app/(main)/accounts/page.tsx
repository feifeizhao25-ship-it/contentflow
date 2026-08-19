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
import { Button, Modal, Avatar, Tooltip, message, Input } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [cookieInput, setCookieInput] = useState('');
    const [authorizing, setAuthorizing] = useState(false);

    useEffect(() => {
        fetchAccounts();
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

    const openAuthorizeModal = (platformKey: string) => {
        setSelectedPlatform(platformKey);
        setCookieInput('');
        setIsModalOpen(true);
    };

    const handleAuthorize = async () => {
        if (!selectedPlatform) return;
        if (!cookieInput.trim()) {
            message.warning('请输入 Cookie');
            return;
        }

        setAuthorizing(true);
        try {
            // ⚠️ Cookie 绑定在后端**没有对应实现**：AccountController 只有
            //    GET / 、GET :id 、DELETE :id 、GET :platform/auth-url（OAuth 授权链接），
            //    没有任何接收 cookie 的端点。此前这里打 /api/accounts/authorize
            //    得到 404，再被 catch 成一句「授权失败」——看起来像网络问题，
            //    实际是功能根本不存在。
            //
            //    这里保持发请求（后端补上即自动生效），但把失败原因说清楚。
            const response = await fetch('/api/v1/accounts/authorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform: selectedPlatform,
                    cookie: cookieInput
                }),
            });
            if (response.status === 404) {
                throw new Error('Cookie 绑定功能尚未接入后端，请改用「OAuth 授权」方式');
            }
            const envelope = await response.json();
            const data = { success: envelope?.success, account: envelope?.data, error: envelope?.message };
            if (data.success && data.account) {
                const acc = data.account;
                const newAccount: PlatformAccount = {
                    id: acc.id,
                    platform: acc.platform,
                    platformName: availablePlatforms.find(p => p.key === acc.platform)?.name || '',
                    accountName: acc.account_name,
                    followers: acc.follower_count,
                    status: 'active',
                    authType: 'cookie',
                    expiresAt: '永久',
                    color: availablePlatforms.find(p => p.key === acc.platform)?.color || '#9ca3af',
                    avatar: acc.avatar_url,
                };
                setAccounts(prev => [newAccount, ...prev]);
                message.success(`${newAccount.platformName} 账号已成功绑定！`);
                setIsModalOpen(false);
            } else {
                throw new Error(data.error || '授权失败');
            }
        } catch (error: any) {
            message.error(error.message);
        } finally {
            setAuthorizing(false);
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
                        <span className="text-xl font-bold text-zinc-900">{accounts.length} / 5</span>
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
                                                    <span>{account.authType === 'cookie' ? 'Cookie授权' : 'OAuth'}</span>
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
                                            <Tooltip title="更新Cookie">
                                                <button className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
                                                    <ReloadOutlined />
                                                </button>
                                            </Tooltip>
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
                                onClick={() => openAuthorizeModal(platform.key)}
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
                                <PlusOutlined className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                            </div>
                        ))}
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
                        <span className="font-bold block mb-1">📢 注意事项</span>
                        当前平台采用手动 Cookie 模式授权。请定期更新 Cookie 以保证发布功能正常使用。
                    </div>
                </div>
            </div>

            {/* Cookie Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-white">
                        <SafetyCertificateOutlined className="text-emerald-400" />
                        授权 {availablePlatforms.find(p => p.key === selectedPlatform)?.name}
                    </div>
                }
                open={isModalOpen}
                onCancel={() => !authorizing && setIsModalOpen(false)}
                footer={null}
                centered
                className="glass-modal"
                width={480}
            >
                <div className="space-y-4 pt-4">
                    <div className="text-zinc-400 text-sm">
                        为了保障账号安全与稳定性，请手动填入该平台网页版登录后的 Cookie。
                    </div>

                    <div>
                        <div className="text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Cookie</div>
                        <Input.TextArea
                            value={cookieInput}
                            onChange={(e) => setCookieInput(e.target.value)}
                            placeholder="请粘贴 Cookie 内容 (例如: sessionid=...)"
                            rows={6}
                            className="bg-zinc-900/50 border-white/10 text-zinc-200 placeholder:text-zinc-600 rounded-xl focus:border-indigo-500 hover:border-white/20"
                            style={{ resize: 'none' }}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                        <Button
                            className="bg-transparent border-white/10 text-zinc-400 hover:text-white hover:border-white/30"
                            onClick={() => setIsModalOpen(false)}
                            disabled={authorizing}
                        >
                            取消
                        </Button>
                        <Button
                            type="primary"
                            className="bg-indigo-600 hover:bg-indigo-500 border-none h-9 px-6 font-medium shadow-lg shadow-indigo-500/20"
                            onClick={handleAuthorize}
                            loading={authorizing}
                        >
                            {authorizing ? '验证中...' : '确认授权'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
