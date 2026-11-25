import { CN_PLANS, PLANS, type ChinaPlanDefinition, type PlanDefinition } from './plans.constant';

type TenantEntitlements = {
  plan?: string;
  plan_expires_at?: Date | string | null;
  limits?: unknown;
  settings?: unknown;
};

/**
 * 当前用户权益的唯一计算。
 * /users/me 的 tenant.plan、tenant.limits 与 /billing/subscription 的 plan、limits 都调用本函数，
 * 国内版设置页也只读这一组数字。
 *
 * 到期降级：plan_expires_at 早于或等于 now 的那一刻立即生效，不等到自然月结束，也不再沿用
 * 购买时写进 tenant.limits 的付费上限。降到免费档的五项是：平台账号数、成员席位、每月发布条数、
 * 每月 AI 令牌、存储空间。未到期时，已购订单快照覆盖档位表默认值，避免改价后改写在期订单。
 */
function planDefaults(definition: PlanDefinition | ChinaPlanDefinition) {
  const cn = definition as ChinaPlanDefinition;
  return {
    max_accounts: definition.platformLimit,
    max_members: typeof cn.memberLimit === 'number' ? cn.memberLimit : 1,
    max_publishes_monthly: definition.monthlyPostQuota,
    max_ai_tokens_monthly: definition.aiTokenQuota,
    max_storage_gb: typeof cn.storageGb === 'number' ? cn.storageGb : 1,
  };
}

export function effectiveEntitlements(tenant: TenantEntitlements, now = Date.now()) {
  const plans = process.env.MARKET_REGION === 'global' ? PLANS : CN_PLANS;
  const expiry = tenant.plan_expires_at ? new Date(tenant.plan_expires_at).getTime() : null;
  const expired = expiry !== null && (!Number.isFinite(expiry) || expiry <= now);
  const purchasedPlan = tenant.plan ?? 'free';
  const plan = expired ? 'free' : purchasedPlan;
  const definition = plans.find(item => item.id === plan) ?? plans[0];
  const defaults = planDefaults(definition);
  const stored = (tenant.limits && typeof tenant.limits === 'object' && !Array.isArray(tenant.limits)
    ? tenant.limits
    : {}) as Record<string, number>;
  const limits: Record<string, number> = expired ? { ...defaults } : { ...defaults, ...stored };
  return { plan, purchasedPlan, expired, limits };
}
