/**
 * Regression for the 2026-11-21 real DeepSeek UI test:
 * - viral analysis was cut off at 1500 tokens and gave 8.5/10 plus a "reusable template" to copy with illegal claims;
 * - the compliance screen missed 100%无糖 / 糖尿病人放心吃 / 美白祛斑 / 医院同款 / 绝对低价 / 好评返现 and
 *   "erases wrinkles forever" / "lowest price ever" / "cure fatigue";
 * - a blocked content pack only said "fix the matched rules" without naming them.
 * Every case below reproduces text from ev/api_real. No model is called.
 */
import { BadRequestException } from '@nestjs/common';
import { evaluateDomesticContent } from '../../common/domestic-content-compliance';
import { evaluateInternationalContent } from '../../common/international-content-compliance';
import { AIService } from './ai.service';
import { ComplianceService, describeBlockingHits } from './compliance.service';
import { applyViralCompliance, parseViralAnalysis, VIRAL_MAX_TOKENS, VIRAL_REVIEW_SCORE_CAP, viralReviewHint } from './viral-analysis';

const ids = (r: { hits: Array<{ ruleId: string }> }) => r.hits.map((h) => h.ruleId);
const hit = (r: { hits: Array<{ ruleId: string; severity: string; matchedTerms: string[] }> }, id: string) => r.hits.find((h) => h.ruleId === id);

