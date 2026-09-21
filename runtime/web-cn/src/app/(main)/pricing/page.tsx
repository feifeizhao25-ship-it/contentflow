'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircleFilled,
    ThunderboltFilled,
    CrownFilled,
    RocketFilled,
    SafetyCertificateOutlined,
    GiftFilled
} from '@ant-design/icons';
import { Button, Modal, QRCode, Radio, Alert, message } from 'antd';
import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import registry from '@/lib/entitlements.json';
import { buildFallbackPlans } from '@/lib/entitlements';
import { fetchCurrentUser } from '@/lib/session';
import {
    PaymentError,
    checkoutAction,
    createCheckoutOrder,
    fetchSubscriptionSnapshot,
    isAlipayReturn,
    newIdempotencyKey,
    waitForActivation,
    type PaymentMethod,
    type SubscriptionSnapshot,
} from '@/lib/payment-service';

type CheckoutState =
    | { step: 'choose' }
    | { step: 'creating' }
    | { step: 'qrcode'; orderNo: string; amount: number | null; value: string }
    | { step: 'redirecting'; orderNo: string }
    | { step: 'waiting'; orderNo?: string }
    | { step: 'done' }
    | { step: 'timeout'; orderNo?: string }
    | { step: 'error'; message: string };

const fallbackPlans = buildFallbackPlans(registry);

// 支付宝收银台是整页跳转，回来时页面已重新加载：把「买的是哪个套餐、付款前的状态」暂存在本标签页。
const PENDING_KEY = 'contentflow.pendingCheckout';
type PendingCheckout = { planId: string; orderNo: string; before: SubscriptionSnapshot | null };

function savePendingCheckout(value: PendingCheckout) {
    try {
        window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    } catch {
        // 隐私模式等：回来后按「暂未收到支付结果」处理
    }
}

