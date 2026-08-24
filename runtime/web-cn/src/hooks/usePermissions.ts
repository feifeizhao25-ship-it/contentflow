import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api-client';

export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export interface UserSubscription {
    plan: SubscriptionPlan;
    monthly_quota: number;
    used_quota: number;
    renewal_date: string;
    storage_limit: number;
}

export interface UserPoints {
    balance: number;
    total_earned: number;
    level: number;
    experience_points: number;
}

// 免费版限制
const FREE_LIMITS = {
    monthly_quota: 20,
    storage_bytes: 1024 * 1024 * 1024, // 1GB
    max_platforms: 2,
    batch_generations: 3,
};

// Pro 版限制
const PRO_LIMITS = {
    monthly_quota: 200,
    storage_bytes: 10 * 1024 * 1024 * 1024, // 10GB
    max_platforms: 10,
    batch_generations: 30,
};

// 企业版限制
const ENTERPRISE_LIMITS = {
    monthly_quota: -1, // 无限
    storage_bytes: 100 * 1024 * 1024 * 1024, // 100GB
    max_platforms: -1, // 无限
    batch_generations: -1, // 无限
};

// 默认免费版限制
const getLimits = (plan: SubscriptionPlan) => {
    switch (plan) {
        case 'pro': return PRO_LIMITS;
        case 'enterprise': return ENTERPRISE_LIMITS;
        default: return FREE_LIMITS;
    }
};

export function usePermissions() {
    const [subscription, setSubscription] = useState<UserSubscription | null>(null);
    const [points, setPoints] = useState<UserPoints | null>(null);
    const [loading, setLoading] = useState(true);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradeReason, setUpgradeReason] = useState<string>('unlock_premium');

    // 获取用户订阅状态
    const fetchSubscription = useCallback(async (_userId: string) => {
        try {
            const envelope = await apiClient.get<any>('/billing/subscription');
            const data = envelope?.data ?? envelope;
            return {
                plan: (data?.plan ?? 'free') as SubscriptionPlan,
                monthly_quota: Number(data?.monthlyQuota ?? 0),
                used_quota: Number(data?.usedQuota ?? 0),
                renewal_date: data?.renewalDate ?? '',
                storage_limit: Number(data?.limits?.max_storage_gb ?? 0) * 1024 * 1024 * 1024,
            };
        } catch (error) {
            console.error('Error fetching subscription:', error);
            // 权益服务不可用时保持最小权限；不生成虚构续费日期或额度。
            return {
                plan: 'free' as SubscriptionPlan,
                monthly_quota: 0,
                used_quota: 0,
                renewal_date: '',
                storage_limit: 0,
            };
        }
    }, []);

    // 获取用户积分
    const fetchPoints = useCallback(async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_points')
                .select('balance, total_earned, level, experience_points')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                return { balance: 0, total_earned: 0, level: 1, experience_points: 0 };
            }

            return data;
        } catch (error) {
            console.error('Error fetching points:', error);
            return null;
        }
    }, []);

    // 初始化
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    const [sub, pts] = await Promise.all([
                        fetchSubscription(user.id),
                        fetchPoints(user.id)
                    ]);
                    setSubscription(sub);
                    setPoints(pts);
                }
            } catch (error) {
                console.error('Error initializing permissions:', error);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [fetchSubscription, fetchPoints]);

    // 刷新数据
    const refresh = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const [sub, pts] = await Promise.all([
                fetchSubscription(user.id),
                fetchPoints(user.id)
            ]);
            setSubscription(sub);
            setPoints(pts);
        }
    }, [fetchSubscription, fetchPoints]);

    // 检查功能是否可用
    const canUse = useCallback((feature: 'ai_generate' | 'batch_generate' | 'high_quality_image' | 'api_access' | 'multi_platform' | 'storage'): { allowed: boolean; reason?: string } => {
        const plan = subscription?.plan || 'free';
        const limits = getLimits(plan);

        switch (feature) {
            case 'ai_generate':
                if (subscription && subscription.used_quota >= subscription.monthly_quota) {
                    return { allowed: false, reason: 'quota_exceeded' };
                }
                return { allowed: true };
            
            case 'batch_generate':
                if (plan === 'free' && limits.batch_generations <= 0) {
                    return { allowed: false, reason: 'unlock_premium' };
                }
                return { allowed: true };
            
            case 'high_quality_image':
                if (plan === 'free') {
                    return { allowed: false, reason: 'high_quality_image' };
                }
                return { allowed: true };
            
            case 'api_access':
                if (plan !== 'enterprise') {
                    return { allowed: false, reason: 'api_access' };
                }
                return { allowed: true };
            
            case 'multi_platform':
                if (plan === 'free' && limits.max_platforms <= 2) {
                    return { allowed: false, reason: 'more_accounts' };
                }
                return { allowed: true };
            
            case 'storage':
                // 存储限制检查由后端处理
                return { allowed: true };
            
            default:
                return { allowed: true };
        }
    }, [subscription]);

    // 消耗额度
    const consumeQuota = useCallback(async (amount: number = 1): Promise<boolean> => {
        if (!subscription) return false;
        
        if (subscription.plan !== 'free') return true; // Pro+ 不限制
        
        if (subscription.used_quota + amount > subscription.monthly_quota) {
            setUpgradeReason('quota_exceeded');
            setShowUpgradeModal(true);
            return false;
        }

        // 这里只做体验层预检。真实扣减必须由执行任务的后端事务完成，
        // 浏览器没有修改订阅或用量数据的权限。
        return true;
    }, [subscription]);

    // 请求升级
    const requestUpgrade = useCallback((reason: string = 'unlock_premium') => {
        setUpgradeReason(reason);
        setShowUpgradeModal(true);
    }, []);

    // 获取使用量百分比
    const usagePercentage = useCallback(() => {
        if (!subscription || subscription.plan !== 'free') return 0;
        return Math.round((subscription.used_quota / subscription.monthly_quota) * 100);
    }, [subscription]);

    // 获取剩余额度
    const remainingQuota = useCallback(() => {
        if (!subscription || subscription.plan !== 'free') return -1;
        return Math.max(0, subscription.monthly_quota - subscription.used_quota);
    }, [subscription]);

    // 是否为付费用户
    const isPremium = subscription?.plan === 'pro' || subscription?.plan === 'enterprise';

    return {
        subscription,
        points,
        loading,
        isPremium,
        plan: subscription?.plan || 'free',
        limits: getLimits(subscription?.plan || 'free'),
        showUpgradeModal,
        upgradeReason,
        setShowUpgradeModal,
        canUse,
        consumeQuota,
        requestUpgrade,
        refresh,
        usagePercentage,
        remainingQuota,
    };
}

// 简化版 Hook - 仅检查登录状态
export function useAuthCheck() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const check = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsAuthenticated(!!session);
            setLoading(false);
        };

        check();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session);
        });

        return () => subscription.unsubscribe();
    }, []);

    return { isAuthenticated, loading };
}
