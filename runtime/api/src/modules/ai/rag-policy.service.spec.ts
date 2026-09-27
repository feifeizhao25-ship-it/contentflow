import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { RagPolicyService } from './rag-policy.service';

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
