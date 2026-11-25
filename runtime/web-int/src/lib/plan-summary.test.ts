import { describeGlobalPlan } from './plan-summary';

describe('international plan summary', () => {
  it('shows the free limits for an expired Pro workspace', () => {
    const view = describeGlobalPlan({
      plan: 'free',
      purchasedPlan: 'pro',
      expired: true,
      renewalDate: '2026-11-01T00:00:00.000Z',
      limits: {
        max_accounts: 3,
        max_publishes_monthly: 10,
        max_ai_tokens_monthly: 50000,
        max_storage_gb: 1,
        max_members: 1,
      },
    });
    expect(view?.rows).toEqual([
      ['Plan', 'Free'],
      ['Status', 'Expired'],
      ['Renewal', 'Nov 1, 2026'],
      ['Accounts', '3'],
      ['Posts this month', '10'],
      ['AI tokens this month', '50,000'],
      ['Storage (GB)', '1'],
      ['Seats', '1'],
    ]);
    expect(view?.action).toBe('Renew plan');
    expect(view?.notice).toMatch(/ended on Nov 1, 2026/);
    expect(view?.notice).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('returns null when the subscription payload is missing', () => {
    expect(describeGlobalPlan(null)).toBeNull();
    expect(describeGlobalPlan({})).toBeNull();
  });
});
