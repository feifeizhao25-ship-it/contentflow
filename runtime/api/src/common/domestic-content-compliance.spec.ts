import {
  DOMESTIC_GATE_ORDER,
  DOMESTIC_RULESET_VERSION,
  evaluateDomesticContent,
  AD_LAW_ART9_TERMS,
  AD_TERM_WHITELIST_CONTEXTS,
} from './domestic-content-compliance';

describe('domestic content six-gate compliance', () => {
  it('keeps the mandated six gates in fixed order', () => {
    expect(DOMESTIC_GATE_ORDER).toEqual([
      'illegal_content', 'advertising_law', 'regulated_industry',
      'minor_protection', 'misinformation', 'intellectual_property',
    ]);
  });

  it('returns versioned, sourced hits in gate order', () => {
    const result = evaluateDomesticContent('刷单稳赚，未经授权搬运，保证治愈');
    expect(result.passed).toBe(false);
    expect(result.ruleSetVersion).toBe(DOMESTIC_RULESET_VERSION);
    expect(result.hits.map((hit) => hit.gate)).toEqual([
      'illegal_content', 'advertising_law', 'regulated_industry', 'intellectual_property',
    ]);
    expect(result.hits.every((hit) => hit.ruleId && hit.source && hit.reason)).toBe(true);
  });

  it('does not allow human override for the first gate', () => {
    const result = evaluateDomesticContent('提供博彩和买卖账号服务');
    expect(result.hits[0]).toEqual(expect.objectContaining({
      gate: 'illegal_content', humanOverrideAllowed: false,
    }));
  });

  it('allows ordinary content through without fabricating warnings', () => {
    expect(evaluateDomesticContent('分享三种提升写作清晰度的方法')).toEqual({
      passed: true, ruleSetVersion: DOMESTIC_RULESET_VERSION, hits: [],
    });
  });
});

describe('《广告法》第九条结构化词表', () => {
  const adHit = (text: string) => evaluateDomesticContent(text).hits.find((hit) => hit.ruleId === 'CN-AD-ART9-3');

  it('只收录第九条明确列举的三个用语，每条注明法条出处', () => {
    expect(AD_LAW_ART9_TERMS.map((t) => t.term)).toEqual(['国家级', '最高级', '最佳']);
    for (const entry of AD_LAW_ART9_TERMS) expect(entry.legalBasis).toBe('《中华人民共和国广告法》第九条第（三）项');
  });

  it.each(['本店是国家级老字号', '最高级的享受', '最佳选择就在这里'])('命中：%s', (text) => {
    const hit = adHit(text);
    expect(hit).toBeDefined();
    expect(hit!.matchedDetails!.every((d) => d.legalBasis.includes('第九条'))).toBe(true);
  });

  it.each([['國家級', '国家级'], ['最高級', '最高级'], ['最 佳', '最佳'], ['最·佳', '最佳'], ['ＡＢ最佳', '最佳']])('变体「%s」也命中「%s」', (text, term) => {
    expect(adHit(text)?.matchedTerms).toEqual([term]);
  });

  it('白名单语境「最佳实践」不误伤；同一段里另有「最佳」仍命中', () => {
    expect(adHit('分享三条团队协作的最佳实践')).toBeUndefined();
    expect(evaluateDomesticContent('分享三条团队协作的最佳实践').passed).toBe(true);
    expect(adHit('最佳实践之外，这也是最佳选择')?.matchedTerms).toEqual(['最佳']);
    for (const ctx of AD_TERM_WHITELIST_CONTEXTS) expect(ctx.reason).toBeTruthy();
  });

  it('非法条列举的风险表述不再挂「第九条、第二十八条」，如实标为待律师审核，但仍拦截', () => {
    const hit = evaluateDomesticContent('稳赚不赔').hits.find((h) => h.gate === 'advertising_law');
    expect(hit?.ruleId).toBe('CN-AD-RISK-001');
    expect(hit?.source).toContain('未对应具体法条');
    expect(hit?.source).not.toMatch(/第九条|第二十八条/);
  });
});
