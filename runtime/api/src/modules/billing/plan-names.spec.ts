import { CN_PLANS, LEGACY_CN_PLANS } from './plans.constant';
import entitlements from '../../../../web-cn/src/lib/entitlements.json';

// 分D04：国内版在售档名按 0S1 统一为 免费 / 个人版 / 团队版 / 商务版，价格不变。
describe('国内版在售档名（分D04）', () => {
  it('在售档名为 免费版 / 个人版 / 团队版 / 商务版', () => {
    expect(CN_PLANS.map((p) => [p.id, p.name])).toEqual([
      ['free', '免费版'], ['pro', '个人版'], ['team', '团队版'], ['enterprise', '商务版'],
    ]);
  });
  it('价格与 0S1 v2 一致', () => {
    const price = Object.fromEntries(CN_PLANS.map((p) => [p.id, [p.priceMonthlyCny, p.priceYearlyCny]]));
    expect(price).toEqual({ free: [0, 0], pro: [99, 990], team: [499, 4990], enterprise: [1999, 19990] });
  });
  it('旧订单快照档名不改写', () => {
    expect(LEGACY_CN_PLANS.find((p) => p.id === 'pro')?.name).toBe('专业版');
  });
  it('网页端权益注册表档名与 API 一致', () => {
    const names = JSON.stringify(entitlements);
    for (const n of ['"个人版"', '"团队版"', '"商务版"']) expect(names).toContain(n);
    expect(names).not.toMatch(/"name": ?"(专业版|团队版|企业版)"/);
  });
});
