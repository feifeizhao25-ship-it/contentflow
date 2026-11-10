import { CN_PLANS, PLANS, type ChinaPlanDefinition } from '../billing/plans.constant';
import { effectiveEntitlements } from '../billing/effective-limits';

/**
 * 席位只读现有套餐。国内档的 memberLimit 与权益表 collaboration.seats 一致：
 * 免费 1、个人 1、团队 5、商务 20。国际套餐没有席位字段，未决定前按 1（仅所有者）。
 */
export function seatLimit(tenant: { plan?: string; plan_expires_at?: Date | string | null; limits?: unknown }, now = Date.now()): number {
  const { plan } = effectiveEntitlements(tenant, now);
  const catalog = process.env.MARKET_REGION === 'global' ? PLANS : CN_PLANS;
  const definition = catalog.find((item) => item.id === plan);
  if (definition && 'memberLimit' in definition) {
    const cap = (definition as ChinaPlanDefinition).memberLimit;
    if (typeof cap === 'number' && Number.isFinite(cap) && cap > 0) return cap;
  }
  return 1;
}
