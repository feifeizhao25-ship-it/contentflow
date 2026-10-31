// 订阅套餐定义 — 代码侧唯一事实源（CN 与 INT 分开定义，文档以本文件为准回写）。
// platformLimit / monthlyPostQuota 为 -1 表示不限(仅国际 Enterprise 定制档)。
export interface PlanDefinition {
  id: 'free' | 'starter' | 'pro' | 'team' | 'enterprise';
  name: string;
  priceMonthlyUsd: number | null; // null = 定制报价
  platformLimit: number;
  monthlyPostQuota: number;
  aiTokenQuota: number;
  custom: boolean;
  features: string[];
}

export interface ChinaPlanDefinition {
  /** 批1：额度口径确认状态。unconfirmed=推算值、未经负责人确认，对外展示必须带说明，不得冒充已承诺额度 */
  quotaStatus?: 'confirmed' | 'unconfirmed';
  memberLimit?: number;
  storageGb?: number;
  id: 'free' | 'pro' | 'team' | 'enterprise';
  name: string;
  priceMonthlyCny: number | null;
  priceYearlyCny: number | null;
  platformLimit: number;
  monthlyPostQuota: number;
  aiTokenQuota: number;
  custom: boolean;
  features: string[];
}

// 历史人民币套餐，只用于已创建且无快照的旧订单。
export const LEGACY_CN_PLANS: ChinaPlanDefinition[] = [
  {
    id: 'free', name: '免费版', priceMonthlyCny: 0, priceYearlyCny: 0,
    platformLimit: 3, monthlyPostQuota: 30, aiTokenQuota: 50000, custom: false,
    features: ['3个平台账号', '每月30条发布', '每月5万AI令牌'],
  },
  {
    id: 'pro', name: '专业版', priceMonthlyCny: 128, priceYearlyCny: 1280,
    platformLimit: 10, monthlyPostQuota: 500, aiTokenQuota: 2500000, custom: false,
    features: ['10个平台账号', '每月500条发布', '每月250万AI令牌'],
  },
  {
    id: 'team', name: '团队版', priceMonthlyCny: 699, priceYearlyCny: 6990,
    platformLimit: 30, monthlyPostQuota: 2000, aiTokenQuota: 10000000, custom: false,
    features: ['30个平台账号', '团队协作与审批', '每月1000万AI令牌'],
  },
  {
    id: 'enterprise', name: '企业版', priceMonthlyCny: null, priceYearlyCny: null,
    platformLimit: -1, monthlyPostQuota: -1, aiTokenQuota: -1, custom: true,
    features: ['按工作区和账号规模报价', '操作审计', '专属支持与私有化选项'],
  },
];

// 2026-09-01 已批准定价。档名按 0S1 统一为个人版 / 团队版 / 商务版（分D04）。
// 商务版的 AI 令牌按价格比例为团队版的 4 倍（4000 万/月），平台账号上限 100。
// 这两项是内部安全上限（避免误继承「不限」或与团队版同额），2026-10-16 起仍待负责人确认，
// 不是对客户的承诺。对外展示走 presentChinaPlan，不输出这些数字。
// 旧订单使用下单快照或 LEGACY_CN_PLANS，禁止重定价。
export const CN_PLAN_VERSION = '2026-09-01';
export const CN_PLANS: ChinaPlanDefinition[] = LEGACY_CN_PLANS.map((plan) => {
  const updates: Record<string, Partial<ChinaPlanDefinition>> = {
    free: { memberLimit: 1, storageGb: 1, platformLimit: 1, monthlyPostQuota: 5, features: ['1个平台账号', '每月5条发布', '人工智能生成内容标识'] },
    pro: { name: '个人版', memberLimit: 1, storageGb: 5, priceMonthlyCny: 99, priceYearlyCny: 990, monthlyPostQuota: 200, features: ['10个平台账号', '每月200条发布', '内容日历与排期'] },
    team: { name: '团队版', memberLimit: 5, storageGb: 50, priceMonthlyCny: 499, priceYearlyCny: 4990, monthlyPostQuota: 1000, features: ['30个平台账号', '团队协作与审批', '每月1000条发布'] },
    enterprise: { name: '商务版', quotaStatus: 'unconfirmed', memberLimit: 20, storageGb: -1, priceMonthlyCny: 1999, priceYearlyCny: 19990, custom: false, monthlyPostQuota: 5000, aiTokenQuota: 40000000, platformLimit: 100, features: ['发布额度待确认', '操作审计', '团队协作与审批'] },
  };
  return { ...plan, ...updates[plan.id] };
});

export type PublicChinaPlan = Omit<ChinaPlanDefinition, 'aiTokenQuota' | 'platformLimit' | 'monthlyPostQuota'> & {
  aiTokenQuota: number | null;
  platformLimit: number | null;
  monthlyPostQuota: number | null;
  quotaNote?: string;
};

/** 给定价接口和页面的国内套餐。未确认额度不带具体数字。 */
export function presentChinaPlan(plan: ChinaPlanDefinition): PublicChinaPlan {
  if (plan.quotaStatus !== 'unconfirmed') return plan;
  return {
    ...plan,
    aiTokenQuota: null,
    platformLimit: null,
    monthlyPostQuota: null,
    features: plan.features.map((feature) => (/\d/.test(feature) ? '发布额度待确认' : feature)),
    quotaNote: 'AI 令牌额度、发布条数与平台账号上限待确认，确认前不构成承诺',
  };
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthlyUsd: 0,
    platformLimit: 3,
    monthlyPostQuota: 10,
    aiTokenQuota: 50000,
    custom: false,
    features: ['3 platform accounts', '10 posts per month', '50K AI tokens per month'],
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthlyUsd: 29,
    platformLimit: 5,
    monthlyPostQuota: 100,
    aiTokenQuota: 500000,
    custom: false,
    features: ['5 platform accounts', '100 posts per month', '500K AI tokens per month'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthlyUsd: 99,
    platformLimit: 15,
    monthlyPostQuota: 500,
    aiTokenQuota: 2500000,
    custom: false,
    features: ['15 platform accounts', '500 posts per month', '2.5M AI tokens per month'],
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthlyUsd: 299,
    platformLimit: 30,
    monthlyPostQuota: 2000,
    aiTokenQuota: 10000000,
    custom: false,
    features: ['30 platform accounts', '2000 posts per month', '10M AI tokens per month'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthlyUsd: null,
    platformLimit: -1,
    monthlyPostQuota: -1,
    aiTokenQuota: -1,
    custom: true,
    features: ['Custom platform and volume limits', 'API access', 'Dedicated support'],
  },
];
