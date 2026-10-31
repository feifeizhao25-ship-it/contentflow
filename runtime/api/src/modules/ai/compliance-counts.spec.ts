import { evaluateDomesticContent, DOMESTIC_NOT_CHECKED } from '../../common/domestic-content-compliance';
import { evaluateInternationalContent } from '../../common/international-content-compliance';
import { ComplianceCheckController } from './compliance-check.controller';
import { ComplianceService } from './compliance.service';

describe('compliance rule counts and unchecked items', () => {
  it('domestic result reports hit counts, rules run and what was not checked', () => {
    const r = evaluateDomesticContent('这款面膜全国最好，保本无风险，加微信领取');
    expect(r.hitCounts.total).toBe(r.hits.length);
    expect(r.hitCounts.block).toBeGreaterThan(0);
    expect(r.hitCounts.review).toBeGreaterThan(0);
    expect(r.hitCounts.block + r.hitCounts.review).toBe(r.hitCounts.total);
    expect(r.rulesChecked).toBeGreaterThan(10);
    expect(r.notChecked).toEqual([...DOMESTIC_NOT_CHECKED]);
  });

  it('a clear domestic result still lists what was not checked (clear is not "approved")', () => {
    const r = evaluateDomesticContent('今天记录一下做饭的步骤。');
    expect(r.level).toBe('clear');
    expect(r.hitCounts).toEqual({ block: 0, review: 0, total: 0 });
    expect(r.notChecked.length).toBeGreaterThan(3);
  });

  it('international result carries hit counts', () => {
    const r = evaluateInternationalContent('Guaranteed 10x returns, risk-free!');
    expect(r.hitCounts.block).toBeGreaterThan(0);
    expect(r.hitCounts.total).toBe(r.hits.length);
  });

  describe('check endpoint', () => {
    const rag = { freshnessReport: jest.fn().mockResolvedValue({ needsReview: false }) };
    const make = (region: string) => {
      process.env.MARKET_REGION = region;
      return new ComplianceCheckController(new ComplianceService(), rag as any);
    };
    afterEach(() => { delete process.env.MARKET_REGION; });

    it('domestic response includes hitCounts, rulesChecked and notChecked', async () => {
      const out: any = await make('cn').check({ text: '全国最好的面膜' });
      expect(out.hitCounts.total).toBe(out.hits.length);
      expect(out.rulesChecked).toBeGreaterThan(10);
      expect(out.notChecked.length).toBeGreaterThan(3);
      expect(out.disclosureHint).toBeUndefined();
    });

    it('international response with a target market includes the sourced disclosure hint', async () => {
      const out: any = await make('global').check({ text: 'Try this desk lamp, link in bio.', targetMarket: 'uk' });
      expect(out.targetMarket).toBe('UK');
      expect(out.disclosureHint.sources[0].url).toMatch(/^https:/);
      expect(out.hitCounts).toBeDefined();
    });

    it('international response refuses an unsupported market instead of guessing', async () => {
      await expect(make('global').check({ text: 'hello', targetMarket: 'FR' })).rejects.toThrow(/Unsupported target market/);
    });
  });
});
