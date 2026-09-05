// 订阅套餐定义 — 国际版五档定价(唯一权威来源)
// platformLimit / monthlyPostQuota 为 -1 表示不限(Enterprise 定制)
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

// 2026-09-01 已批准定价；旧订单使用下单快照或 LEGACY_CN_PLANS，禁止重定价。
export const CN_PLAN_VERSION = '2026-09-01';
export const CN_PLANS: ChinaPlanDefinition[] = LEGACY_CN_PLANS.map((plan) => {
  const updates: Record<string, Partial<ChinaPlanDefinition>> = {
    free: { memberLimit: 1, storageGb: 1, platformLimit: 1, monthlyPostQuota: 5, features: ['1个平台账号', '每月5条发布', '人工智能生成内容标识'] },
    pro: { memberLimit: 1, storageGb: 5, priceMonthlyCny: 99, priceYearlyCny: 990, monthlyPostQuota: 200, features: ['10个平台账号', '每月200条发布', '内容日历与排期'] },
    team: { memberLimit: 5, storageGb: 50, priceMonthlyCny: 499, priceYearlyCny: 4990, monthlyPostQuota: 1000, features: ['30个平台账号', '团队协作与审批', '每月1000条发布'] },
    enterprise: { memberLimit: 20, storageGb: -1, priceMonthlyCny: 1999, priceYearlyCny: 19990, custom: false, monthlyPostQuota: 5000, aiTokenQuota: 10000000, features: ['每月5000条发布', '操作审计', '团队协作与审批'] },
  };
  return { ...plan, ...updates[plan.id] };
});

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
