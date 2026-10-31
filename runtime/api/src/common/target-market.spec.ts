import { TARGET_MARKETS, disclosureHint, resolveTargetMarket, targetMarketPromptLine } from './target-market';

describe('target market option', () => {
  it('only offers markets that have a sourced hint (Singapore, not "SEA")', () => {
    expect([...TARGET_MARKETS]).toEqual(['US', 'UK', 'IN', 'SG']);
    expect(resolveTargetMarket('sg')).toBe('SG');
    expect(resolveTargetMarket('SEA')).toBeNull();
    expect(resolveTargetMarket('')).toBeNull();
    expect(resolveTargetMarket(undefined)).toBeNull();
  });

  it.each(TARGET_MARKETS)('%s hint has labels, placement and at least one https source with a retrieval date', (m) => {
    const h = disclosureHint(m);
    expect(h.labelExamples.length).toBeGreaterThan(0);
    expect(h.placement.length).toBeGreaterThan(20);
    expect(h.sources.length).toBeGreaterThan(0);
    for (const s of h.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.retrievedAt).toBe('2026-10-31');
    }
    expect(/[\u3400-\u9fff]/.test(JSON.stringify(h))).toBe(false);
  });

  it('UK steers away from "sponsored" alone; India lists the ASCI labels; the prompt line names the market', () => {
    expect(disclosureHint('UK').avoid.join(' ')).toMatch(/sponsored/);
    expect(disclosureHint('IN').labelExamples).toContain('#Ad');
    expect(targetMarketPromptLine('UK')).toContain('United Kingdom');
    expect(targetMarketPromptLine('UK')).toMatch(/Do not invent a brand relationship/);
  });
});
