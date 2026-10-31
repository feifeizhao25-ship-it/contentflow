import { evaluateDomesticContent } from '../../common/domestic-content-compliance';
import { evaluateInternationalContent } from '../../common/international-content-compliance';
import { ComplianceService } from './compliance.service';

/**
 * 回归集：UI 全量测试里被判 clear 的高风险文案（国内 c3/c4，国际 g1~g4）。
 * 这些文案以后任何一条被判 clear 都必须让测试失败。
 */
const DOMESTIC_MISSED = {
  c3_fund: '这只基金明天必涨，闭眼买入，没有任何风险。',
  c4_food: '我们是全国最好吃的火锅，治好了很多人的胃病。',
};
const INTL_MISSED = {
  g1_supplement: 'This supplement cures anxiety in 3 days, guaranteed. FDA approved. Doctors hate it.',
  g2_coin: 'Buy this coin now, guaranteed 10x returns by Friday, no risk at all.',
  g3_claims: 'Our product is the #1 rated tool in the world and 100% GDPR proof forever.',
  g4_medication: 'Stop taking your blood pressure medication, this herb replaces it completely.',
};

describe('domestic: previously missed risky copy is now flagged', () => {
  it('c3: 必涨/闭眼买入/没有任何风险 → blocked as an investment guarantee', () => {
    const r = evaluateDomesticContent(DOMESTIC_MISSED.c3_fund);
    expect(r.level).toBe('violation');
    expect(r.passed).toBe(false);
    expect(r.hits.map((h) => h.ruleId)).toContain('CN-AD-ART25');
  });

  it('c4: 治好了…胃病 → blocked as a disease-treatment claim; 全国最好吃 → review', () => {
    const r = evaluateDomesticContent(DOMESTIC_MISSED.c4_food);
    expect(r.passed).toBe(false);
    const ids = r.hits.map((h) => h.ruleId);
    expect(ids).toContain('CN-AD-ART17-18');
    expect(ids).toContain('CN-AD-SUPERLATIVE');
    expect(r.hits.find((h) => h.ruleId === 'CN-AD-SUPERLATIVE')?.severity).toBe('review');
  });

  it('superlative alone is a review-level risk, not a block', () => {
    const r = evaluateDomesticContent('我们家的火锅全国最好吃。');
    expect(r.passed).toBe(true);
    expect(r.level).toBe('risk');
  });

  it('ordinary copy is still clear', () => {
    for (const ok of ['今天分享一个周末早餐搭配，欢迎在评论区交流。', '秋冬保湿三步：洁面、精华、面霜。']) {
      expect(evaluateDomesticContent(ok).level).toBe('clear');
    }
  });
});

describe('international: previously missed risky copy is now flagged', () => {
  it.each(Object.entries(INTL_MISSED))('%s is not clear', (_name, text) => {
    const r = evaluateInternationalContent(text);
    expect(r.level).not.toBe('clear');
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.source && h.sourceUrl.startsWith('https://') && h.reason)).toBe(true);
  });

  it('g1 supplement disease claim is blocked', () => {
    const r = evaluateInternationalContent(INTL_MISSED.g1_supplement);
    expect(r.passed).toBe(false);
    expect(r.hits.map((h) => h.ruleId)).toEqual(expect.arrayContaining(['INTL-DISEASE-CLAIM', 'INTL-AUTHORITY-CLAIM']));
  });

  it('g2 guaranteed returns / no risk is blocked', () => {
    const r = evaluateInternationalContent(INTL_MISSED.g2_coin);
    expect(r.passed).toBe(false);
    expect(r.hits.map((h) => h.ruleId)).toContain('INTL-GUARANTEED-RETURNS');
  });

  it('g3 superlative and absolute compliance claims are review-level', () => {
    const r = evaluateInternationalContent(INTL_MISSED.g3_claims);
    expect(r.level).toBe('risk');
    expect(r.hits.map((h) => h.ruleId)).toEqual(expect.arrayContaining(['INTL-SUPERLATIVE', 'INTL-AUTHORITY-CLAIM']));
  });

  it('g4 stopping medication is blocked and cannot be overridden', () => {
    const r = evaluateInternationalContent(INTL_MISSED.g4_medication);
    expect(r.passed).toBe(false);
    const hit = r.hits.find((h) => h.ruleId === 'INTL-MEDICATION-STOP');
    expect(hit).toBeDefined();
    expect(hit?.humanOverrideAllowed).toBe(false);
  });

  it('flags an undisclosed affiliate promotion, and passes once it is labelled', () => {
    expect(evaluateInternationalContent('Great desk lamp! Use my code DESK10 for a discount.').hits.map((h) => h.ruleId)).toContain('INTL-DISCLOSURE');
    expect(evaluateInternationalContent('#ad Great desk lamp! Use my code DESK10 for a discount.').hits.map((h) => h.ruleId)).not.toContain('INTL-DISCLOSURE');
  });

  it('ordinary copy stays clear and reports what was and was not checked', () => {
    const r = evaluateInternationalContent('5 desk setup upgrades under $50: cable sleeves, a monitor light bar and a small plant.');
    expect(r.level).toBe('clear');
    expect(r.rulesChecked).toBeGreaterThan(5);
    expect(r.notChecked.length).toBeGreaterThan(0);
    expect(r.disclaimer).toMatch(/not legal advice/i);
  });

  it('output is English only (no CJK) so the international edition never shows Chinese', () => {
    const r = evaluateInternationalContent(Object.values(INTL_MISSED).join(' '));
    expect(JSON.stringify(r)).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe('ComplianceService picks the rule set by market', () => {
  const global = new ComplianceService({ get: () => 'global' } as any);
  const cn = new ComplianceService({ get: () => 'cn' } as any);

  it('global edition flags English risks and uses the international rule set', async () => {
    const r: any = await global.checkContent(INTL_MISSED.g4_medication);
    expect(r.passed).toBe(false);
    expect(r.ruleSetVersion).toMatch(/^intl-/);
  });

  it('domestic edition flags Chinese risks', async () => {
    const r: any = await cn.checkContent(DOMESTIC_MISSED.c3_fund);
    expect(r.passed).toBe(false);
    expect(r.ruleSetVersion).toMatch(/^cn-/);
  });

  it('scrubOutput throws an English error in the international edition and Chinese in the domestic one', async () => {
    await expect(global.scrubOutput(INTL_MISSED.g2_coin)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CONTENT_COMPLIANCE_BLOCKED', message: expect.stringMatching(/not pass/i) }),
    });
    await expect(cn.scrubOutput(DOMESTIC_MISSED.c3_fund)).rejects.toMatchObject({
      response: expect.objectContaining({ message: expect.stringMatching(/合规/) }),
    });
  });
});
