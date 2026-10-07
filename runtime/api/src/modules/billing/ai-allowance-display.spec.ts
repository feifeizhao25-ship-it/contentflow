/**
 * 创作工作室显示的「本月 AI 额度」必须和 AI 接口实际的额度闸是同一个数。
 *
 * 原来工作室显示的是签到积分余额（/points/balance）和写死的「单次消耗 5 积分」，
 * 与套餐 AI 令牌额度毫无关系：免费用户看到「可用余额 0」却仍能生成，付费用户看到 0 以为不能用。
 * 现在界面读 GET /billing/subscription 的 aiTokens，它与 UsageService.checkQuota(TOKENS)
 * 共用 aiTokenAllowance()。这里对同一组工作区数据同时调两边，断言结论一致。
 */
import { BillingController } from './billing.controller';
import { ResourceType, UsageService } from '../system/usage.service';
import { IMAGE_TOKEN_EQUIVALENT } from '../ai/model-pricing';

describe('本月 AI 额度：界面显示与接口拦截同一来源', () => {
  const cases = [
    { name: '免费档未用', tenant: { plan: 'free', limits: {} }, used: 0 },
    { name: '免费档用到一半', tenant: { plan: 'free', limits: {} }, used: 20000 },
    { name: '免费档刚好用完', tenant: { plan: 'free', limits: {} }, used: 50000 },
    { name: '专业档超用', tenant: { plan: 'pro', plan_expires_at: new Date(Date.now() + 86400000), limits: { max_ai_tokens_monthly: 2500000 } }, used: 2600000 },
    { name: '旧数据只有调用次数', tenant: { plan: 'starter', plan_expires_at: new Date(Date.now() + 86400000), limits: { max_ai_tokens_monthly: undefined, max_ai_calls_monthly: 10 } }, used: 24000 },
    { name: '不限量', tenant: { plan: 'enterprise', plan_expires_at: new Date(Date.now() + 86400000), limits: { max_ai_tokens_monthly: -1 } }, used: 99999999 },
    { name: '已过期回落免费档', tenant: { plan: 'pro', plan_expires_at: new Date(Date.now() - 60000), limits: { max_ai_tokens_monthly: 2500000 } }, used: 60000 },
  ];

  for (const c of cases) {
    it(c.name, async () => {
      const meter = { id: 'm1', ai_tokens: c.used };
      const prisma: any = {
        tenant: { findUnique: jest.fn().mockResolvedValue(c.tenant) },
        usageMeter: { findFirst: jest.fn().mockResolvedValue(meter), create: jest.fn() },
      };
      const shown = await new BillingController(prisma, {} as any).getSubscription({ user: { tenantId: 't1' } });
      const allowed = await new UsageService(prisma).checkQuota('t1', ResourceType.TOKENS);

      expect(shown.aiTokens.used).toBe(c.used);
      expect(shown.monthlyQuota).toBe(shown.aiTokens.limit);
      expect(shown.usedQuota).toBe(shown.aiTokens.used);
      expect(shown.aiTokens.imageTokenEquivalent).toBe(IMAGE_TOKEN_EQUIVALENT);
      // 界面说「还能用」⇔ 接口放行
      expect(shown.aiTokens.unlimited || shown.aiTokens.remaining > 0).toBe(allowed);
      if (!shown.aiTokens.unlimited) {
        expect(shown.aiTokens.remaining).toBe(Math.max(0, shown.aiTokens.limit - c.used));
      }
    });
  }

  it('旧数据只有调用次数时按 1 次 = 2500 令牌折算（与原 checkQuota 口径一致）', async () => {
    const prisma: any = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ plan: 'starter', plan_expires_at: new Date(Date.now() + 86400000), limits: { max_ai_tokens_monthly: undefined, max_ai_calls_monthly: 10 } }) },
      usageMeter: { findFirst: jest.fn().mockResolvedValue({ ai_tokens: 0 }) },
    };
    const shown = await new BillingController(prisma, {} as any).getSubscription({ user: { tenantId: 't1' } });
    expect(shown.aiTokens.limit).toBe(25000);
  });
});
