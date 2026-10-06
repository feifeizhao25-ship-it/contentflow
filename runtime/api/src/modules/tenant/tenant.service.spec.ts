import { TenantService, currentUsageStats } from "./tenant.service";
it('unlimited accounts permit usage and unknown quota types fail closed', async () => {
 const service = new TenantService({ tenant: { findUnique: jest.fn().mockResolvedValue({ limits: { max_accounts: -1 }, usage_stats: { accounts_count: 5 } }) } } as any);
 expect(await service.checkQuota('t', 'account')).toBe(true);
 expect(await service.checkQuota('t', 'misspelled')).toBe(false);
});
it('expired membership cannot add paid-tier team members', async () => {
 const service = new TenantService({ tenant: { findUnique: jest.fn().mockResolvedValue({ plan: 'team', plan_expires_at: new Date(0), limits: { max_members: 5 }, usage_stats: { members_count: 1 } }) } } as any);
 expect(await service.checkQuota('t', 'member')).toBe(false);
});

describe('每月发布数按北京时间自然月计（原来只累加、从不清零）', () => {
  const sept30Night = new Date('2026-09-30T15:30:00Z'); // 北京时间 9 月 30 日 23:30
  const oct1Early = new Date('2026-09-30T16:30:00Z'); // 北京时间 10 月 1 日 00:30（UTC 仍是 9 月）

  function freeTenantStore() {
    const tenant: any = { plan: 'free', plan_expires_at: null, limits: {}, usage_stats: { accounts_count: 1, publishes_this_month: 0 } };
    const prisma = {
      tenant: {
        findUnique: jest.fn(async () => JSON.parse(JSON.stringify(tenant))),
        update: jest.fn(async ({ data }: any) => { tenant.usage_stats = data.usage_stats; return tenant; }),
      },
    };
    return { tenant, service: new TenantService(prisma as any) };
  }

  it('免费版 9 月底发满 5 条后被拦；10 月 1 日（北京时间）可以再发', async () => {
    const { tenant, service } = freeTenantStore();
    for (let i = 0; i < 5; i += 1) {
      expect(await service.checkQuota('t', 'publish', 1, sept30Night)).toBe(true);
      await service.incrementUsage('t', 'publish', 1, sept30Night);
    }
    expect(tenant.usage_stats.publishes_this_month).toBe(5);
    expect(tenant.usage_stats.publishes_period).toBe('2026-09');
    expect(await service.checkQuota('t', 'publish', 1, sept30Night)).toBe(false);

    expect(await service.checkQuota('t', 'publish', 1, oct1Early)).toBe(true);
    await service.incrementUsage('t', 'publish', 1, oct1Early);
    expect(tenant.usage_stats.publishes_this_month).toBe(1);
    expect(tenant.usage_stats.publishes_period).toBe('2026-10');
  });

  it('一次发到多个账号按条数计：剩 2 条额度时不能一次发 3 个账号', async () => {
    const { service } = freeTenantStore();
    await service.incrementUsage('t', 'publish', 3, sept30Night);
    expect(await service.checkQuota('t', 'publish', 2, sept30Night)).toBe(true);
    expect(await service.checkQuota('t', 'publish', 3, sept30Night)).toBe(false);
  });

  it('没有周期标记的旧数据（历史累计）按本月 0 条处理', () => {
    expect(currentUsageStats({ publishes_this_month: 99 }, oct1Early)).toMatchObject({ publishes_this_month: 0, publishes_period: '2026-10' });
    expect(currentUsageStats({ publishes_this_month: 3, publishes_period: '2026-10' }, oct1Early).publishes_this_month).toBe(3);
  });

  it("'ai_call' 不再读不存在的 max_ai_calls_monthly：AI 额度只由 UsageService 按 token 检查", async () => {
    const { service } = freeTenantStore();
    expect(await service.checkQuota('t', 'ai_call')).toBe(false);
  });
});
