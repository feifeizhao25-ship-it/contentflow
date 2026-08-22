import { BillingController } from './billing.controller';
import { PLANS } from './plans.constant';

describe('BillingController', () => {
  it('returns the five canonical plan tiers in order', () => {
    // getPlans is deliberately public and does not touch persistence. Inject a
    // minimal typed test double so the constructor contract remains covered.
    const controller = new BillingController({} as any);
    const { plans } = controller.getPlans();

    expect(plans).toBe(PLANS);
    expect(plans.map((p) => p.id)).toEqual(['free', 'starter', 'pro', 'team', 'enterprise']);

    const [free, starter, pro, team, enterprise] = plans;
    expect([free.priceMonthlyUsd, free.platformLimit, free.monthlyPostQuota]).toEqual([0, 3, 10]);
    expect([starter.priceMonthlyUsd, starter.platformLimit, starter.monthlyPostQuota]).toEqual([29, 5, 100]);
    expect([pro.priceMonthlyUsd, pro.platformLimit, pro.monthlyPostQuota]).toEqual([99, 15, 500]);
    expect([team.priceMonthlyUsd, team.platformLimit, team.monthlyPostQuota]).toEqual([299, 30, 2000]);
    expect(enterprise.priceMonthlyUsd).toBeNull();
    expect(enterprise.platformLimit).toBe(-1);
    expect(enterprise.monthlyPostQuota).toBe(-1);
    expect(plans.map((p) => p.aiTokenQuota)).toEqual([
      50000, 500000, 2500000, 10000000, -1,
    ]);
    expect(enterprise.custom).toBe(true);
  });

  it('applies free limits when a paid subscription has expired', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({
        plan: 'pro',
        plan_expires_at: new Date(Date.now() - 60000),
        limits: { max_ai_tokens_monthly: 2500000 },
      }) },
      usageMeter: { findFirst: jest.fn().mockResolvedValue({ ai_tokens: 123 }) },
    };
    const result = await new BillingController(prisma as any).getSubscription({
      user: { tenantId: 'tenant-1' },
    });
    expect(result.plan).toBe('free');
    expect(result.monthlyQuota).toBe(50000);
    expect(result.limits.max_ai_tokens_monthly).toBe(50000);
  });
});
