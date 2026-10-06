import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { COMPLIANCE_REVIEW_NOTICE, RagPolicyService } from './rag-policy.service';

describe('domestic evidence selection', () => {
  let directory: string;
  const base = { id: 'a', source_name: '官方资料', source_url: 'https://www.cac.gov.cn/policy', published_at: '2025-03-14', retrieved_at: '2026-09-28', jurisdiction: 'CN', source_tier: 'S', review_status: 'verified', platforms: ['all'], topics: ['all'], content: '已审核摘要' };
  beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-test-')); jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-28T12:00:00Z')); });
  afterEach(async () => { jest.restoreAllMocks(); await fs.rm(directory, { recursive: true, force: true }); });
  const service = (age: unknown = 30) => new RagPolicyService({ get: (key: string) => key === 'RAG_POLICY_DIR' ? directory : age } as any);
  const write = (change = {}) => fs.writeFile(path.join(directory, 'a.json'), JSON.stringify({ ...base, ...change }));
  it('accepts current reviewed domestic sources', async () => { await write(); expect(await service().select(['douyin'])).toHaveLength(1); });
  it.each([
    { retrieved_at: '2026-08-23' }, { retrieved_at: '2026-09-29' }, { published_at: '2026-09-29' },
    { retrieved_at: 'invalid' }, { jurisdiction: 'US' }, { review_status: 'unverified' }, { source_tier: 'X' },
    { source_url: 'https://evil.example.cn/policy' }, { source_url: 'https://www.cac.gov.cn.evil.example/policy' },
    { source_url: 'http://www.cac.gov.cn/policy' }, { source_url: 'https://user@www.cac.gov.cn/policy' },
    { topics: [] }, { platforms: null }, { content: '' },
  ])('rejects invalid evidence %j', async change => { await write(change); expect(await service().select(['douyin'])).toEqual([]); });
  it('requires both platform and topic relevance', async () => {
    await write({ platforms: ['bilibili'], topics: ['all'] });
    expect(await service().select(['douyin'])).toEqual([]);
    expect(await service().select(['bilibili'])).toHaveLength(1);
    await write({ topics: ['广告'] });
    expect(await service().select(['douyin'], '生活')).toEqual([]);
    expect(await service().select(['douyin'], '广告文案')).toHaveLength(1);
  });
  it('marks missing evidence as an unreviewed draft constraint', () => { expect(service().buildContext([])).toContain('不要编造平台规则'); });
  it.each([0, -1, 366, 1.5, 'NaN'])('rejects invalid maximum age %s', async age => { await expect(service(age).select()).rejects.toThrow('RAG_MAX_AGE_DAYS'); });
});

describe('合规资料人工复核流程（reviewed_by / reviewed_at）', () => {
  let directory: string;
  const now = Date.parse('2026-10-06T12:00:00Z');
  const base = { id: 'a', source_name: '官方资料', source_url: 'https://www.cac.gov.cn/policy', published_at: '2025-03-14', retrieved_at: '2026-08-23', reviewed_by: null, reviewed_at: null, jurisdiction: 'CN', source_tier: 'S', review_status: 'verified', platforms: ['all'], topics: ['all'], content: '已审核摘要' };
  beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-review-')); jest.spyOn(Date, 'now').mockReturnValue(now); });
  afterEach(async () => { jest.restoreAllMocks(); await fs.rm(directory, { recursive: true, force: true }); });
  const service = () => new RagPolicyService({ get: (key: string) => key === 'RAG_POLICY_DIR' ? directory : undefined } as any);
  const write = (change = {}) => fs.writeFile(path.join(directory, 'a.json'), JSON.stringify({ ...base, ...change }));

  it('抓取超过 30 天且没有人工复核：线上不引用，状态报「需要人工复核」', async () => {
    await write();
    expect(await service().select(['douyin'])).toEqual([]);
    const report = await service().freshnessReport(now);
    expect(report.needsReview).toBe(true);
    expect(report.notice).toContain(COMPLIANCE_REVIEW_NOTICE);
    expect(report.sources[0]).toMatchObject({ state: 'stale', checkedBy: 'retrieval' });
  });

  it('有复核人和复核日期：按复核日期计算时效，重新可用', async () => {
    await write({ reviewed_by: '合规专员张某', reviewed_at: '2026-10-01T10:00:00+08:00' });
    expect(await service().select(['douyin'])).toHaveLength(1);
    const report = await service().freshnessReport(now);
    expect(report.needsReview).toBe(false);
    expect(report.sources[0]).toMatchObject({ state: 'current', checkedBy: 'review' });
  });

  it.each([
    [{ reviewed_by: '', reviewed_at: '2026-10-01' }, '只改日期、不写复核人'],
    [{ reviewed_by: '张某', reviewed_at: '2026-10-09' }, '复核日期在未来'],
    [{ reviewed_by: '张某', reviewed_at: '2026-08-01' }, '复核日期早于抓取'],
    [{ reviewed_by: '张某', reviewed_at: 'not-a-date' }, '复核日期无效'],
  ])('%j（%s）不算复核，仍然过期', async (change) => {
    await write(change);
    expect(await service().select(['douyin'])).toEqual([]);
    expect((await service().freshnessReport(now)).needsReview).toBe(true);
  });

  it('距到期 ≤ 5 天时提醒运营（warn），过期时报错（error），都带「合规资料复核提醒」', async () => {
    const svc = service();
    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    await write({ reviewed_by: '张某', reviewed_at: '2026-09-10T12:00:00Z' }); // 26 天前，剩 4 天
    let report = await svc.remindOperators(now);
    expect(report.sources[0].state).toBe('due_soon');
    expect(warn.mock.calls.some(([m]) => String(m).includes('[合规资料复核提醒]'))).toBe(true);
    await write();
    report = await svc.remindOperators(now);
    expect(report.sources[0].state).toBe('stale');
    expect(error.mock.calls.some(([m]) => String(m).includes('[合规资料复核提醒]') && String(m).includes(COMPLIANCE_REVIEW_NOTICE))).toBe(true);
  });

  it('仓库里的资料文件都带复核字段，且没有被改成「今天」来骗过时效检查', async () => {
    const dir = path.join(__dirname, '../../../data/rag_cache');
    for (const name of (await fs.readdir(dir)).filter((n) => n.endsWith('.json'))) {
      const record = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
      expect(record).toHaveProperty('reviewed_by');
      expect(record).toHaveProperty('reviewed_at');
      if (record.reviewed_at) expect(String(record.reviewed_by || '').trim()).not.toBe('');
    }
  });
});
