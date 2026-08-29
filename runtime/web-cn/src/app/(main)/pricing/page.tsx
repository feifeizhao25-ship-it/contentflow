'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircleFilled,
    ThunderboltFilled,
    CrownFilled,
    RocketFilled,
    LoadingOutlined,
    SafetyCertificateOutlined,
    PlusCircleFilled,
    FireFilled,
    VideoCameraFilled,
    GiftFilled,
    ArrowRightOutlined
} from '@ant-design/icons';
import { Tabs, Statistic, Card, Button, Badge } from 'antd';
import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import registry from '@/lib/entitlements.json';
import { buildFallbackPlans } from '@/lib/entitlements';

const fallbackPlans = buildFallbackPlans(registry);

function PricingContent() {
    const searchParams = useSearchParams();
    const initialTab = searchParams.get('tab') || 'plans';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isYearly] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [canonicalPlans, setCanonicalPlans] = useState<any[]>(fallbackPlans);
    const [plansLoaded, setPlansLoaded] = useState(false);
    const [plansFailed, setPlansFailed] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams, activeTab]);

    const loadPlans = async () => {
        try {
            const response = await fetch('/api/v1/billing/plans?market=cn', { cache: 'no-store' });
            const envelope = await response.json();
            if (!response.ok) throw new Error(envelope?.message || '套餐加载失败');
            const payload = envelope?.data ?? envelope;
            if (!Array.isArray(payload?.plans)) throw new Error('套餐数据格式错误');
            setCanonicalPlans(payload.plans);
            setPlansFailed(false);
        } catch (error) {
            // 解析/网络错误的原文（如 Unexpected token ...）只允许进控制台，不上屏。
            console.error('价格接口加载失败:', error);
            setCanonicalPlans(fallbackPlans);
            setPlansFailed(true);
        } finally {
            setPlansLoaded(true);
            setRetrying(false);
        }
    };

    useEffect(() => {
        void loadPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRetry = () => {
        setRetrying(true);
        void loadPlans();
    };

    // 接口与静态兜底都由同一份经过 schema 校验的权益注册表生成；接口异常时
    // 仍可完整展示套餐，不使用手写价格或临时虚构权益。
    const sourcePlans = canonicalPlans;
    const displayedPlans = sourcePlans
        .filter((plan) => plan.id !== 'enterprise')
        .map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: isYearly ? plan.priceYearlyCny : plan.priceMonthlyCny,
        description: plan.custom ? '按团队规模与服务范围报价' : '价格与权益由服务端统一管理',
        features: (Array.isArray(plan.features) ? plan.features.map(String) : []) as string[],
        icon: plan.id === 'enterprise' ? <CrownFilled /> : plan.id === 'team' ? <SafetyCertificateOutlined /> : plan.id === 'pro' ? <ThunderboltFilled /> : <RocketFilled />,
        buttonText: plan.id === 'free' ? '免费使用' : plan.custom ? '联系商务顾问' : '申请开通',
        highlight: plan.id === 'pro',
        disabled: plan.id === 'free',
        color: plan.id === 'pro' ? 'text-indigo-500' : 'text-zinc-500',
        badge: plan.id === 'pro' ? '推荐' : undefined,
        credits: undefined as string | undefined,
    }));

    const handlePurchase = (id: string) => {
        setLoadingPlan(id);
        router.push(`/login?redirect=${encodeURIComponent(`/pricing?plan=${id}`)}`);
    };

    return (
        <div className="min-h-screen pb-24 relative overflow-hidden">
            {/* Dynamic Background */}
            <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-indigo-950/20 pointer-events-none -z-10" />
            <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />
            <div className="absolute top-[100px] left-[-200px] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

            <div className="max-w-7xl mx-auto px-4 pt-20">
                {/* Hero Section */}
                <div className="text-center mb-20">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">早鸟优惠</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 text-zinc-900 dark:text-white">
                            释放无限<br className="md:hidden" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"> 创作潜能</span>
                        </h1>
                        <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed">
                            采用「会员订阅 + 灵活积分」模式，让每一分预算都花在刀刃上。<br className="hidden md:block" />
                            无论是个人博主还是 MCN 机构，都能找到最适合的方案。
                        </p>
                    </motion.div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start mb-32">
                    {plansFailed && (
                        <div className="md:col-span-2 lg:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row items-center justify-center gap-4 text-amber-800">
                            <span>价格信息加载失败，请稍后重试。当前展示经校验的会员权益注册表，支付前会再次确认实时价格。</span>
                            <Button onClick={handleRetry} loading={retrying} className="shrink-0">
                                重试
                            </Button>
                        </div>
                    )}
                    {displayedPlans.map((plan) => (
                        <motion.div
                            key={plan.id}
                            whileHover={{ y: -8 }}
                            className={clsx(
                                "relative rounded-[2.5rem] p-8 h-full flex flex-col transition-all duration-300",
                                plan.highlight
                                    ? "bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 z-10 scale-105"
                                    : "bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-900"
                            )}
                        >
                            {plan.badge && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                    {plan.badge}
                                </div>
                            )}

                            <div className="mb-8">
                                <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6", plan.highlight ? "bg-indigo-50 text-indigo-600" : "bg-zinc-100 text-zinc-500")}>
                                    {plan.icon}
                                </div>
                                <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                                <p className="text-zinc-500 text-sm font-medium h-10">{plan.description}</p>
                            </div>

                            <div className="mb-8 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black tracking-tight">{plan.price == null ? '按需报价' : `¥${plan.price}`}</span>
                                    <span className="text-zinc-400 font-medium">/月</span>
                                </div>
                                {plan.credits && (
                                    <div className="mt-2 text-xs font-bold text-indigo-600 flex items-center gap-1">
                                        <GiftFilled /> 包含 {plan.credits}
                                    </div>
                                )}
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {plan.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                                        <CheckCircleFilled className={clsx("mt-0.5", plan.highlight ? "text-indigo-500" : "text-zinc-300")} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <Button
                                type="primary"
                                block
                                size="large"
                                onClick={() => handlePurchase(plan.id)}
                                loading={loadingPlan === plan.id}
                                disabled={plan.disabled}
                                className={clsx(
                                    "h-14 rounded-xl font-bold text-base border-none",
                                    plan.highlight
                                        ? "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-xl shadow-indigo-500/10"
                                        : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                                )}
                            >
                                {loadingPlan === plan.id ? '处理中...' : plan.buttonText}
                            </Button>
                        </motion.div>
                    ))}

                    {/* Enterprise Card */}
                    <div className="rounded-[2.5rem] p-10 bg-gradient-to-br from-indigo-900 to-purple-900 text-white border border-indigo-700/50 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-2xl flex items-center justify-center text-amber-400 text-2xl mb-6">
                                    <CrownFilled />
                                </div>
                                <h3 className="text-2xl font-black mb-4">企业定制版</h3>
                                <p className="text-indigo-200 text-sm leading-relaxed mb-8">
                                    为 MCN 机构及大型内容团队打造。
                                    提供私有化模型训练、API 独享速率、以及专属客户经理。
                                </p>
                                <ul className="space-y-4 mb-8">
                                    {['多租户权限隔离', '私有知识库部署', 'SLA 服务保障', '对公转账支持'].map((f, i) => (
                                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-indigo-100">
                                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]"><CheckCircleFilled /></div>
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <Button block size="large" ghost onClick={() => router.push('/login?redirect=%2Fpricing%3Fplan%3Denterprise')} className="h-14 rounded-xl font-bold border-white/20 hover:bg-white/10 hover:border-white/40 text-white">
                                联系商务顾问 <ArrowRightOutlined />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="max-w-4xl mx-auto mb-20">
                    <h2 className="text-2xl font-black text-center mb-12">常见问题</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                        {[
                            { q: '会员积分与充值积分有何区别？', a: '会员每月赠送的积分当月有效，过期清零；单独购买的充值积分包永久有效，用完为止。' },
                            { q: '可以开具发票吗？', a: '支持。购买后可在「我的订单」中申请开具增值税电子普通发票，企业版支持专票。' },
                            { q: '生成失败会扣积分吗？', a: '不会。如果因系统原因导致任务失败，积分将自动原路退回至您的账户。' },
                            { q: '如何升级或降级套餐？', a: '您可以随时在当前周期结束后切换套餐。升级套餐将立即生效并补差价。' }
                        ].map((item, i) => (
                            <div key={i}>
                                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <span className="text-indigo-500">Q.</span> {item.q}
                                </h4>
                                <p className="text-zinc-500 text-sm leading-relaxed">{item.a}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trust Footer */}
                <div className="text-center pb-8 border-t border-zinc-100 dark:border-zinc-800 pt-8">
                    <div className="inline-flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                        <SafetyCertificateOutlined className="text-emerald-500 text-lg" />
                        <span>企业级安全保障 · 256 位 SSL 加密</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function PricingPage() {
    return (
        <React.Suspense fallback={<div className="p-20 text-center text-zinc-400">正在加载价格信息…</div>}>
            <PricingContent />
        </React.Suspense>
    );
}
