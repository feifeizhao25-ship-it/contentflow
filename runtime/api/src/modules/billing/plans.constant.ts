// 订阅套餐定义 — 国际版五档定价(唯一权威来源)
// platformLimit / monthlyPostQuota 为 -1 表示不限(Enterprise 定制)
export interface PlanDefinition {
  id: 'free' | 'starter' | 'pro' | 'team' | 'enterprise';
  name: string;
  priceMonthlyUsd: number | null; // null = 定制报价
  platformLimit: number;
  monthlyPostQuota: number;
  custom: boolean;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    priceMonthlyUsd: 0,
    platformLimit: 3,
    monthlyPostQuota: 10,
    custom: false,
    features: ['3 platform accounts', '10 posts per month'],
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthlyUsd: 29,
    platformLimit: 5,
    monthlyPostQuota: 100,
    custom: false,
    features: ['5 platform accounts', '100 posts per month'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthlyUsd: 99,
    platformLimit: 15,
    monthlyPostQuota: 500,
    custom: false,
    features: ['15 platform accounts', '500 posts per month'],
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthlyUsd: 299,
    platformLimit: 30,
    monthlyPostQuota: 2000,
    custom: false,
    features: ['30 platform accounts', '2000 posts per month'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthlyUsd: null,
    platformLimit: -1,
    monthlyPostQuota: -1,
    custom: true,
    features: ['Custom platform and volume limits', 'API access', 'Dedicated support'],
  },
];
