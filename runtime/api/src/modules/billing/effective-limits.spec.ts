import { effectiveEntitlements } from './effective-limits';
const env = process.env.MARKET_REGION;
afterEach(() => { if (env === undefined) delete process.env.MARKET_REGION; else process.env.MARKET_REGION = env; });
it('过期会员的实际用量门禁回退至国内免费额度', () => {
 process.env.MARKET_REGION = 'cn';
 const result = effectiveEntitlements({ plan: 'enterprise', plan_expires_at: '2026-01-01', limits: { max_publishes_monthly: -1 } }, Date.parse('2026-09-05'));
 expect(result.expired).toBe(true);
 expect(result.limits.max_publishes_monthly).toBe(5);
});
it('生效中的历史权益不被新套餐覆盖', () => {
 expect(effectiveEntitlements({ plan: 'pro', limits: { max_publishes_monthly: 500 } }).limits.max_publishes_monthly).toBe(500);
});
it('客户端语言设置不能切换国内外额度', () => {
 process.env.MARKET_REGION = 'cn';
 expect(effectiveEntitlements({ settings: { language: 'en', market: 'global' } }).limits.max_publishes_monthly).toBe(5);
 process.env.MARKET_REGION = 'global';
 expect(effectiveEntitlements({}).limits.max_publishes_monthly).toBe(10);
});
