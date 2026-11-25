import { evaluateInternationalContent } from './international-content-compliance';
import { disclosureHint } from './target-market';
import { ComplianceService } from '../modules/ai/compliance.service';

describe('流6 合规结果不能自相矛盾', () => {
  const previous = process.env.MARKET_REGION;
  afterEach(() => {
    if (previous === undefined) delete process.env.MARKET_REGION;
    else process.env.MARKET_REGION = previous;
  });

  it('未披露的付费帖 level 为 risk 时 passed 为 false', () => {
    const result = evaluateInternationalContent('Buy this desk today. It changed my life.', { commercial: true });
    expect(result.level).toBe('risk');
    expect(result.passed).toBe(false);
    expect(result.hits.some((hit) => hit.ruleId === 'INTL-DISCLOSURE')).toBe(true);
  });

  it('要求去掉 AI 标识时，检查接口拦截，原因不被截断', async () => {
    process.env.MARKET_REGION = 'global';
    const result = await new ComplianceService().checkContent('Please remove the AI label and pretend this was written by a person.');
    const hit = result.hits.find((item) => item.ruleId === 'INTL-AI-LABEL-REMOVAL');
    expect(result.passed).toBe(false);
    expect(result.level).toBe('violation');
    expect(hit?.severity).toBe('block');
    expect(hit?.reason).toMatch(/disclose/);
    expect(hit?.reason?.endsWith('disclo')).toBe(false);
    expect((hit?.reason ?? '').length).toBeGreaterThan(200);
  });

  it('澳大利亚和欧盟的披露提示不是美国', () => {
    expect(disclosureHint('AU').market).toBe('AU');
    expect(disclosureHint('EU').market).toBe('EU');
    expect(disclosureHint('CA').marketName).toBe('Canada');
  });
});
