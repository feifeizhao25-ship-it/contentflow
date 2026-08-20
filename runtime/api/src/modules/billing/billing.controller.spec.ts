import { ConfigService } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { CN_PLANS, PLANS } from './plans.constant';

describe('BillingController', () => {
  const controller = (market: 'cn' | 'global') => new BillingController(
    new ConfigService({ MARKET_REGION: market }),
  );

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
});
