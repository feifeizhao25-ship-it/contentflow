import { readFileSync } from 'fs';
import { join } from 'path';
import { evaluateDomesticContent } from './domestic-content-compliance';
import {
  DOMESTIC_CANDIDATE_RULES,
  candidateRulesPreviewEnabled,
} from './domestic-candidate-rules';

const MISSED = {
  immunity: '增强免疫力，宝宝不生病',
  height: '长高5厘米',
  cold: '预防感冒',
  absolute: '长沙第一，绝对正宗，包你满意，100%好评',
  sideEffect: '无副作用，一次见效',
  cureRate: '这款药膏治愈率达90%',
  efficacyRate: '有效率达90%',
  patient: '患者说用了就好',
};

describe('候选规则默认不启用', () => {
  const previous = process.env.COMPLIANCE_CANDIDATE_RULES;
  afterEach(() => {
    if (previous === undefined) delete process.env.COMPLIANCE_CANDIDATE_RULES;
    else process.env.COMPLIANCE_CANDIDATE_RULES = previous;
  });

  it('每条都是待审核、审核人留空、默认不启用，并写明已核对的法条', () => {
    expect(DOMESTIC_CANDIDATE_RULES.length).toBeGreaterThanOrEqual(6);
    const categories = DOMESTIC_CANDIDATE_RULES.map((rule) => rule.category);
    expect(categories).toEqual(expect.arrayContaining([
      '食品预防疾病',
      '保健功能宣称',
      '无副作用或一次见效',
      '治愈率',
      '患者证言',
      '绝对化用语或夸大承诺',
    ]));
    for (const rule of DOMESTIC_CANDIDATE_RULES) {
      expect(rule.review_status).toBe('待审核');
      expect(rule.reviewer).toBe('');
      expect(rule.enabled).toBe(false);
      expect(rule.legalBasis).toMatch(/《中华人民共和国(?:食品安全法|广告法)》/);
      expect(rule.legalBasis).toMatch(/第.+条/);
      expect(rule.legalBasis).toContain('待审核');
      expect(rule.legalBasis).toContain('审核人留空');
      expect(rule.sourceUrl).toMatch(/^https:\/\//);
      expect(rule.sourceRetrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const source = readFileSync(join(__dirname, 'domestic-candidate-rules.ts'), 'utf8');
    expect(source).not.toMatch(/reviewer:\s*['"][^'"]+['"]/);
  });

  it('未设置开关，或设置成 preview 以外的值时，漏判文案仍与关闭预览完全一致', () => {
    delete process.env.COMPLIANCE_CANDIDATE_RULES;
    expect(candidateRulesPreviewEnabled()).toBe(false);
    for (const text of Object.values(MISSED)) {
      const off = evaluateDomesticContent(text, { candidatePreview: false });
      const implicit = evaluateDomesticContent(text);
      expect(implicit.level).toBe(off.level);
      expect(implicit.passed).toBe(off.passed);
      expect(implicit.hits.map((hit) => hit.ruleId)).toEqual(off.hits.map((hit) => hit.ruleId));
      expect(implicit.rulesChecked).toBe(off.rulesChecked);
      expect(implicit.hits.map((hit) => hit.ruleId).some((id) => id.startsWith('CN-CAND-'))).toBe(false);
    }
    expect(evaluateDomesticContent(MISSED.immunity).level).toBe('clear');
    expect(evaluateDomesticContent(MISSED.height).level).toBe('clear');
    expect(evaluateDomesticContent(MISSED.cold).level).toBe('clear');
    expect(evaluateDomesticContent(MISSED.absolute).level).toBe('clear');
    expect(evaluateDomesticContent(MISSED.sideEffect).level).toBe('clear');
    expect(evaluateDomesticContent(MISSED.patient).level).toBe('clear');
    expect(evaluateDomesticContent(MISSED.efficacyRate).level).toBe('clear');

    process.env.COMPLIANCE_CANDIDATE_RULES = 'true';
    expect(candidateRulesPreviewEnabled()).toBe(false);
    expect(evaluateDomesticContent(MISSED.immunity).level).toBe('clear');
    expect(evaluateDomesticContent(MISSED.absolute).hits).toEqual([]);
  });
});

describe('COMPLIANCE_CANDIDATE_RULES=preview 时只作需复核', () => {
  const previous = process.env.COMPLIANCE_CANDIDATE_RULES;
  afterEach(() => {
    if (previous === undefined) delete process.env.COMPLIANCE_CANDIDATE_RULES;
    else process.env.COMPLIANCE_CANDIDATE_RULES = previous;
  });

  function previewHit(text: string, ruleId: string) {
    const result = evaluateDomesticContent(text, { candidatePreview: true });
    return result.hits.find((hit) => hit.ruleId === ruleId);
  }

  it('食品预防、保健功能和绝对化承诺都返回需复核，且不拦截', () => {
    process.env.COMPLIANCE_CANDIDATE_RULES = 'preview';
    const fromEnv = evaluateDomesticContent(MISSED.immunity);
    expect(fromEnv.passed).toBe(true);
    expect(fromEnv.level).toBe('risk');
    expect(fromEnv.hits.find((hit) => hit.ruleId === 'CN-CAND-FOOD-DISEASE')).toMatchObject({
      severity: 'review',
      label: '需复核',
    });
    expect(fromEnv.hits.find((hit) => hit.ruleId === 'CN-CAND-HEALTH-FUNCTION')?.matchedTerms.join('|')).toContain('增强免疫力');
    expect(fromEnv.rulesChecked).toBe(
      evaluateDomesticContent(MISSED.immunity, { candidatePreview: false }).rulesChecked + DOMESTIC_CANDIDATE_RULES.length,
    );

    expect(previewHit(MISSED.cold, 'CN-CAND-FOOD-DISEASE')?.matchedTerms).toContain('预防感冒');
    expect(previewHit(MISSED.height, 'CN-CAND-HEALTH-FUNCTION')?.matchedTerms.join('|')).toContain('长高5厘米');
    const absolute = previewHit(MISSED.absolute, 'CN-CAND-ABSOLUTE-CLAIM');
    expect(absolute?.severity).toBe('review');
    expect(absolute?.label).toBe('需复核');
    const terms = absolute?.matchedTerms.join('|') ?? '';
    expect(terms).toContain('长沙第一');
    expect(terms).toContain('绝对正宗');
    expect(terms).toContain('包你满意');
    expect(terms).toContain('100%好评');
    expect(evaluateDomesticContent(MISSED.absolute, { candidatePreview: true }).passed).toBe(true);

    expect(previewHit(MISSED.sideEffect, 'CN-CAND-NO-SIDE-EFFECT')?.matchedTerms).toEqual(
      expect.arrayContaining(['无副作用', '一次见效']),
    );
    expect(previewHit(MISSED.patient, 'CN-CAND-PATIENT-TESTIMONY')?.label).toBe('需复核');
    expect(previewHit(MISSED.efficacyRate, 'CN-CAND-CURE-RATE')?.matchedTerms.join('|')).toContain('有效率达90%');
  });

  it('治愈率在预览中补上第十六条的需复核；关闭预览时仍只走原有拦截，不出现候选规则', () => {
    const off = evaluateDomesticContent(MISSED.cureRate);
    expect(off.passed).toBe(false);
    expect(off.hits.map((hit) => hit.ruleId)).toContain('CN-INDUSTRY-001');
    expect(off.hits.map((hit) => hit.ruleId)).not.toContain('CN-CAND-CURE-RATE');

    const on = evaluateDomesticContent(MISSED.cureRate, { candidatePreview: true });
    expect(on.passed).toBe(false);
    expect(on.hits.find((hit) => hit.ruleId === 'CN-CAND-CURE-RATE')).toMatchObject({
      severity: 'review',
      label: '需复核',
    });
  });

  it('普通说法和「第一步」不会被候选规则标成需复核', () => {
    for (const text of ['今天分享一个周末早餐搭配', '第一步：先洗手', '10个技巧', '分享三条团队协作的最佳实践']) {
      const result = evaluateDomesticContent(text, { candidatePreview: true });
      expect(result.hits.filter((hit) => hit.ruleId.startsWith('CN-CAND-'))).toEqual([]);
    }
  });
});

describe('非投资语境的「绝对安全」改归安全性绝对化保证', () => {
  it('儿童座椅绝对安全不再算收益保证，但仍拦截', () => {
    const result = evaluateDomesticContent('这款儿童座椅绝对安全');
    expect(result.passed).toBe(false);
    expect(result.level).toBe('violation');
    const safety = result.hits.find((hit) => hit.ruleId === 'CN-AD-SAFETY-ASSERTION');
    expect(safety).toMatchObject({
      severity: 'block',
      reason: '疑似对安全性作出绝对化保证',
      matchedTerms: ['绝对安全'],
    });
    expect(safety?.source).toContain('第十六条');
    expect(safety?.source).toContain('安全性的断言或者保证');
    expect(result.hits.map((hit) => hit.ruleId)).not.toContain('CN-AD-ART25');
  });

  it('理财产品绝对安全仍按收益保证拦截，不降级', () => {
    const result = evaluateDomesticContent('这款理财产品绝对安全');
    expect(result.passed).toBe(false);
    const guarantee = result.hits.find((hit) => hit.ruleId === 'CN-AD-ART25');
    expect(guarantee?.severity).toBe('block');
    expect(guarantee?.reason).toContain('收益');
    expect(guarantee?.matchedTerms).toContain('绝对安全');
    expect(result.hits.map((hit) => hit.ruleId)).not.toContain('CN-AD-SAFETY-ASSERTION');
  });

  it('本金绝对安全仍归收益保证；必涨闭眼买入的原分类不变', () => {
    const principal = evaluateDomesticContent('本金绝对安全');
    expect(principal.hits.find((hit) => hit.ruleId === 'CN-AD-ART25')?.matchedTerms).toContain('绝对安全');
    expect(principal.hits.map((hit) => hit.ruleId)).not.toContain('CN-AD-SAFETY-ASSERTION');

    const fund = evaluateDomesticContent('这只基金明天必涨，闭眼买入，没有任何风险。');
    expect(fund.passed).toBe(false);
    expect(fund.hits.map((hit) => hit.ruleId)).toContain('CN-AD-ART25');
    expect(fund.hits.map((hit) => hit.ruleId)).not.toContain('CN-AD-SAFETY-ASSERTION');
  });

  it('没有投资词时，「没有任何风险」仍走原规则，「绝对安全」单独归安全性', () => {
    const result = evaluateDomesticContent('这款奶粉没有任何风险，绝对安全');
    const guarantee = result.hits.find((hit) => hit.ruleId === 'CN-AD-ART25');
    expect(guarantee?.matchedTerms.join('|')).toContain('没有任何风险');
    expect(guarantee?.matchedTerms).not.toContain('绝对安全');
    expect(result.hits.find((hit) => hit.ruleId === 'CN-AD-SAFETY-ASSERTION')?.severity).toBe('block');
    expect(result.passed).toBe(false);
  });
});
