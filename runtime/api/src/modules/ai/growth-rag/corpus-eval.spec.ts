import { DOMESTIC_PLATFORMS, buildCorpusFrozenCases, buildCorpusGoldenCases, selectAnchoredPassages } from './corpus-set';
import { belowBaseline, loadBaseline, scoreCorpusEval } from './corpus-eval';
import { loadPassages } from './corpus';
import { GOLDEN_FILE, loadGolden } from '../../growth/self-improve/continuous';
import { frozenCases } from './policy';

describe('语料金标准与留出集', () => {
  const anchored = selectAnchoredPassages();
  const generated = buildCorpusGoldenCases(anchored);
  const holdout = buildCorpusFrozenCases(anchored);
  const cases = loadGolden(GOLDEN_FILE);
  const passages = loadPassages();

  it('金标准不少于 200，每个国内平台不少于 30，留出集不少于 60', () => {
    expect(anchored.length).toBeGreaterThanOrEqual(10);
    expect(generated.length).toBe(DOMESTIC_PLATFORMS.length * 30);
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(holdout.length).toBeGreaterThanOrEqual(60);
    expect(frozenCases().length).toBeGreaterThanOrEqual(60);
    for (const platform of DOMESTIC_PLATFORMS) {
      expect(cases.filter((item) => item.platform === platform).length).toBeGreaterThanOrEqual(30);
    }
  });

  it('每条语料答案都是登记原文的子串，复核人留空，待审核', () => {
    const byId = new Map(passages.map((item) => [item.id, item]));
    for (const item of cases.filter((row) => row.channel === 'corpus')) {
      const passage = byId.get(String(item.corpus_id));
      expect(passage).toBeTruthy();
      for (const need of item.must_include ?? []) {
        const alts = typeof need === 'string' ? [need] : need;
        expect(alts.some((text) => passage!.text.includes(text))).toBe(true);
      }
      expect(item.review_status).toBe('待审核');
      expect(item.reviewer).toBeUndefined();
      expect(item.sources?.[0].url).toBe(passage!.url);
    }
    for (const item of holdout) {
      const passage = byId.get(item.corpus_id);
      expect(item.answer).toBe(passage!.text);
      expect(item.must_include.every((span) => passage!.text.includes(span))).toBe(true);
    }
  });

  it('分数不低于扩集前的基线', () => {
    const metrics = scoreCorpusEval(cases, passages);
    expect(belowBaseline(metrics, loadBaseline())).toEqual([]);
    expect(metrics.golden_total).toBe(cases.length);
    expect(metrics.corpus_grounding).toBe(1);
    expect(metrics.recall_at_8).toBe(1);
    expect(metrics.frozen_holdout_grounding).toBe(1);
  });
});
