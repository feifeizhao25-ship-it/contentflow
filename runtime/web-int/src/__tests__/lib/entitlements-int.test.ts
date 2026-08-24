import registry from '@/lib/entitlements-int.json';
import {
  buildFallbackPlans,
  validateEntitlements,
  TIER_IDS,
  type EntitlementsRegistry,
} from '@/lib/entitlements-int';

describe('entitlements-int registry', () => {
  it('passes schema validation', () => {
    expect(validateEntitlements(registry)).toEqual([]);
  });

  it('flags a registry with a missing tier', () => {
    const broken = JSON.parse(JSON.stringify(registry));
    delete broken.tiers.team;
    const errors = validateEntitlements(broken);
    expect(errors.some((e) => e.includes('team'))).toBe(true);
  });

  it('flags inconsistent custom pricing', () => {
    const broken = JSON.parse(JSON.stringify(registry));
    broken.tiers.pro.custom = true;
    const errors = validateEntitlements(broken);
    expect(errors.some((e) => e.includes('pro'))).toBe(true);
  });
});

describe('buildFallbackPlans', () => {
  const plans = buildFallbackPlans(registry as EntitlementsRegistry);

  it('renders every tier in canonical order', () => {
    expect(plans.map((p) => p.id)).toEqual([...TIER_IDS]);
  });

  it('keeps USD price points aligned with the billing API', () => {
    const prices = Object.fromEntries(plans.map((p) => [p.id, p.priceMonthlyUsd]));
    expect(prices).toEqual({ free: 0, starter: 29, pro: 99, team: 299, enterprise: null });
  });

  it('marks only enterprise as custom with unlimited quotas', () => {
    const enterprise = plans.find((p) => p.id === 'enterprise');
    expect(enterprise?.custom).toBe(true);
    expect(enterprise?.platformLimit).toBe(-1);
    expect(enterprise?.monthlyPostQuota).toBe(-1);
    for (const plan of plans.filter((p) => p.id !== 'enterprise')) {
      expect(plan.custom).toBe(false);
      expect(plan.platformLimit).toBeGreaterThan(0);
      expect(plan.monthlyPostQuota).toBeGreaterThan(0);
    }
  });

  it('copies features so callers cannot mutate the registry', () => {
    const free = plans.find((p) => p.id === 'free');
    expect(free?.features.length).toBeGreaterThan(0);
    free?.features.push('mutated');
    expect((registry as EntitlementsRegistry).tiers.free.features).not.toContain('mutated');
  });
});
