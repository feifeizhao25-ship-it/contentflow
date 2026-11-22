import { AIController } from './ai.controller';
import { ComplianceService } from './compliance.service';

/**
 * 2026-11-21 real UI test (ContentFlow Global /create): generate/article returned no compliance field and the page
 * never ran a check. "guaranteed to boost your metabolism and cure fatigue!" came back repeated in the H1 and 4 times
 * in the body. International /create now gets a brief precheck and a draft post-check, like the China viral flow.
 */
describe('Global /create compliance (generate/article)', () => {
  const user = { user: { tenantId: 't-1', sub: 'u-1' } };
  let seen: any[];
  let holds: number;
  const build = (content: string) => {
    seen = [];
    holds = 0;
    const ai = {
      generateArticle: async (params: any) => {
        seen.push(params);
        return { content, visualPrompts: [], model: 'deepseek-flash', provider: 'openrouter', latency_ms: 1, cost_amount: null, usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
      },
    };
    const allowance = { withReservation: async (opts: any) => { holds += 1; return (await opts.run()).response; } };
    return new AIController(ai as never, allowance as never, new ComplianceService());
  };
  const prev = process.env.MARKET_REGION;
  beforeEach(() => { process.env.MARKET_REGION = 'global'; });
  afterAll(() => { process.env.MARKET_REGION = prev; });

  it('block-level brief: no quota hold, no model call, rules named', async () => {
    const c = build('unused');
    await expect(c.generateArticle(user, { topic: 'This tea cures diabetes', style: 'Professional English for United States' }))
      .rejects.toMatchObject({ response: { code: 'CONTENT_COMPLIANCE_BLOCKED', stage: 'brief', hits: [expect.objectContaining({ ruleId: 'INTL-DISEASE-CLAIM', severity: 'block' })] } });
    expect(holds).toBe(0);
    expect(seen).toHaveLength(0);
  });

  it('review-level brief: model told not to repeat the claims, draft flagged for human review', async () => {
    const c = build('Metabolism is complex. Talk to a professional before changing your routine.');
    const body: any = await c.generateArticle(user, { topic: 'guaranteed to boost your metabolism and cure fatigue!', style: 'x' });
    expect(seen[0].complianceHint).toMatch(/Do not repeat, quote, or amplify/);
    expect(body.compliance).toMatchObject({ level: 'risk', needsHumanReview: true });
    expect(body.compliance.hits.map((h: any) => h.ruleId)).toEqual(expect.arrayContaining(['INTL-GUARANTEED-RESULT']));
    expect(body.compliance.notice).toMatch(/Needs human review/);
  });

  it('block-level draft is withheld even when the brief was clean', async () => {
    const c = build('# Green tea\nThis tea cures diabetes in a week.');
    await expect(c.generateArticle(user, { topic: 'A guide to brewing green tea', style: 'x' }))
      .rejects.toMatchObject({ response: { code: 'CONTENT_COMPLIANCE_BLOCKED', stage: 'draft' } });
  });

  it('clean brief and draft: compliance clear, still says it is not a clearance to publish', async () => {
    const c = build('Brew at 80 °C for two minutes.');
    const body: any = await c.generateArticle(user, { topic: 'A guide to brewing green tea', style: 'x' });
    expect(seen[0].complianceHint).toBe('');
    expect(body.compliance).toMatchObject({ level: 'clear', needsHumanReview: false, hits: [] });
    expect(body.compliance.notice).toMatch(/does not mean the draft is cleared to publish/);
  });

  it('China edition article path is unchanged (no compliance field, no hint)', async () => {
    process.env.MARKET_REGION = 'cn';
    const c = build('普通内容');
    const body: any = await c.generateArticle(user, { topic: '绿茶冲泡', style: 'x' });
    expect(body.compliance).toBeUndefined();
    expect(seen[0].complianceHint).toBeUndefined();
  });
});