describe('domestic rules added 2026-11-21', () => {
  it.each([
    ['本店面包100%无糖', 'CN-AD-RISK-001', 'block', '100%无糖'],
    ['糖尿病人也能放心吃', 'CN-AD-ART17-18', 'block', '糖尿病人也能放心吃'],
    ['高血压患者放心喝', 'CN-AD-ART17-18', 'block', '高血压患者放心喝'],
    ['这款精华美白祛斑，一周见效', 'CN-COSMETIC-ART16', 'review', '美白祛斑'],
    ['美白祈斑小妙招', 'CN-COSMETIC-ART16', 'review', '美白祈斑'],
    ['医院同款修复霜', 'CN-AD-ART17-MEDICAL', 'block', '医院同款'],
    ['双十一绝对低价', 'CN-AD-SUPERLATIVE', 'review', '绝对低价'],
    ['收货好评返现5元', 'CN-UNFAIR-ART9-5', 'block', '好评返现'],
  ])('%s -> %s', (text, ruleId, severity, term) => {
    const r = evaluateDomesticContent(text);
    const h = hit(r, ruleId);
    expect(h).toBeDefined();
    expect(h!.severity).toBe(severity);
    expect(h!.matchedTerms.join('|')).toContain(term);
    expect(r.level).not.toBe('clear');
  });

  it('the bakery copy from the test is now a violation, not clear', () => {
    const r = evaluateDomesticContent('本店面包全网最好吃，吃了不长胖，100%无糖，糖尿病人也能放心吃！');
    expect(r.passed).toBe(false);
    expect(ids(r)).toEqual(expect.arrayContaining(['CN-AD-RISK-001', 'CN-AD-ART17-18', 'CN-AD-SUPERLATIVE']));
  });

  it.each([
    '周末低糖全麦面包出炉啦，甜味比较淡',
    '这家医院的挂号流程分享',
    '欢迎大家收货后留下真实评价',
    '保过期食品请勿食用',
    '控糖人群请先咨询医生再选择',
  ])('ordinary copy stays clear of the new rules: %s', (text) => {
    const r = evaluateDomesticContent(text);
    for (const id of ['CN-AD-ART17-MEDICAL', 'CN-UNFAIR-ART9-5', 'CN-COSMETIC-ART16', 'CN-AD-ART17-18']) expect(ids(r)).not.toContain(id);
  });

  it('every new rule carries a source URL and the day it was checked', () => {
    const r = evaluateDomesticContent('医院同款 好评返现 美白祛斑');
    for (const h of r.hits) {
      expect(h.sourceUrl).toMatch(/^https:\/\//);
      expect(h.sourceRetrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('international rules added 2026-11-21', () => {
  it.each([
    ['This cream erases wrinkles forever.', 'INTL-PERMANENT-COSMETIC'],
    ['Permanently removes dark spots in a week', 'INTL-PERMANENT-COSMETIC'],
    ['Lowest price ever, 90% off, only today', 'INTL-PRICE-CLAIM'],
    ['Our tea cures fatigue and boosts metabolism', 'INTL-HEALTH-BENEFIT'],
    ['Melts belly fat while you sleep', 'INTL-HEALTH-BENEFIT'],
  ])('%s -> %s', (text, ruleId) => {
    const r = evaluateInternationalContent(text);
    expect(ids(r)).toContain(ruleId);
    expect(r.level).not.toBe('clear');
    expect(hit(r, ruleId)!.matchedTerms.length).toBeGreaterThan(0);
  });

  it.each([
    'Our prices are low all week',
    'A moisturiser for dry skin',
    'Feeling tired? Here is how I plan my sleep',
    'Fine lines are a normal part of ageing',
  ])('ordinary copy does not hit the new rules: %s', (text) => {
    const r = evaluateInternationalContent(text);
    for (const id of ['INTL-PERMANENT-COSMETIC', 'INTL-PRICE-CLAIM', 'INTL-HEALTH-BENEFIT']) expect(ids(r)).not.toContain(id);
  });

  it('new hits record the day the source was opened', () => {
    const r = evaluateInternationalContent('Lowest price ever');
    expect(hit(r, 'INTL-PRICE-CLAIM')).toMatchObject({ sourceRetrievedAt: '2026-11-21' });
  });
});

describe('parseViralAnalysis', () => {
  it('an empty successful response becomes a readable result', () => {
    const out = parseViralAnalysis('', { completionTokens: VIRAL_MAX_TOKENS, maxTokens: VIRAL_MAX_TOKENS, english: true });
    expect(out.analysis.incomplete).toBe(true);
    expect(out.analysis.notice).toContain('No complete analysis');
    expect(out.analysis.raw_analysis).toBeUndefined();
  });

  it('reads JSON wrapped in a code fence', () => {
    const out = parseViralAnalysis('```json\n{"hook": "strong"}\n```', { completionTokens: 50, maxTokens: VIRAL_MAX_TOKENS, english: true });
    expect(out).toEqual({ analysis: { hook: 'strong' }, truncated: false });
  });

  it('a cut-off answer is marked truncated, trimmed to the last full line and explained', () => {
    const raw = '{\n  "1_标题": {\n    "评分": 8.5,\n    "技巧": "极限词"\n  },\n  "2_开头": "利益钩：好吃、不';
    const out = parseViralAnalysis(raw, { completionTokens: VIRAL_MAX_TOKENS, maxTokens: VIRAL_MAX_TOKENS, english: false });
    expect(out.truncated).toBe(true);
    expect(out.analysis.truncated).toBe(true);
    expect(out.analysis.raw_analysis.endsWith('},')).toBe(true);
    expect(out.analysis.notice).toMatch(/截断/);
  });

  it('the token cap is above the old 1500 and below the 4000-token hold', () => {
    expect(VIRAL_MAX_TOKENS).toBeGreaterThan(1500);
    expect(VIRAL_MAX_TOKENS).toBeLessThan(4000);
  });
});

describe('applyViralCompliance', () => {
  const analysis = {
    '1_标题吸引力评分和技巧': { 评分: 8.5, 技巧: ['极限词'] },
    '5_可复制的模板': { 模板: '本店{产品}全网最{口感词}' },
    nested: { '可复制变体': ['x'], note: 'keep' },
  };

  it('a block-level hit withholds the score, drops the template and names the rules', () => {
    const screen = evaluateDomesticContent('糖尿病人也能放心吃');
    const out = applyViralCompliance(analysis, screen, false);
    expect(out.appeal_score).toBeNull();
    expect(out['5_可复制的模板']).toBeUndefined();
    expect(out.nested).toBeUndefined();
    expect(out.compliance).toMatchObject({ level: 'violation', templateWithheld: true, scorePolicy: 'withheld' });
    expect(out.compliance.hits.map((h: any) => h.ruleId)).toContain('CN-AD-ART17-18');
    expect(out.compliance.notice).toContain('CN-AD-ART17-18');
  });

  it('review-only hits keep the analysis, cap every score at 6/10 and flag 需人工复核', () => {
    const screen = evaluateDomesticContent('这款精华美白祛斑');
    expect(screen.hits.every((h) => h.severity === 'review')).toBe(true);
    const out = applyViralCompliance(analysis, screen, false);
    expect(out['1_标题吸引力评分和技巧'].评分).toBe(VIRAL_REVIEW_SCORE_CAP);
    expect(out['1_标题吸引力评分和技巧'].技巧).toEqual(['极限词']);
    expect(out['5_可复制的模板']).toBeDefined();
    expect(out.compliance).toMatchObject({
      needsHumanReview: true, scorePolicy: 'capped', scoreCap: 6, scoreScale: 10, templateWithheld: false,
    });
    expect(out.compliance.reviewRuleIds).toContain('CN-COSMETIC-ART16');
    expect(out.compliance.notice).toContain('需人工复核');
    expect(out.compliance.notice).toContain('CN-COSMETIC-ART16');
  });

  it('review-only: scores under any key, in strings, in prose and on a 100-point scale are capped', () => {
    const screen = evaluateInternationalContent('Lowest price ever');
    const out = applyViralCompliance({
      headline: { score: '8.5/10', rating: 9, appeal_score: '9.5' },
      summary: 'Overall 9/10, hook 92/100, takes 3 minutes',
      nested: [{ hook_score: 88 }],
      low: { score: 4 },
      reusable_template: 'x',
    }, screen, true);
    expect(out.headline).toEqual({ score: '6/10', rating: 6, appeal_score: '6' });
    expect(out.summary).toBe('Overall 6/10, hook 60/100, takes 3 minutes');
    expect(out.nested[0].hook_score).toBe(60);
    expect(out.low.score).toBe(4);
    expect(out.reusable_template).toBe('x');
    expect(out.compliance.reviewRuleIds).toContain('INTL-PRICE-CLAIM');
    expect(out.compliance.notice).toMatch(/^Needs human review/);
    expect(out.compliance.notice).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('a block-level hit still withholds everything even when review hits are present', () => {
    const screen = evaluateInternationalContent('Lowest price ever and it cures diabetes');
    expect(screen.hits.some((h) => h.severity === 'block')).toBe(true);
    expect(screen.hits.some((h) => h.severity === 'review')).toBe(true);
    const out = applyViralCompliance({ summary: 'Rating 99/100; copy this', arbitrary: { value: 99 } }, screen, true);
    expect(out.summary).toBeUndefined();
    expect(out.arbitrary).toBeUndefined();
    expect(out.appeal_score).toBeNull();
    expect(out.reusable_template).toBeNull();
    expect(out.compliance.scorePolicy).toBe('withheld');
    expect(out.compliance.notice).toContain('INTL-DISEASE-CLAIM');
  });

  it('viralReviewHint names review rules and the cap, and is empty for clean copy', () => {
    expect(viralReviewHint(evaluateDomesticContent('周末低糖全麦面包出炉啦'), false)).toBe('');
    const hint = viralReviewHint(evaluateDomesticContent('双十一绝对低价'), false);
    expect(hint).toContain('CN-AD-SUPERLATIVE');
    expect(hint).toContain('6/10');
    expect(viralReviewHint(evaluateInternationalContent('Lowest price ever'), true)).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('clean copy keeps its score and template', () => {
    const out = applyViralCompliance(analysis, evaluateDomesticContent('周末低糖全麦面包出炉啦'), false);
    expect(out['1_标题吸引力评分和技巧'].评分).toBe(8.5);
    expect(out['5_可复制的模板']).toBeDefined();
    expect(out.compliance).toMatchObject({ level: 'clear', templateWithheld: false });
  });

  it('a truncated raw string with hits loses its template section and its score', () => {
    const raw = '{\n  "1_标题": {\n    "评分": 8.5\n  },\n  "5_可复制的模板": {\n    "模板": "本店{产品}全网最好吃"';
    const out = applyViralCompliance({ raw_analysis: raw, truncated: true }, evaluateDomesticContent('医院同款'), false);
    expect(out.raw_analysis).toBeUndefined();
    expect(out.appeal_score).toBeNull();
  });
});

describe('AIService.analyzeViralContentWithUsage', () => {
  const previous = process.env.MARKET_REGION;
  afterEach(() => { process.env.MARKET_REGION = previous; });
  const usage = { prompt_tokens: 100, completion_tokens: 300, total_tokens: 400 };

  const make = (region: string, content: string) => {
    process.env.MARKET_REGION = region;
    // Placeholder provider value only so the domestic constructor accepts the config; no network call is made.
    const values: Record<string, string> = { MARKET_REGION: region, DEEPSEEK_API_KEY: 'test-placeholder' };
    const config = { get: (k: string, d?: unknown) => values[k] ?? d };
    const service = new AIService({} as never, config as never);
    const generateTextForMarket = jest.fn().mockResolvedValue({ content, model: 'm', provider: 'deepseek', latency_ms: 5, cost_amount: 0.01, usage });
    (service as any).generateTextForMarket = generateTextForMarket;
    return { service, generateTextForMarket };
  };

  it('domestic copy with illegal claims: no model call, no score or template, rules named', async () => {
    const { service, generateTextForMarket } = make('cn', '{"标题评分": 8.5, "可复制的模板": "{人群}也能放心吃"}');
    const out = await service.analyzeViralContentWithUsage('本店面包100%无糖，糖尿病人也能放心吃！医院同款配方');
    expect(generateTextForMarket).not.toHaveBeenCalled();
    expect(out.usage.total_tokens).toBe(0);
    expect(out.analysis.appeal_score).toBeNull();
    expect(out.analysis.reusable_template).toBeNull();
    expect(out.analysis.compliance.hits.map((h: any) => h.ruleId)).toEqual(expect.arrayContaining(['CN-AD-RISK-001', 'CN-AD-ART17-18', 'CN-AD-ART17-MEDICAL']));
    expect(out.analysis.compliance.notice).toContain('这不是法律意见');
  });

  it('international copy with a disease claim: no model call, English notice', async () => {
    const { service, generateTextForMarket } = make('global', '{"headline_score": 9, "reusable_template": "x"}');
    const out = await service.analyzeViralContentWithUsage('This tea cures diabetes');
    expect(generateTextForMarket).not.toHaveBeenCalled();
    expect(out.analysis.appeal_score).toBeNull();
    expect(out.analysis.compliance.hits.map((h: any) => h.ruleId)).toContain('INTL-DISEASE-CLAIM');
    expect(out.analysis.compliance.notice).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('international review-only health claim: model is called with the review hint, score capped', async () => {
    const { service, generateTextForMarket } = make('global', '{"headline_score": 9, "reusable_template": "x"}');
    const out = await service.analyzeViralContentWithUsage('This tea cures fatigue and boosts metabolism');
    expect(generateTextForMarket).toHaveBeenCalledTimes(1);
    const prompt = generateTextForMarket.mock.calls[0][0].prompt;
    expect(prompt).toContain('INTL-HEALTH-BENEFIT');
    expect(prompt).toContain('6/10');
    expect(out.analysis.headline_score).toBe(6);
    expect(out.analysis.reusable_template).toBe('x');
    expect(out.analysis.compliance).toMatchObject({ needsHumanReview: true, scorePolicy: 'capped' });
    expect(out.analysis.compliance.reviewRuleIds).toContain('INTL-HEALTH-BENEFIT');
  });

  it('domestic review-only copy: analysis returned with 需人工复核', async () => {
    const { service, generateTextForMarket } = make('cn', '{"标题评分": 9.5, "可复制的模板": "{产品}限时价"}');
    const out = await service.analyzeViralContentWithUsage('双十一绝对低价，错过等一年');
    expect(generateTextForMarket).toHaveBeenCalledTimes(1);
    expect(out.analysis.标题评分).toBe(6);
    expect(out.analysis.compliance.notice).toContain('需人工复核');
    expect(out.usage.total_tokens).toBe(400);
  });

  it('clean copy: no compliance block in the prompt and the score is kept', async () => {
    const { service, generateTextForMarket } = make('cn', '```json\n{"标题评分": 8}\n```');
    const out = await service.analyzeViralContentWithUsage('周末低糖全麦面包出炉啦');
    expect(generateTextForMarket.mock.calls[0][0].maxTokens).toBe(VIRAL_MAX_TOKENS);
    expect(out.analysis.标题评分).toBe(8);
    expect(out.analysis.compliance.level).toBe('clear');
  });
});

describe('a blocked content pack names the rule that matched', () => {
  const previous = process.env.MARKET_REGION;
  afterEach(() => { process.env.MARKET_REGION = previous; });

  it('domestic: message lists rule id, reason and the matched word', async () => {
    process.env.MARKET_REGION = 'cn';
    const err = await new ComplianceService().scrubOutput('坚持三个月可以根治失眠').catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    const body = err.getResponse() as any;
    expect(body.code).toBe('CONTENT_COMPLIANCE_BLOCKED');
    expect(body.message).toContain('CN-INDUSTRY-001');
    expect(body.message).toContain('“根治”');
    expect(body.message).toContain('这不是法律意见');
    expect(body.hits.length).toBeGreaterThan(0);
  });

  it('global: English message lists the rule, no Chinese', async () => {
    process.env.MARKET_REGION = 'global';
    const err = await new ComplianceService().scrubOutput('This supplement cures diabetes').catch((e) => e);
    const body = err.getResponse() as any;
    expect(body.message).toContain('INTL-DISEASE-CLAIM');
    expect(body.message).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('review-only hits are not listed as blocking', () => {
    expect(describeBlockingHits([{ ruleId: 'X', severity: 'review', reason: 'r', matchedTerms: ['a'] }], false)).toBe('');
  });
});
