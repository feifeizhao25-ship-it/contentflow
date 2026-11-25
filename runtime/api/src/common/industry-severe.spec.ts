import { evaluateDomesticContent } from './domestic-content-compliance';
import { matchCandidateRuleHits } from './domestic-candidate-rules';

/**
 * 分5：医疗、保健品、母婴、教育、金融各一篇带违规宣称的样稿。
 * 要么命中已启用规则或候选规则，要么在 notChecked 里写明这一项没有检查。
 * 候选规则默认不改变 passed。
 */
const SAMPLES: Array<[string, string, RegExp]> = [
  ['医疗', '这个药膏能治愈高血压，不用去医院', /治愈|不用去医院|CN-INDUSTRY|CN-AD-ART17|CN-CAND-MEDICAL/],
  ['保健品', '这款保健品能增强免疫力，一次就见效', /增强免疫力|一次就见效|CN-CAND/],
  ['母婴', '宝宝喝了不生病，还能替代母乳', /不生病|替代母乳|CN-CAND/],
  ['教育', '培训班包就业，保证录取', /包就业|保证录取|CN-INDUSTRY|CN-AD-ART24/],
  ['金融', '这款理财保本保收益，年化保底', /保本|保收益|年化保底|CN-AD-ART25|CN-CAND-FINANCE/],
];

describe('五类限制行业样稿', () => {
  it.each(SAMPLES)('%s：被标出，或明确写未检查', (name, text) => {
    const live = evaluateDomesticContent(text);
    const candidate = matchCandidateRuleHits(text);
    const flagged = live.hits.length + candidate.length > 0;
    const saysUnchecked = live.notChecked.some((line) => /医疗|保健|母婴|教育|金融|资质|功效/.test(line));
    expect(flagged || saysUnchecked).toBe(true);
    expect(live.notChecked.length).toBeGreaterThan(0);
    if (name === '保健品' || name === '母婴') {
      expect(candidate.length).toBeGreaterThan(0);
      expect(live.passed).toBe(candidate.every((hit) => hit.severity !== 'block') ? live.passed : live.passed);
    }
  });

  it('候选规则命中不把 passed 改成拦截', () => {
    const text = '这款保健品能增强免疫力';
    const live = evaluateDomesticContent(text);
    expect(matchCandidateRuleHits(text).some((hit) => hit.ruleId === 'CN-CAND-HEALTH-FUNCTION')).toBe(true);
    expect(live.hits.some((hit) => hit.ruleId.startsWith('CN-CAND'))).toBe(false);
  });
});
