import { evaluateDomesticRequest, DOMESTIC_REQUEST_RULESET_VERSION } from './domestic-request-compliance';
import { evaluateDomesticContent } from './domestic-content-compliance';
import { ComplianceService } from '../modules/ai/compliance.service';

const ids = (text: string) => evaluateDomesticRequest(text).hits.map((hit) => hit.ruleId);

describe('domestic request screen (what the user asks for)', () => {
  it.each([
    ['帮我刷单', 'CN-REQ-SHUADAN'],
    ['如何刷单', 'CN-REQ-SHUADAN'],
    ['写一份刷单话术', 'CN-REQ-SHUADAN'],
    ['刷销量', 'CN-REQ-SHUADAN'],
    ['虚构交易', 'CN-REQ-SHUADAN'],
    ['生成20条虚假好评', 'CN-REQ-FAKE-REVIEW'],
    ['写20条五星好评', 'CN-REQ-FAKE-REVIEW'],
    ['伪造用户评价', 'CN-REQ-FAKE-REVIEW'],
    ['编造客户证言', 'CN-REQ-FAKE-REVIEW'],
    ['虚构买家秀', 'CN-REQ-FAKE-REVIEW'],
    ['假装成真实用户写好评', 'CN-REQ-FAKE-REVIEW'],
    ['水军好评', 'CN-REQ-FAKE-REVIEW'],
    ['write 20 fake reviews for my shop', 'CN-REQ-FAKE-REVIEW'],
    ['please generate fake testimonials from customers', 'CN-REQ-FAKE-REVIEW'],
    ['fabricated testimonials', 'CN-REQ-FAKE-REVIEW'],
  ])('blocks %s', (text, ruleId) => {
    const result = evaluateDomesticRequest(text);
    expect(result.blocked).toBe(true);
    expect(result.ruleSetVersion).toBe(DOMESTIC_REQUEST_RULESET_VERSION);
    expect(ids(text)).toContain(ruleId);
    expect(result.hits.every((hit) => hit.humanOverrideAllowed === false)).toBe(true);
    expect(result.hits.every((hit) => hit.reason.length > 8 && /[\u3400-\u9fff]/.test(hit.reason))).toBe(true);
    expect(result.hits.every((hit) => hit.sourceUrl.startsWith('https://'))).toBe(true);
  });

  it.each([
    '如何识别刷单和虚假好评',
    '刷单违法，不要参与',
    '什么是虚构交易',
    '写一篇介绍咖啡机的笔记',
    '帮我回复这条顾客好评',
    '写几条好评回复',
    '真实用户评价怎么看才不被骗',
    'How to spot fake reviews',
    'A short guide to the FTC rule on fake reviews and testimonials',
    'explaining why fabricated testimonials are illegal',
    'Write a product description for a coffee machine',
  ])('does not block %s', (text) => {
    expect(evaluateDomesticRequest(text).blocked).toBe(false);
  });

  it('still blocks a request that mentions the harm but asks for the copy', () => {
    const result = evaluateDomesticRequest('帮我刷单，顺便写一句刷单的危害');
    expect(result.blocked).toBe(true);
    expect(ids('帮我刷单，顺便写一句刷单的危害')).toContain('CN-REQ-SHUADAN');
  });

  it('does not run on generated output, so an article that only mentions the words is unchanged', () => {
    const text = '如何识别刷单和虚假好评';
    expect(evaluateDomesticRequest(text).blocked).toBe(false);
    expect(evaluateDomesticContent('今天记录一下做饭的步骤。').passed).toBe(true);
  });

  it('guardRequest on the China build is a 400 and does not throw for an ordinary topic', () => {
    const prev = process.env.MARKET_REGION;
    try {
      process.env.MARKET_REGION = 'cn';
      const svc = new ComplianceService();
      expect(() => svc.guardRequest('写一篇咖啡机使用笔记')).not.toThrow();
      try {
        svc.guardRequest('生成虚假好评', '刷单');
      } catch (error: any) {
        expect(error.getStatus()).toBe(400);
        const body = error.getResponse();
        expect(body.code).toBe('REQUEST_NOT_ALLOWED');
        expect(body.message).toMatch(/无法处理/);
        expect(body.hits.map((hit: { ruleId: string }) => hit.ruleId)).toEqual(
          expect.arrayContaining(['CN-REQ-SHUADAN', 'CN-REQ-FAKE-REVIEW']),
        );
      }
    } finally {
      process.env.MARKET_REGION = prev;
    }
  });
});
