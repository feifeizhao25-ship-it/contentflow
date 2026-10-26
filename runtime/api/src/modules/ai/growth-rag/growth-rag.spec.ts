import { embedWithFallback, localHashEmbed } from './embedder';
import { runFreshnessJob } from './freshness';
import { hashText } from './hash';
import { decideRagPolicy, policyFromDefaultRegistry, runFrozenEval, frozenCases } from './policy';
import { complianceConclusionsPaused, loadRegistry, markIfHashChanged, validateSource } from './registry';
import { retrieve } from './retrieve';
import { rerankWithFallback } from './reranker';
import { GrowthSource } from './types';

function source(overrides: Partial<GrowthSource> = {}): GrowthSource {
  const text = overrides.text ?? '小红书发布需要用户自己确认，本产品不代发。';
  return {
    source_id: overrides.source_id ?? 'src-1',
    url: overrides.url ?? 'https://example.com/rules/xhs',
    tier: overrides.tier ?? 'A',
    license: overrides.license ?? 'official-public',
    fetched_at: overrides.fetched_at ?? '2026-10-01T00:00:00.000Z',
    expires_at: overrides.expires_at ?? '2026-12-01T00:00:00.000Z',
    title: overrides.title ?? '小红书发布说明',
    tenant_id: overrides.tenant_id ?? null,
    review_status: overrides.review_status,
    text,
    content_hash: overrides.content_hash ?? hashText(text),
  };
}

describe('增长 RAG', () => {
  const now = new Date('2026-10-26T00:00:00.000Z');

  it('空注册表在开关打开时仍然关闭', () => {
    const registry = loadRegistry();
    expect(registry.sources).toEqual([]);
    expect(registry.sources_status).toBe('none');
    const decision = decideRagPolicy({ enabledFlag: true, registry, now, freshnessRan: true, evalPassed: true });
    expect(decision).toMatchObject({ enabled: false, sources_status: 'none' });
    expect(policyFromDefaultRegistry({ GROWTH_RAG_ENABLED: '1', GROWTH_RAG_EVAL_PASSED: '1' }, now).enabled).toBe(false);
  });

  it('许可、新鲜度和评测都通过且开关打开才 enabled', () => {
    const registry = { sources_status: 'none' as const, sources: [source()] };
    expect(decideRagPolicy({ enabledFlag: false, registry, now, freshnessRan: true, evalPassed: true })).toMatchObject({
      enabled: false,
      sources_status: 'validated',
    });
    expect(decideRagPolicy({ enabledFlag: true, registry, now, freshnessRan: false, evalPassed: true }).enabled).toBe(false);
    expect(decideRagPolicy({ enabledFlag: true, registry, now, freshnessRan: true, evalPassed: false }).enabled).toBe(false);
    expect(decideRagPolicy({ enabledFlag: true, registry, now, freshnessRan: true, evalPassed: true })).toMatchObject({
      enabled: true,
      sources_status: 'validated',
    });
  });

  it('拒绝 CC-BY-NC、过期来源，哈希变化暂停合规结论', () => {
    expect(validateSource(source({ license: 'CC-BY-NC-4.0' }), now).ok).toBe(false);
    expect(validateSource(source({ expires_at: '2026-10-01T00:00:00.000Z' }), now).errors).toContain('来源已过期');
    const changed = markIfHashChanged(source({ content_hash: 'deadbeef' }));
    expect(changed.review_status).toBe('needs_review');
    expect(complianceConclusionsPaused([changed])).toBe(true);
    const report = runFreshnessJob([changed], now);
    expect(report.ran).toBe(true);
    expect(report.needsReview).toContain('src-1');
  });

  it('引用带出处，租户之间不可见，没有资料就拒绝', async () => {
    const globalSource = source();
    const tenantA = source({ source_id: 'a', title: '租户A表现', text: '租户A只属于自己的历史', tenant_id: 'tenant-a' });
    const tenantB = source({ source_id: 'b', title: '租户B表现', text: '租户B的私有表现数据', tenant_id: 'tenant-b' });
    const seen = await retrieve('小红书 确认', [globalSource, tenantA, tenantB], { tenantId: 'tenant-a', now });
    expect(seen.refused).toBe(false);
    expect(seen.citations.map((item) => item.source_id).sort()).toEqual(['a', 'src-1']);
    expect(seen.citations[0]).toEqual(expect.objectContaining({ url: expect.stringMatching(/^https:\/\//), excerpt: expect.any(String) }));
    const other = await retrieve('私有表现', [tenantB], { tenantId: 'tenant-a', now });
    expect(other).toMatchObject({ refused: true, citations: [] });
  });

  it('bge 未配置时走本地向量，不发起请求', async () => {
    const fetchImpl = jest.fn();
    const embedded = await embedWithFallback('选题', { GROWTH_EMBEDDING_PROVIDER: 'bge-m3' }, fetchImpl);
    expect(embedded).toMatchObject({ embedder: 'local-hash', fallback: true });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(localHashEmbed('选题')).toEqual(localHashEmbed('选题'));
    const reranked = await rerankWithFallback('选题', ['选题草稿'], { GROWTH_RERANKER_PROVIDER: 'bge-reranker-v2-m3' }, fetchImpl);
    expect(reranked.fallback).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('冻结评测在没有引用时要求拒绝', () => {
    expect(runFrozenEval(frozenCases(), () => [])).toBe(true);
    expect(runFrozenEval(frozenCases(), () => [{ source_id: 'invented' }])).toBe(false);
  });
});
