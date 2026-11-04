import { parseScriptJson, salvageScriptJson } from './ai.service';
import { ApiKeyService } from '../developer/api-key.service';
import { AnalyticsController } from '../analytics/analytics.controller';

/** 全量 UI 测试（20261104）问题 I-02 / I-05 / I-06 的回归测试。 */
describe('I-06 脚本 JSON 容错', () => {
  it('截断的输出：保留已经完整的分镜，不再整条 500', () => {
    const raw = '{"title":"秋季招生","scenes":[{"visual":"教室里孩子们专心听讲","subtitle":"秋天来了","time":5},{"visual":"家长在电脑前浏览","subtitle":"关注我们","time":4},{"visual":"镜头特写一位学生兴奋地打开课本，旁边是老';
    const out = parseScriptJson(raw);
    expect(out.title).toBe('秋季招生');
    expect(out.scenes).toHaveLength(2);
    expect(out.scenes[1].subtitle).toBe('关注我们');
  });
  it('完全不是 JSON：抛普通错误，由调用方重试后返回 502', () => {
    expect(() => parseScriptJson('抱歉，我无法完成')).toThrow();
    expect(() => salvageScriptJson('no json here')).toThrow();
  });
  it('正常 JSON 与 ```json 代码块不受影响', () => {
    expect(parseScriptJson('```json\n{"title":"t","scenes":[{"visual":"a","subtitle":"b","time":3}]}\n```').scenes).toHaveLength(1);
  });
});

describe('I-05 开发者 API Key 列表', () => {
  const rows = [{ id: 'k1', tenant_id: 't', name: 'ci', key_prefix: 'sk_ff_abcd', key_hash: 'SECRET-HASH', scopes: ['content:read'] }];
  const prisma: any = { apiKey: { findMany: jest.fn().mockResolvedValue(rows), create: jest.fn(async ({ data }: any) => ({ id: 'k2', ...data })) } };
  const svc = new ApiKeyService(prisma);
  it('走 prisma.apiKey（模型 ApiKey），并且永不返回 key_hash', async () => {
    const list = await svc.listKeys('t');
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith({ where: { tenant_id: 't' }, orderBy: { created_at: 'desc' } });
    expect(JSON.stringify(list)).not.toContain('SECRET-HASH');
  });
  it('创建：带 key_prefix（必填字段），明文只返回一次，哈希不返回', async () => {
    const out: any = await svc.createKey('t', 'ci');
    expect(out.secret).toMatch(/^sk_ff_[0-9a-f]{32}$/);
    expect(prisma.apiKey.create.mock.calls[0][0].data.key_prefix).toBe(out.secret.slice(0, 10));
    expect(out.key_hash).toBeUndefined();
  });
});

describe('I-02 国际版数据分析默认英文', () => {
  const svc: any = { getOverview: jest.fn().mockResolvedValue({}) };
  const ctl = new AnalyticsController(svc);
  const prev = process.env.MARKET_REGION;
  afterEach(() => { if (prev === undefined) delete process.env.MARKET_REGION; else process.env.MARKET_REGION = prev; svc.getOverview.mockClear(); });
  it('global：没带 lang 也按 en 取', async () => {
    process.env.MARKET_REGION = 'global';
    await ctl.getOverview({ user: { tenantId: 't' } }, undefined);
    expect(svc.getOverview.mock.calls[0][2]).toBe('en');
  });
  it('cn：默认中文；显式 lang=en 仍可用', async () => {
    process.env.MARKET_REGION = 'cn';
    await ctl.getOverview({ user: { tenantId: 't' } }, undefined);
    expect(svc.getOverview.mock.calls[0][2]).toBe('zh');
    await ctl.getOverview({ user: { tenantId: 't' } }, 'en');
    expect(svc.getOverview.mock.calls[1][2]).toBe('en');
  });
});
