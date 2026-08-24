import type { ContentDomain, TargetPlatform } from '@/store/onboardingStore';

// 会员套餐
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  duration: number; // 天数
  features: string[];
  popular?: boolean;
}

// 会员状态
export interface UserSubscription {
  planId: string;
  status: 'active' | 'expired' | 'cancelled' | 'trial';
  startAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
}

// 支付方式
export type PaymentMethod = 'wechat' | 'alipay' | 'credit_card';

// 支付请求
export interface PaymentRequest {
  userId: string;
  planId: string;
  paymentMethod: PaymentMethod;
  amount: number;
}

// 支付结果
export interface PaymentResult {
  success: boolean;
  orderId?: string;
  transactionId?: string;
  message?: string;
}

// 会员套餐列表
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: '月度会员',
    description: '适合短期体验',
    price: 29.9,
    originalPrice: 49.9,
    duration: 30,
    features: [
      '无限脚本生成',
      '无限视频生成',
      '1080P视频导出',
      '基础素材库',
      '客服支持',
    ],
  },
  {
    id: 'quarterly',
    name: '季度会员',
    description: '最受欢迎的选择',
    price: 79.9,
    originalPrice: 129.9,
    duration: 90,
    features: [
      '无限脚本生成',
      '无限视频生成',
      '1080P视频导出',
      '高级素材库',
      '优先客服支持',
      '专属模板',
    ],
    popular: true,
  },
  {
    id: 'yearly',
    name: '年度会员',
    description: '性价比最高',
    price: 299,
    originalPrice: 599,
    duration: 365,
    features: [
      '无限脚本生成',
      '无限视频生成',
      '4K视频导出',
      '全素材库访问',
      '24小时客服支持',
      '专属模板',
      'API调用权限',
      '团队协作功能',
    ],
  },
  {
    id: 'lifetime',
    name: '终身会员',
    description: '一次购买，永久使用',
    price: 999,
    duration: -1, // 永久
    features: [
      '所有年度会员功能',
      '未来新功能免费',
      '专属客户经理',
      '定制化服务',
      'API调用无限额',
    ],
  },
];

// 免费试用配置
export const TRIAL_CONFIG = {
  duration: 3, // 3天
  features: ['无限脚本生成', '720P视频导出', '基础素材库'],
};

// 创建支付订单
export async function createPaymentOrder(request: PaymentRequest): Promise<PaymentResult> {
  const { userId, planId, paymentMethod, amount } = request;

  // 生成订单ID
  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // TODO: 集成真实支付网关
  // 微信支付、支付宝、Stripe等

  console.log(`[Payment] Creating order: ${orderId} for user ${userId}`);
  console.log(`[Payment] Plan: ${planId}, Amount: ${amount}, Method: ${paymentMethod}`);

  return {
    success: true,
    orderId,
    message: '订单创建成功，请完成支付',
  };
}

// 验证支付
export async function verifyPayment(orderId: string): Promise<PaymentResult> {
  // TODO: 调用支付网关验证

  return {
    success: true,
    orderId,
    transactionId: `txn_${Date.now()}`,
    message: '支付验证成功',
  };
}

// 获取用户订阅状态
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  // TODO: 从数据库查询

  // 模拟返回
  return null;
}

// 开通订阅
export async function activateSubscription(
  userId: string,
  planId: string,
  paymentMethod?: PaymentMethod
): Promise<UserSubscription> {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
  if (!plan) {
    throw new Error('无效的套餐');
  }

  const now = new Date();
  const expiresAt = plan.duration === -1
    ? new Date('2099-12-31') // 永久会员
    : new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);

  const subscription: UserSubscription = {
    planId,
    status: 'active',
    startAt: now,
    expiresAt,
    autoRenew: plan.duration !== -1,
  };

  // TODO: 保存到数据库

  console.log(`[Subscription] Activated ${plan.name} for user ${userId}`);

  return subscription;
}

// 取消订阅
export async function cancelSubscription(userId: string): Promise<boolean> {
  // TODO: 处理取消逻辑

  console.log(`[Subscription] Cancelled for user ${userId}`);
  return true;
}

// 检查用户是否有有效订阅
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return false;

  if (subscription.status !== 'active') return false;

  // 检查是否过期
  if (new Date() > subscription.expiresAt) return false;

  return true;
}

// 开通试用
export async function activateTrial(userId: string): Promise<UserSubscription> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRIAL_CONFIG.duration * 24 * 60 * 60 * 1000);

  const subscription: UserSubscription = {
    planId: 'trial',
    status: 'trial',
    startAt: now,
    expiresAt,
    autoRenew: false,
  };

  console.log(`[Trial] Activated ${TRIAL_CONFIG.duration} day trial for user ${userId}`);

  return subscription;
}

// 计算套餐性价比
export function calculateValue(plan: SubscriptionPlan): number {
  const dailyPrice = plan.price / plan.duration;
  const baseDailyPrice = 1; // 基准：1元/天
  return (baseDailyPrice / dailyPrice) * 100;
}

// 获取推荐套餐
export function getRecommendedPlan(): SubscriptionPlan {
  return SUBSCRIPTION_PLANS.find(p => p.popular) || SUBSCRIPTION_PLANS[1];
}

// 套餐特色功能
export const PLAN_FEATURES = {
  basic: [
    '每日3个脚本',
    '每日1个视频',
    '720P导出',
  ],
  monthly: [
    '无限脚本',
    '无限视频',
    '1080P导出',
    '基础素材库',
  ],
  quarterly: [
    '无限脚本',
    '无限视频',
    '1080P导出',
    '高级素材库',
    '优先支持',
  ],
  yearly: [
    '无限脚本',
    '无限视频',
    '4K导出',
    '全素材库',
    '24h支持',
    'API权限',
  ],
};

// ========== 兼容性导出 (Compatibility Exports) ==========

export const createSubscription = activateSubscription;

export async function purchaseCredits(userId: string, packId: string) {
  console.log(`[Demo] User ${userId} purchased credit pack ${packId}`);
  return { success: true, creditsAdded: 100, message: '充值成功' };
}

export const PRICING_CONFIG = {
  free: { monthlyPrice: 0, annualPrice: 0 },
  pro: { monthlyPrice: 29.9, annualPrice: 299 },
  team: { monthlyPrice: 99, annualPrice: 999 }
};

export const CREDIT_PACKS = [
  { id: 'small', price: 9.9, credits: 100 },
  { id: 'medium', price: 49, credits: 600 },
  { id: 'large', price: 99, credits: 1500 }
];
