import { ACCEPTED_TARGET_MARKETS, GENERIC_MARKET, TARGET_MARKETS, disclosureHint, resolveTargetMarket, targetMarketPromptLine } from './target-market';

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

  // 复测 B15：其他国家的创作者没有可选项。
  it('B15: "OTHER" is an accepted market for creators outside US/UK/IN/SG, in any letter case', () => {
    expect([...ACCEPTED_TARGET_MARKETS]).toEqual(['US', 'UK', 'IN', 'SG', 'OTHER']);
    expect(resolveTargetMarket('other')).toBe(GENERIC_MARKET);
    expect(resolveTargetMarket(' Other ')).toBe('OTHER');
    expect(resolveTargetMarket('DE')).toBeNull();
  });

  it('B15: the OTHER hint invents no country rules or labels, cites ICPEN, and tells the user to check the local regulator', () => {
    const h = disclosureHint('OTHER');
    expect(h.labelExamples).toEqual([]);
    expect(h.avoid).toEqual([]);
    expect(h.sources.length).toBeGreaterThan(0);
    for (const src of h.sources) expect(src.url).toMatch(/^https:\/\/(www\.icpen\.org|www\.accc\.gov\.au)\//);
    expect(h.note).toMatch(/not a substitute for legal advice/);
    expect(h.note).toMatch(/local|your own advertising regulator/);
    const line = targetMarketPromptLine('OTHER');
    expect(line).toMatch(/Do not invent a brand relationship/);
    expect(line).not.toMatch(/#ad|"ad"|sponsored/i);
    expect(/[\u3400-\u9fff]/.test(JSON.stringify(h))).toBe(false);
  });
});
