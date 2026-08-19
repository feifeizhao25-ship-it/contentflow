import { BillingController } from './billing.controller';
import { PLANS } from './plans.constant';
import { PrismaService } from '../../database/prisma.service';

describe('BillingController', () => {
  it('returns the five canonical plan tiers in order', () => {
    // getPlans 不触碰数据库，prisma 传桩即可
    const controller = new BillingController({} as PrismaService);
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
    expect(enterprise.custom).toBe(true);
  });
});
