'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CrownFilled,
    ThunderboltFilled,
    ThunderboltOutlined,
    LockFilled,
    CloseOutlined,
    CheckCircleFilled,
    ExclamationCircleOutlined,
    FireOutlined,
    StarOutlined,
    RocketOutlined,
    RightOutlined
} from '@ant-design/icons';
import { Modal, Button, Progress, Tooltip, Badge, Card, Divider } from 'antd';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

// 模拟用户会员状态（实际应从 API 获取）
interface UserSubscription {
    plan: 'free' | 'pro' | 'enterprise';
    monthlyQuota: number;
    usedQuota: number;
    renewalDate: string;
    consecutiveDays: number;
}

const MOCK_USER_SUB: UserSubscription = {
    plan: 'free',
    monthlyQuota: 20,
    usedQuota: 16,
    renewalDate: '2026-02-15',
    consecutiveDays: 3
};

// ============ 升级弹窗组件 ============
export function UpgradeModal({ 
    open, 
    onClose, 
    reason = 'unlock_premium' 
}: { 
    open: boolean; 
    onClose: () => void;
    reason?: string;
}) {
    const router = useRouter();
    
    const benefits: Record<string, { title: string; description: string; features: string[]; price: number; originalPrice: number }> = {
        'unlock_premium': {
            title: '解锁专业版',
            description: '升级后即可使用此功能',
            features: ['无限 AI 生成', '4K 高清图片', '优先队列', '去水印下载'],
            price: 49,
            originalPrice: 59
        },
        'more_accounts': {
            title: '更多账号连接',
            description: '专业版支持连接更多平台',
            features: ['10 个社交账号', '多平台同步发布', '账号分组管理'],
            price: 49,
            originalPrice: 59
        },
        'quota_exceeded': {
            title: '本月额度已用完',
            description: '升级专业版获取更多额度',
            features: ['每月 200 次 AI 生成', '年付省 20%', '随时可取消'],
            price: 490,
            originalPrice: 588
        },
        'quota_warning': {
            title: '额度即将用尽',
            description: '升级专业版，创作不受限制',
            features: ['每月 200 次 AI 生成', '4K 高清图片', '优先生成'],
            price: 49,
            originalPrice: 59
        },
        'high_quality_image': {
            title: '解锁高清图片',
            description: '专业版支持 4K 高清图片生成',
            features: ['4K 分辨率', '更清晰细节', '商业可商用'],
            price: 49,
            originalPrice: 59
        },
        'api_access': {
            title: 'API 访问权限',
            description: '企业版专属功能',
            features: ['完整 API 文档', '私有化部署', '专属客户经理'],
            price: 299,
            originalPrice: 399
        },
        'share_unlock': {
            title: '分享解锁',
            description: '分享到社交平台获得 3 天专业版',
            features: ['3 天专业版体验', '50 次额外额度', '全部功能开放'],
            price: 0,
            originalPrice: 0
        }
    };

    const config = benefits[reason as keyof typeof benefits] || benefits['unlock_premium'];
    const isYearly = config.price >= 100;

    const handleUpgrade = () => {
        onClose();
        router.push('/pricing');
    };

    const handleShare = () => {
        // 分享逻辑
        const shareText = '我正在使用分发侠，AI 一键生成内容，效率提升 10 倍！';
        const shareUrl = `${window.location.origin}?ref=${Date.now()}`;
        
        // 模拟分享
        if (navigator.share) {
            navigator.share({
                title: '分发侠 - AI 内容创作平台',
                text: shareText,
                url: shareUrl,
            }).then(() => {
                Modal.success({
                    title: '分享成功！',
                    content: '您已获得 3 天专业版体验和 50 次额外额度！',
                });
                onClose();
            });
        } else {
            // 复制链接
            navigator.clipboard.writeText(shareUrl);
            Modal.success({
                title: '链接已复制！',
                content: '分享到社交平台，获得专业版奖励',
            });
            onClose();
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            closable={false}
            width={460}
            centered
            className="premium-modal"
        >
            <div className="relative">
                {/* 关闭按钮 */}
                <button 
                    onClick={onClose}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors shadow-lg z-10"
                >
                    <CloseOutlined className="text-zinc-500" />
                </button>

                {/* 头部 */}
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-500/30 relative">
                        <CrownFilled className="text-4xl text-white" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">PRO</span>
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900">{config.title}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{config.description}</p>
                </div>

                {/* 限时优惠标识 */}
                {config.price >= 100 && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                            🔥 年付限时特惠
                        </div>
                    </div>
                )}

                {/* 特性列表 */}
                <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl p-4 mb-4 border border-amber-200">
                    <div className="space-y-2.5">
                        {config.features.map((feature, i) => (
                            <div key={i} className="flex items-center gap-2.5 text-sm">
                                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                    <CheckCircleFilled className="text-white text-xs" />
                                </div>
                                <span className="text-zinc-700 font-medium">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 会员专属 */}
                <div className="bg-zinc-900 rounded-xl p-4 mb-4 text-center">
                    {config.price > 0 ? (
                        <>
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <ThunderboltFilled className="text-yellow-400 animate-pulse" />
                                <span className="text-white font-medium">会员专属优惠</span>
                            </div>
                            <div className="flex items-baseline justify-center gap-2">
                                <span className="text-4xl font-bold text-white">¥{config.price}</span>
                                <span className="text-zinc-500 line-through text-lg">¥{config.originalPrice}</span>
                                <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                                    省 {Math.round((1 - config.price / config.originalPrice) * 100)}%
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-2">
                                {isYearly ? '相当于每月 ¥41，折合每天 ¥1.4' : '月付方案'}
                            </p>
                        </>
                    ) : (
                        <div className="py-2">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <FireOutlined className="text-orange-400 animate-pulse" />
                                <span className="text-white font-medium">分享获得奖励</span>
                            </div>
                            <p className="text-sm text-zinc-400">分享链接到社交平台，解锁 3 天专业版</p>
                        </div>
                    )}
                </div>

                {/* 按钮 */}
                {config.price > 0 ? (
                    <Button
                        type="primary"
                        block
                        size="large"
                        onClick={handleUpgrade}
                        className="!h-14 !rounded-xl !font-bold !text-lg !bg-gradient-to-r !from-amber-400 !via-orange-500 !to-red-500 !border-none hover:!from-amber-500 hover:!via-orange-600 hover:!to-red-600 shadow-lg shadow-orange-500/30"
                    >
                        立即升级专业版
                    </Button>
                ) : (
                    <Button
                        type="primary"
                        block
                        size="large"
                        onClick={handleShare}
                        icon={<RightOutlined />}
                        className="!h-14 !rounded-xl !font-bold !text-lg !bg-gradient-to-r !from-indigo-500 !to-purple-600 !border-none hover:!from-indigo-400 hover:!to-purple-500 shadow-lg"
                    >
                        分享解锁奖励
                    </Button>
                )}
                
                <div className="flex items-center justify-center gap-4 mt-4">
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <CheckCircleFilled className="text-green-500" /> 7 天无理由退款
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                        <CheckCircleFilled className="text-green-500" /> 随时可取消
                    </span>
                </div>
            </div>
        </Modal>
    );
}

// ============ 额度显示组件 ============
export function QuotaDisplay({ 
    used = 16, 
    total = 20,
    showUpgrade = true,
    onUpgradeClick
}: { 
    used?: number; 
    total?: number;
    showUpgrade?: boolean;
    onUpgradeClick?: () => void;
}) {
    const percentage = Math.round((used / total) * 100);
    const isLow = percentage >= 80;
    const isCritical = percentage >= 100;
    const remaining = total - used;

    const getStatusConfig = () => {
        if (isCritical) return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', progress: '#ef4444', trail: '#fee2e2', icon: '🚫', text: '额度已用完' };
        if (isLow) return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', progress: '#f59e0b', trail: '#fef3c7', icon: '⚠️', text: '额度即将用尽' };
        return { color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', progress: '#6366f1', trail: '#e0e7ff', icon: '⚡', text: '额度充足' };
    };

    const status = getStatusConfig();

    return (
        <div className={clsx(
            "rounded-xl p-4 border transition-all",
            status.bg,
            status.border
        )}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{status.icon}</span>
                    <span className="text-sm font-medium text-zinc-700">本月 AI 额度</span>
                </div>
                <span className={clsx("text-sm font-bold", status.color)}>
                    {used} / {total}
                </span>
            </div>
            
            <Progress 
                percent={Math.min(percentage, 100)} 
                showInfo={false}
                strokeColor={status.progress}
                trailColor={status.trail}
                strokeWidth={8}
                className="mb-3"
            />

            <div className="flex items-center justify-between">
                <span className={clsx("text-xs flex items-center gap-1", status.color)}>
                    {remaining > 0 ? `剩余 ${remaining} 次` : status.text}
                </span>
                {showUpgrade && (
                    <button 
                        className={clsx(
                            "text-xs font-medium px-3 py-1 rounded-lg transition-all flex items-center gap-1",
                            isCritical 
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-zinc-900 text-white hover:bg-zinc-800"
                        )}
                        onClick={onUpgradeClick || (() => window.location.href = '/pricing')}
                    >
                        {isCritical ? '立即充值' : '升级获取更多'}
                        <RightOutlined />
                    </button>
                )}
            </div>
        </div>
    );
}

// ============ 会员状态徽章 ============
export function MembershipBadge({ plan = 'free', consecutiveDays = 0 }: { plan?: string; consecutiveDays?: number }) {
    const router = useRouter();
    
    if (plan === 'pro' || plan === 'enterprise') {
        return (
            <div 
                onClick={() => router.push('/pricing')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 cursor-pointer hover:shadow-lg transition-all"
            >
                <CrownFilled className="text-white text-sm" />
                <span className="text-white text-xs font-bold">
                    {plan === 'enterprise' ? '企业版' : '专业版'}
                </span>
            </div>
        );
    }

    return (
        <div 
            onClick={() => router.push('/pricing')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 cursor-pointer hover:bg-zinc-200 transition-all"
        >
            <ThunderboltOutlined className="text-zinc-500 text-sm" />
            <span className="text-zinc-600 text-xs font-medium">升级专业版</span>
            <RightOutlined className="text-zinc-400 text-xs" />
        </div>
    );
}

// ============ 功能限制遮罩 ============
export function PremiumFeatureGate({
    feature,
    children,
    reason = 'unlock_premium',
    variant = 'card'
}: {
    feature: string;
    children: React.ReactNode;
    reason?: string;
    variant?: 'card' | 'banner' | 'inline';
}) {
    const [showModal, setShowModal] = useState(false);
    
    // 实际应从全局状态获取
    const isPremium = false;
    const isLocked = !isPremium;

    if (!isLocked) return <>{children}</>;

    const handleClick = () => setShowModal(true);

    if (variant === 'banner') {
        return (
            <>
                <div 
                    onClick={handleClick}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl cursor-pointer hover:shadow-md transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                            <LockFilled className="text-white" />
                        </div>
                        <div>
                            <div className="font-medium text-zinc-900">解锁 {feature}</div>
                            <div className="text-xs text-zinc-500">升级专业版即可使用</div>
                        </div>
                    </div>
                    <button className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">
                        升级
                    </button>
                </div>
                <UpgradeModal open={showModal} onClose={() => setShowModal(false)} reason={reason} />
            </>
        );
    }

    if (variant === 'inline') {
        return (
            <>
                <span 
                    onClick={handleClick}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium cursor-pointer hover:bg-amber-200 transition-colors"
                >
                    <LockFilled />
                    升级解锁
                </span>
                <UpgradeModal open={showModal} onClose={() => setShowModal(false)} reason={reason} />
            </>
        );
    }

    // Default: card variant
    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleClick}
                className={clsx(
                    "relative rounded-xl border-2 border-dashed border-zinc-300 p-8 text-center cursor-pointer group overflow-hidden",
                    "hover:border-amber-400 hover:bg-amber-50/50 transition-all"
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative">
                    <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-100 transition-colors">
                        <LockFilled className="text-2xl text-zinc-400 group-hover:text-amber-500" />
                    </div>
                    <h4 className="font-bold text-zinc-700 mb-1">解锁 {feature}</h4>
                    <p className="text-sm text-zinc-500 mb-3">升级专业版，立即使用此功能</p>
                    <button className="px-6 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg font-medium text-sm">
                        立即升级
                    </button>
                    <p className="text-xs text-zinc-400 mt-2">7 天无理由退款</p>
                </div>
            </motion.div>
            
            <UpgradeModal open={showModal} onClose={() => setShowModal(false)} reason={reason} />
        </>
    );
}

// ============ 使用统计卡片 ============
export function UsageStatsCard({ stats }: { stats: Array<{ label: string; value: number | string; total?: number | string; unit?: string; icon: string }> }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <motion.div
                    key={i}
                    whileHover={{ y: -2 }}
                    className={clsx(
                        "rounded-xl p-4 border transition-all",
                        stat.total !== '∞' && typeof stat.value === 'number' && typeof stat.total === 'number' && stat.value / stat.total >= 0.8
                            ? "bg-amber-50 border-amber-200"
                            : "bg-white border-zinc-200"
                    )}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{stat.icon}</span>
                        {stat.total !== '∞' && typeof stat.value === 'number' && typeof stat.total === 'number' && stat.value >= 0.8 * stat.total && (
                            <Tooltip title="额度即将用尽，升级获取更多">
                                <ExclamationCircleOutlined className="text-amber-500" />
                            </Tooltip>
                        )}
                    </div>
                    <div className="text-2xl font-bold text-zinc-900">
                        {stat.value}{stat.unit || ''}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                        {stat.total !== '∞' ? `/ ${stat.total}${stat.unit || ''}` : stat.label}
                    </div>
                    
                    {/* 进度条 */}
                    {stat.total !== '∞' && typeof stat.value === 'number' && typeof stat.total === 'number' && (
                        <div className="mt-2 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div 
                                className={clsx(
                                    "h-full rounded-full transition-all",
                                    stat.value / stat.total >= 0.8 
                                        ? "bg-gradient-to-r from-amber-400 to-orange-500" 
                                        : "bg-gradient-to-r from-indigo-500 to-purple-500"
                                )}
                                style={{ width: `${Math.min((stat.value / stat.total) * 100, 100)}%` }}
                            />
                        </div>
                    )}
                </motion.div>
            ))}
        </div>
    );
}

// ============ 分享解锁组件 ============
export function ShareToUnlock({ onClose }: { onClose?: () => void }) {
    const [copied, setCopied] = useState(false);
    const router = useRouter();

    const shareUrl = `${window.location.origin}?ref=${Date.now()}`;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = (_platform: string) => {
        // 模拟分享成功
        Modal.success({
            title: '分享成功！',
            content: '您已获得 3 天专业版体验和 50 次额外额度！',
            onOk: () => {
                onClose?.();
            }
        });
    };

    const platforms = [
        { name: '微信', icon: '💬', color: 'bg-green-500', action: () => handleShare('wechat') },
        { name: '微博', icon: '📢', color: 'bg-red-500', action: () => handleShare('weibo') },
        { name: '复制链接', icon: '🔗', color: 'bg-zinc-500', action: handleCopy },
    ];

    return (
        <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <RocketOutlined className="text-3xl text-white" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">分享解锁</h3>
            <p className="text-sm text-zinc-500 mb-6">分享到社交平台，立即解锁 3 天专业版体验 + 50 次额外额度</p>

            <div className="flex justify-center gap-3 mb-6">
                {platforms.map((platform) => (
                    <button
                        key={platform.name}
                        onClick={platform.action}
                        className="flex flex-col items-center gap-1"
                    >
                        <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center text-xl", platform.color, "text-white")}>
                            <span>{platform.icon}</span>
                        </div>
                        <span className="text-xs text-zinc-500">{platform.name}</span>
                    </button>
                ))}
            </div>

            {copied && (
                <div className="text-green-500 text-sm mb-4">
                    ✓ 链接已复制，快去分享吧！
                </div>
            )}

            <button 
                onClick={onClose}
                className="text-zinc-400 text-sm hover:text-zinc-600"
            >
                暂不需要
            </button>
        </div>
    );
}

// ============ Subscription Hook ============
export const useSubscription = () => {
    const [subscription, setSubscription] = useState<UserSubscription>(MOCK_USER_SUB);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradeReason, setUpgradeReason] = useState('unlock_premium');
    const [showShareModal, setShowShareModal] = useState(false);

    // 从本地存储恢复
    useEffect(() => {
        const saved = localStorage.getItem('userSubscription');
        if (saved) {
            try {
                setSubscription(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse subscription:', e);
            }
        }
    }, []);

    // 保存到本地存储
    const saveSubscription = useCallback((newSub: UserSubscription) => {
        setSubscription(newSub);
        localStorage.setItem('userSubscription', JSON.stringify(newSub));
    }, []);

    const checkFeature = (feature: string): boolean => {
        if (subscription.plan === 'enterprise') return true;
        if (subscription.plan === 'pro' && feature !== 'api_access') return true;
        return false;
    };

    const requestUpgrade = (reason: string = 'unlock_premium') => {
        setUpgradeReason(reason);
        setShowUpgradeModal(true);
    };

    const requestShare = () => {
        setShowShareModal(true);
    };

    const isQuotaFull = subscription.usedQuota >= subscription.monthlyQuota;
    const usagePercentage = Math.round((subscription.usedQuota / subscription.monthlyQuota) * 100);

    // 消耗额度
    const consumeQuota = useCallback((amount: number = 1) => {
        if (subscription.plan !== 'free') return true;
        
        if (subscription.usedQuota + amount > subscription.monthlyQuota) {
            requestUpgrade('quota_exceeded');
            return false;
        }
        
        const newSub = {
            ...subscription,
            usedQuota: subscription.usedQuota + amount
        };
        saveSubscription(newSub);
        return true;
    }, [subscription, saveSubscription]);

    return {
        subscription,
        isPremium: subscription.plan !== 'free',
        plan: subscription.plan,
        checkFeature,
        requestUpgrade,
        requestShare,
        showUpgradeModal,
        setShowUpgradeModal,
        showShareModal,
        setShowShareModal,
        upgradeReason,
        isQuotaFull,
        usagePercentage,
        consumeQuota
    };
};
