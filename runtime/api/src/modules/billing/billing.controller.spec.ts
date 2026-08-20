import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { BillingController } from './billing.controller';
import { CN_PLANS, PLANS } from './plans.constant';

describe('BillingController', () => {
  const prisma = {
    tenant: { findUnique: jest.fn() },
    usageMeter: { findFirst: jest.fn() },
  } as unknown as PrismaService;
  const controller = (market: 'cn' | 'global') => new BillingController(
    new ConfigService({ MARKET_REGION: market }),
    prisma,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns the five canonical global plan tiers in English', () => {
    const result = controller('global').getPlans();
    expect(result).toEqual({ market: 'global', plans: PLANS });
    expect(result.plans.map((plan) => plan.id)).toEqual([
      'free', 'starter', 'pro', 'team', 'enterprise',
    ]);
    expect(PLANS.map((plan) => plan.priceMonthlyUsd)).toEqual([0, 29, 99, 299, null]);
  });

  it('returns a separate Chinese domestic catalog with CNY prices', () => {
    const result = controller('cn').getPlans();
    expect(result).toEqual({ market: 'cn', plans: CN_PLANS });
    expect(CN_PLANS.map((plan) => plan.priceMonthlyCny)).toEqual([0, 49, 99, 299, null]);
    expect(CN_PLANS.every((plan) => plan.features.length >= 3)).toBe(true);
  });

  it('reads subscription usage from the authenticated tenant only', async () => {
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      plan: 'pro', limits: { max_ai_calls_monthly: 200 }, plan_expires_at: null,
    });
    (prisma.usageMeter.findFirst as jest.Mock).mockResolvedValue({ ai_tokens: 35 });
    const result = await controller('global').getSubscription({ user: { tenantId: 'tenant-1' } });
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'tenant-1' } });
    expect(prisma.usageMeter.findFirst).toHaveBeenCalledWith({
      where: { tenant_id: 'tenant-1', period: expect.stringMatching(/^\d{4}-\d{2}$/) },
    });
    expect(result).toMatchObject({ plan: 'pro', monthlyQuota: 200, usedQuota: 35, expired: false });
  });
});
