import {
  DOMESTIC_GATE_ORDER,
  DOMESTIC_RULESET_VERSION,
  evaluateDomesticContent,
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
