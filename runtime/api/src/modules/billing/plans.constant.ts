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

export interface DomesticPlanDefinition {
  id: 'free' | 'starter' | 'pro' | 'team' | 'enterprise';
  name: string;
  priceMonthlyCny: number | null;
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

export const CN_PLANS: DomesticPlanDefinition[] = [
  {
    id: 'free',
    name: '免费版',
    priceMonthlyCny: 0,
    platformLimit: 2,
    monthlyPostQuota: 30,
    custom: false,
    features: ['2 个平台账号', '每月 30 次发布任务', '每月 20 次 AI 生成'],
  },
  {
    id: 'starter',
    name: '入门版',
    priceMonthlyCny: 49,
    platformLimit: 5,
    monthlyPostQuota: 100,
    custom: false,
    features: ['5 个平台账号', '每月 100 次发布任务', '基础发布分析'],
  },
  {
    id: 'pro',
    name: '专业版',
    priceMonthlyCny: 99,
    platformLimit: 15,
    monthlyPostQuota: 500,
    custom: false,
    features: ['15 个平台账号', '每月 500 次发布任务', '品牌语气与高级分析'],
  },
  {
    id: 'team',
    name: '团队版',
    priceMonthlyCny: 299,
    platformLimit: 30,
    monthlyPostQuota: 2000,
    custom: false,
    features: ['30 个平台账号', '每月 2,000 次发布任务', '角色、审批与共享素材'],
  },
  {
    id: 'enterprise',
    name: '企业版',
    priceMonthlyCny: null,
    platformLimit: -1,
    monthlyPostQuota: -1,
    custom: true,
    features: ['按合同约定账号与用量', 'API 与审计能力', '专属支持与服务等级'],
  },
];
