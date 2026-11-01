import { readFileSync } from 'fs';
import { join } from 'path';
import { PLANS } from './plans.constant';

/**
 * D4 FF-6-1 acceptance: "三处权益自动对比" — the international pricing registry (web-int JSON) must
 * equal plans.constant.ts. (The CN side is compared by runtime/web-cn/scripts/test-entitlements.mjs.)
 */
describe('international entitlements registry == plans.constant.ts', () => {
  const registry = JSON.parse(
    readFileSync(join(__dirname, '../../../../web-int/src/lib/entitlements-int.json'), 'utf8'),
  );

  it('has exactly the same tiers', () => {
    expect(Object.keys(registry.tiers)).toEqual(PLANS.map((p) => p.id));
  });

  it.each(PLANS.map((p) => [p.id, p] as const))('%s: price and every quota are explicit and equal', (_id, plan) => {
    const tier = registry.tiers[plan.id];
    expect(tier.priceMonthlyUsd).toBe(plan.priceMonthlyUsd);
    expect(tier.platformLimit).toBe(plan.platformLimit);
    expect(tier.monthlyPostQuota).toBe(plan.monthlyPostQuota);
    expect(tier.aiTokenQuota).toBe(plan.aiTokenQuota);
    expect(tier.custom).toBe(plan.custom);
    expect(tier.features).toEqual(plan.features);
  });
});
