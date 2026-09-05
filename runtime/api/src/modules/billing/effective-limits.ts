import { CN_PLANS, PLANS } from './plans.constant';

type TenantEntitlements = {
  plan?: string;
  plan_expires_at?: Date | string | null;
  limits?: unknown;
  settings?: unknown;
};

/** Stored paid limits belong to the purchased order; only expiry falls back to free. */
export function effectiveEntitlements(tenant: TenantEntitlements, now = Date.now()) {
  const plans = process.env.MARKET_REGION === 'global' ? PLANS : CN_PLANS;
  const expiry = tenant.plan_expires_at ? new Date(tenant.plan_expires_at).getTime() : null;
  const expired = expiry !== null && (!Number.isFinite(expiry) || expiry <= now);
  const plan = expired ? 'free' : tenant.plan ?? 'free';
  const definition = plans.find(item => item.id === plan) ?? plans[0];
  const defaults = {
    max_accounts: definition.platformLimit,
    max_members: 1,
    max_publishes_monthly: definition.monthlyPostQuota,
    max_ai_tokens_monthly: definition.aiTokenQuota,
    max_storage_gb: 1,
  };
  const limits: Record<string, number> = expired ? defaults : { ...defaults, ...((tenant.limits ?? {}) as Record<string, number>) };
  return { plan, expired, limits };
}