function takePendingCheckout(): PendingCheckout | null {
    try {
        const raw = window.sessionStorage.getItem(PENDING_KEY);
        window.sessionStorage.removeItem(PENDING_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed.planId === 'string' ? parsed : null;
    } catch {
        return null;
    }
}

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
    }, []);

    const handleRetry = () => {
        setRetrying(true);
        void loadPlans();
    };

    // 接口与静态兜底都由同一份经过 schema 校验的权益注册表生成；接口异常时
    // 仍可完整展示套餐，不使用手写价格或临时虚构权益。
    const sourcePlans = canonicalPlans;
    const displayedPlans = sourcePlans
        .map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: isYearly ? plan.priceYearlyCny : plan.priceMonthlyCny,
        description: plan.custom ? '按团队规模与服务范围报价' : '价格与权益由服务端统一管理',
        features: (Array.isArray(plan.features) ? plan.features.map(String) : []) as string[],
        icon: plan.id === 'enterprise' ? <CrownFilled /> : plan.id === 'team' ? <SafetyCertificateOutlined /> : plan.id === 'pro' ? <ThunderboltFilled /> : <RocketFilled />,
        buttonText: plan.id === 'free' ? '免费使用' : plan.custom ? '联系商务顾问' : '立即开通',
        custom: Boolean(plan.custom),
        highlight: plan.id === 'pro',
        disabled: plan.id === 'free',
        color: plan.id === 'pro' ? 'text-indigo-500' : 'text-zinc-500',
        badge: plan.id === 'pro' ? '推荐' : undefined,
        credits: undefined as string | undefined,
    }));

    // ── 下单 ──────────────────────────────────────────────────────────
    // 原来无论是否登录，点「申请开通」一律跳登录页，登录回来还是这个按钮：没有任何路径能付款。
    const [checkoutPlan, setCheckoutPlan] = useState<{ id: string; name: string; price: number | null } | null>(null);
    const [payMethod, setPayMethod] = useState<PaymentMethod>('wechat');
    const [checkout, setCheckout] = useState<CheckoutState>({ step: 'choose' });
    const idempotencyKey = useRef<string>('');
    const baseline = useRef<SubscriptionSnapshot | null>(null);
    const poller = useRef<AbortController | null>(null);

    const stopPolling = () => {
        poller.current?.abort();
        poller.current = null;
    };
    useEffect(() => stopPolling, []);

    const goLogin = useCallback((id: string) => {
        router.push(`/login?redirect=${encodeURIComponent(`/pricing?plan=${id}`)}`);
    }, [router]);

    const startWaiting = useCallback(async (planId: string, orderNo?: string, keepScreen = false) => {
        stopPolling();
        const controller = new AbortController();
        poller.current = controller;
        if (!keepScreen) setCheckout({ step: 'waiting', orderNo });
        try {
            const before = baseline.current ?? { plan: '', renewalDate: null };
            const ok = await waitForActivation(before, planId, { signal: controller.signal });
            if (controller.signal.aborted) return;
            setCheckout(ok ? { step: 'done' } : { step: 'timeout', orderNo });
            if (ok) message.success('会员已开通');
        } catch (error) {
            if (controller.signal.aborted) return;
            setCheckout({ step: 'error', message: error instanceof Error ? error.message : '查询支付结果失败' });
        }
    }, []);

    const handlePurchase = async (id: string) => {
        const plan = displayedPlans.find((item) => item.id === id);
        if (!plan || plan.disabled) return;
        if (plan.custom) {
            message.info('企业版按团队规模报价，请联系商务顾问');
            return;
        }
        setLoadingPlan(id);
        try {
            const user = await fetchCurrentUser();
            if (!user) {
                goLogin(id);
                return;
            }
            baseline.current = await fetchSubscriptionSnapshot().catch(() => null);
            idempotencyKey.current = newIdempotencyKey();
            setCheckout({ step: 'choose' });
            setCheckoutPlan({ id: plan.id, name: plan.name, price: plan.price ?? null });
        } finally {
            setLoadingPlan(null);
        }
    };

    const confirmPayment = async () => {
        if (!checkoutPlan) return;
        setCheckout({ step: 'creating' });
        try {
            const order = await createCheckoutOrder(
                { planId: checkoutPlan.id, billingCycle: isYearly ? 'yearly' : 'monthly', paymentMethod: payMethod },
                idempotencyKey.current,
            );
            const action = checkoutAction(order);
            if (action.kind === 'redirect') {
                setCheckout({ step: 'redirecting', orderNo: order.orderNo });
                savePendingCheckout({ planId: checkoutPlan.id, orderNo: order.orderNo, before: baseline.current });
                window.location.href = action.url;
                return;
            }
            if (action.kind === 'duplicate') {
                void startWaiting(checkoutPlan.id, order.orderNo);
                return;
            }
            // 二维码一直显示，后台轮询到账后再切到「已开通」
            setCheckout({ step: 'qrcode', orderNo: order.orderNo, amount: order.amount, value: action.value });
            void startWaiting(checkoutPlan.id, order.orderNo, true);
        } catch (error) {
            if (error instanceof PaymentError && error.status === 401) {
                goLogin(checkoutPlan.id);
                return;
            }
            setCheckout({ step: 'error', message: error instanceof Error ? error.message : '下单失败，请稍后重试' });
        }
    };

    const closeCheckout = () => {
        stopPolling();
        setCheckoutPlan(null);
        setCheckout({ step: 'choose' });
    };

    // 登录后回到 /pricing?plan=xxx：直接打开该套餐的付款窗口。
    // 支付宝付款后回到 ALIPAY_RETURN_URL（/pricing?out_trade_no=…）：等后端收到签名通知。
    const resumed = useRef(false);
    useEffect(() => {
        if (resumed.current || !plansLoaded) return;
        resumed.current = true;
        if (isAlipayReturn(searchParams)) {
            const pending = takePendingCheckout();
            const orderNo = searchParams.get('out_trade_no') || undefined;
            const plan = pending ? displayedPlans.find((item) => item.id === pending.planId) : undefined;
            setCheckoutPlan({ id: pending?.planId ?? '', name: plan?.name ?? '会员', price: null });
            if (!pending || (pending.orderNo && orderNo && pending.orderNo !== orderNo)) {
                // 换了浏览器或会话：不知道买的是哪个套餐，只能请用户稍后看结果
                setCheckout({ step: 'timeout', orderNo });
                return;
            }
            baseline.current = pending.before ?? { plan: '', renewalDate: null };
            void startWaiting(pending.planId, orderNo);
            return;
        }
        const wanted = searchParams.get('plan');
        if (wanted) void handlePurchase(wanted);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plansLoaded]);

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
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">会员方案</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 text-zinc-900 dark:text-white">
                            释放无限<br className="md:hidden" />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"> 创作潜能</span>
                        </h1>
                        <p className="text-xl text-zinc-500 dark:text-zinc-400 font-medium max-w-2xl mx-auto leading-relaxed">
                            根据账号数量、发布频次和团队规模，选择适合你的会员方案。<br className="hidden md:block" />
                            各项额度独立计算，付款前请确认价格、有效期和服务范围。
                        </p>
                    </motion.div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch mb-20">
                    {plansFailed && (
                        <div className="col-span-full rounded-2xl border border-amber-200 bg-amber-50 p-5 flex flex-col sm:flex-row items-center justify-center gap-4 text-amber-800">
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
                                    ? "bg-white dark:bg-zinc-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 z-10"
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

                </div>

                <Modal
                    open={checkoutPlan !== null}
                    onCancel={closeCheckout}
                    footer={null}
                    title={checkoutPlan ? `开通${checkoutPlan.name}` : ''}
                    destroyOnClose
                >
                    {checkout.step === 'choose' || checkout.step === 'creating' ? (
                        <div className="space-y-5">
                            {checkoutPlan?.price != null && (
                                <p className="text-zinc-600">应付金额以订单为准：<span className="text-2xl font-black">¥{checkoutPlan.price}</span> / 月</p>
                            )}
                            <Radio.Group value={payMethod} onChange={(e) => setPayMethod(e.target.value)} disabled={checkout.step === 'creating'}>
                                <Radio.Button value="wechat">微信支付</Radio.Button>
                                <Radio.Button value="alipay">支付宝</Radio.Button>
                            </Radio.Group>
                            <p className="text-xs text-zinc-400">
                                只有工作区所有者或管理员可以购买。付款成功后由支付平台通知服务端开通，通常几秒内到账。
                            </p>
                            <Button type="primary" block size="large" loading={checkout.step === 'creating'} onClick={confirmPayment}>
                                确认并支付
                            </Button>
                        </div>
                    ) : checkout.step === 'qrcode' ? (
                        <div className="flex flex-col items-center gap-4">
                            <QRCode value={checkout.value} size={200} />
                            <p className="text-zinc-600">请用微信扫码支付{checkout.amount != null ? ` ¥${checkout.amount}` : ''}</p>
                            <p className="text-xs text-zinc-400">订单号 {checkout.orderNo} · 支付完成后本窗口会自动更新</p>
                        </div>
                    ) : checkout.step === 'redirecting' ? (
                        <p className="text-zinc-600">正在前往支付宝收银台…</p>
                    ) : checkout.step === 'waiting' ? (
                        <div className="space-y-2">
                            <p className="text-zinc-600">正在确认支付结果，请稍候…</p>
                            {checkout.orderNo && <p className="text-xs text-zinc-400">订单号 {checkout.orderNo}</p>}
                        </div>
                    ) : checkout.step === 'done' ? (
                        <div className="space-y-4">
                            <Alert type="success" showIcon message="会员已开通" />
                            <Button block onClick={() => { closeCheckout(); router.push('/dashboard'); }}>开始使用</Button>
                        </div>
                    ) : checkout.step === 'timeout' ? (
                        <Alert
                            type="warning"
                            showIcon
                            message="暂未收到支付结果"
                            description={`如果已经付款，权益会在支付平台通知到达后自动开通，请稍后刷新本页。${checkout.orderNo ? `如有疑问请提供订单号 ${checkout.orderNo}。` : ''}`}
                        />
                    ) : (
                        <div className="space-y-4">
                            <Alert type="error" showIcon message="未能下单" description={checkout.message} />
                            <Button block onClick={() => { idempotencyKey.current = newIdempotencyKey(); setCheckout({ step: 'choose' }); }}>重新选择</Button>
                        </div>
                    )}
                </Modal>

                {/* FAQ Section */}
                <div className="max-w-4xl mx-auto mb-20">
                    <h2 className="text-2xl font-black text-center mb-12">常见问题</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                        {[
                            { q: '会员所有功能都不限量吗？', a: '不是。账号、发布和生成等额度分别计算，以所选套餐的各项说明为准。' },
                            { q: '需要发票怎么办？', a: '请在付款前向服务方确认开票种类、所需信息和办理方式。' },
                            { q: '任务失败或扣费异常怎么办？', a: '请保留任务编号和订单号，核对账户记录并联系支持人员处理。退款结果以实际账单为准。' },
                            { q: '套餐变更何时生效？', a: '请在确认订单前核对生效时间、有效期和应付金额。已购权益按照原订单约定处理。' }
                        ].map((item, i) => (
                            <div key={i}>
                                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <span className="text-indigo-500">问</span> {item.q}
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
                        <span>付款前请核对订单信息与服务条款</span>
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
