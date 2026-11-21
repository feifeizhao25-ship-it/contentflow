import { readFileSync } from 'fs';
import { join } from 'path';
import { coverageGrams, DEFAULT_MIN_COVERAGE, localCitations, minCoverage, queryCoverage } from './coverage';
import { frozenCases, policyFromDefaultRegistry, refusalFrozenCases, runFrozenEval } from './policy';
import { loadRegistry } from './registry';
import { retrieve } from './retrieve';

function lines<T>(file: string): T[] {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => JSON.parse(line) as T);
}

const EVALS = join(__dirname, 'evals');
const outOfCorpus = lines<{ id: string; query: string }>(join(EVALS, 'out_of_corpus_v1.jsonl'));
const inDomain = lines<{ id: string; query: string }>(join(EVALS, 'in_domain_natural_v1.jsonl'));
const golden = lines<{ question: string; channel?: string; expect?: string }>(join(__dirname, '../../../../data/eval/golden_contentflow_zh.jsonl'))
  .filter((item) => item.channel === 'corpus' && item.expect === 'answer');

describe('增长 RAG 相关度下限（库外问题不挂来源）', () => {
  const sources = loadRegistry().sources;
  const now = new Date('2026-11-01T00:00:00.000Z');

  it('检索词去掉虚字，英文数字转小写', () => {
    expect(coverageGrams('什么是隐式标识')).toEqual(new Set(['隐式', '式标', '标识']));
    expect(coverageGrams('GB 45438 实施').has('gb')).toBe(true);
    expect(queryCoverage('', '任何内容')).toBe(0);
  });

  it('下限默认 0.3，可用 GROWTH_RAG_MIN_COVERAGE 覆盖，非法值退回默认', () => {
    expect(minCoverage({})).toBe(DEFAULT_MIN_COVERAGE);
    expect(minCoverage({ GROWTH_RAG_MIN_COVERAGE: '0' })).toBe(0);
    expect(minCoverage({ GROWTH_RAG_MIN_COVERAGE: '0.5' })).toBe(0.5);
    expect(minCoverage({ GROWTH_RAG_MIN_COVERAGE: '2' })).toBe(DEFAULT_MIN_COVERAGE);
    expect(minCoverage({ GROWTH_RAG_MIN_COVERAGE: 'x' })).toBe(DEFAULT_MIN_COVERAGE);
  });

  it(`库外 ${outOfCorpus.length} 题一条来源都不挂；关掉下限时大多数会挂上（证明评测是真跑的）`, () => {
    expect(outOfCorpus.length).toBeGreaterThanOrEqual(16);
    for (const item of outOfCorpus) expect([item.id, localCitations(item.query, sources)]).toEqual([item.id, []]);
    const withoutFloor = outOfCorpus.filter((item) => localCitations(item.query, sources, { minCoverage: 0 }).length > 0);
    expect(withoutFloor.length).toBeGreaterThan(0);
  });

  it(`库内问法 ${inDomain.length} 题和金标准语料题 ${golden.length} 道都仍有来源`, () => {
    expect(golden.length).toBeGreaterThanOrEqual(150);
    for (const item of [...inDomain.map((x) => x.query), ...golden.map((x) => x.question)]) {
      expect([item, localCitations(item, sources).length > 0]).toEqual([item, true]);
    }
  });

  it('retrieve()：库外问题拒答且不挂来源，库内问题照常引用', async () => {
    const pool = sources.map((item) => ({ ...item, review_status: undefined }));
    const env = {};
    const off = await retrieve('今天上海天气怎么样', pool, { now, env });
    expect(off).toMatchObject({ refused: true, citations: [] });
    const on = await retrieve('什么是隐式标识', pool, { now, env });
    expect(on.refused).toBe(false);
    expect(on.citations.length).toBeGreaterThan(0);
  });

  it('冻结拒答题用本地检索真跑：有下限通过，下限为 0 时不通过', () => {
    const refusals = refusalFrozenCases(frozenCases());
    expect(runFrozenEval(refusals, (query) => localCitations(query, sources))).toBe(true);
    expect(runFrozenEval(refusals, (query) => localCitations(query, sources, { minCoverage: 0 }))).toBe(false);
    // 开关仍然关着、来源仍待审核：总开关不受这次改动影响。
    expect(policyFromDefaultRegistry({ GROWTH_RAG_ENABLED: '1', GROWTH_RAG_EVAL_PASSED: '1' }, now).enabled).toBe(false);
  });
});
