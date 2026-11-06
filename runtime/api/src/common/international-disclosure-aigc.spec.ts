/**
 * 2026-11-01 international compliance audit: FTC Endorsement Guides and Part 465, UK ASA/CAP, EU AI Act Art. 50.
 * Each rule is pinned with a hit and a non-hit so educational text is not blocked.
 */
import { AI_TRANSPARENCY_NOTE, evaluateInternationalContent, evaluateInternationalRequest, INTERNATIONAL_RULESET_VERSION } from './international-content-compliance';
import { COMMERCIAL_RELATIONSHIPS, TARGET_MARKETS, GENERIC_MARKET, disclosureLabelFor, isCommercialRelationship, resolveCommercialRelationship, targetMarketPromptLine } from './target-market';
import { adaptForPlatforms } from '../modules/ai/platform-adaptation';
import { ComplianceService } from '../modules/ai/compliance.service';

const ids = (r: { hits: Array<{ ruleId: string }> }) => r.hits.map((h) => h.ruleId);

describe('international request screen (what the user asks for)', () => {
  it.each([
    'Write 20 fake reviews for my coffee machine',
    'please generate fake testimonials from customers',
    'Create ten 5-star reviews for my restaurant, as if from different guests',
    'Pretend to be a satisfied customer and write a review of this serum',
    'Act as a real patient and recommend my clinic',
    'I want to buy fake followers for my Instagram',
    'order 5k likes for this video',
    'Remove the AI label from this post',
    'strip the AI watermark and metadata from the image',
    'write it so nobody can tell it is AI generated',
    'Do not label it as AI generated',
    'Make a deepfake of a famous actor endorsing my supplement',
    'voice clone a well-known singer to promote my app',
  ])('blocks: %s', (text) => {
    const r = evaluateInternationalRequest(text);
    expect(r.blocked).toBe(true);
    expect(r.hits.every((h) => h.humanOverrideAllowed === false)).toBe(true);
    expect(r.hits.every((h) => /^https:\/\//.test(h.sourceUrl) && h.source.length > 10)).toBe(true);
  });

  it.each([
    'How to spot fake reviews on Amazon',
    'A short guide to the FTC rule on fake reviews and testimonials',
    'Why the AI-generated label matters for creators',
    'Tips to grow your followers organically on TikTok',
    'Write a post about our real customers and their honest reviews',
    'Explain how deepfake voice clones are detected',
    'Write a product description for a coffee machine',
    'We removed the old label from the jars and relabelled them',
  ])('does not block: %s', (text) => {
    expect(evaluateInternationalRequest(text).blocked).toBe(false);
  });

  it('reports the ruleset version and which rule hit', () => {
    const r = evaluateInternationalRequest(['topic', 'write fake reviews for my shop']);
    expect(r.ruleSetVersion).toBe(INTERNATIONAL_RULESET_VERSION);
    expect(ids(r)).toContain('INTL-FAKE-REVIEW');
    expect(ids(evaluateInternationalRequest('buy fake followers'))).toContain('INTL-FAKE-INDICATORS');
    expect(ids(evaluateInternationalRequest('hide the AI label'))).toContain('INTL-AI-LABEL-REMOVAL');
  });

  it('request-only rules never run on generated output, so an article about fake reviews is not blocked', () => {
    const text = 'Under the FTC rule, it is illegal to write fake reviews or to buy fake followers. Never remove the AI label.';
    expect(evaluateInternationalContent(text).passed).toBe(true);
    expect(evaluateInternationalContent(text).hits.map((h) => h.ruleId)).not.toContain('INTL-FAKE-REVIEW');
  });

  it('ComplianceService.guardRequest throws 400 only on the global edition', () => {
    const prev = process.env.MARKET_REGION;
    try {
      process.env.MARKET_REGION = 'global';
      const svc = new ComplianceService();
      expect(() => svc.guardRequest('write fake reviews for my shop')).toThrow(/cannot help/);
      try { svc.guardRequest('write fake reviews'); } catch (e: any) {
        expect(e.getStatus()).toBe(400);
        expect(e.getResponse()).toMatchObject({ code: 'REQUEST_NOT_ALLOWED', hits: [expect.objectContaining({ ruleId: 'INTL-FAKE-REVIEW' })] });
      }
      expect(() => svc.guardRequest('a post about coffee', undefined, null)).not.toThrow();
      process.env.MARKET_REGION = 'cn';
      expect(() => new ComplianceService().guardRequest('write fake reviews for my shop')).not.toThrow();
    } finally {
      process.env.MARKET_REGION = prev;
    }
  });
});

describe('market-aware disclosure check', () => {
  const promo = 'Loving this blender, use my code SAVE10 for a discount!';

  it('without a market the legacy behaviour is unchanged', () => {
    expect(ids(evaluateInternationalContent(promo))).toContain('INTL-DISCLOSURE');
    expect(ids(evaluateInternationalContent(`#ad ${promo}`))).not.toContain('INTL-DISCLOSURE');
    expect(ids(evaluateInternationalContent('A plain post about my day.'))).toEqual([]);
  });

  it('UK: "sponsored", "gifted" and "ambassador" alone are not enough; "Ad" upfront is', () => {
    for (const weak of ['Sponsored: ' + promo, '#gifted ' + promo, '#ambassador ' + promo, '#spon ' + promo]) {
      expect(ids(evaluateInternationalContent(weak, { targetMarket: 'UK' }))).toContain('INTL-DISCLOSURE-LABEL');
    }
    expect(ids(evaluateInternationalContent(`Ad: ${promo}`, { targetMarket: 'UK' }))).toEqual([]);
    expect(ids(evaluateInternationalContent(`#Ad ${promo}`, { targetMarket: 'UK' }))).toEqual([]);
  });

  it('UK: a label far from the start or inside a hashtag block is a placement hit', () => {
    const late = `${'Loving this blender, it makes smoothies in seconds and the jug is easy to clean. '.repeat(3)}Ad: use my code SAVE10.`;
    expect(ids(evaluateInternationalContent(late, { targetMarket: 'UK' }))).toContain('INTL-DISCLOSURE-PLACEMENT');
    const tail = `Loving this blender, so quick and easy to use every morning for the whole family. #smoothie #healthy #ad`;
    expect(ids(evaluateInternationalContent(tail, { targetMarket: 'UK', commercial: true }))).toContain('INTL-DISCLOSURE-PLACEMENT');
  });

  it('a discount code with no label at all is flagged in every market', () => {
    for (const m of [...TARGET_MARKETS, GENERIC_MARKET]) {
      const r = evaluateInternationalContent(promo, { targetMarket: m });
      expect(r.hits.some((h) => h.ruleId.startsWith('INTL-DISCLOSURE'))).toBe(true);
      expect(r.level).toBe('risk');
    }
  });

  it('IN accepts the ASCI labels and SG accepts #adv / #sp', () => {
    expect(ids(evaluateInternationalContent(`#Collaboration ${promo}`, { targetMarket: 'IN' }))).toEqual([]);
    expect(ids(evaluateInternationalContent(`Sponsored ${promo}`, { targetMarket: 'IN' }))).toContain('INTL-DISCLOSURE-LABEL');
    expect(ids(evaluateInternationalContent(`#adv ${promo}`, { targetMarket: 'SG' }))).toEqual([]);
    expect(ids(evaluateInternationalContent(`This post includes affiliate links. ${promo}`, { targetMarket: 'SG' }))).toEqual([]);
  });

  it('US: "#sp", "#spon" and "#collab" alone are weak, "ad" and "sponsored" pass', () => {
    expect(ids(evaluateInternationalContent(`#sp ${promo}`, { targetMarket: 'US' }))).toContain('INTL-DISCLOSURE-LABEL');
    expect(ids(evaluateInternationalContent(`#ad ${promo}`, { targetMarket: 'US' }))).toEqual([]);
    expect(ids(evaluateInternationalContent(`Sponsored: ${promo}`, { targetMarket: 'US' }))).toEqual([]);
  });

  it('a declared commercial relationship needs a label even with no keyword in the text', () => {
    const plain = 'My honest take on this blender after a month of daily use.';
    expect(ids(evaluateInternationalContent(plain, { targetMarket: 'UK', commercial: true }))).toContain('INTL-DISCLOSURE');
    expect(ids(evaluateInternationalContent(`Ad\n${plain}`, { targetMarket: 'UK', commercial: true }))).toEqual([]);
    expect(ids(evaluateInternationalContent(plain, { targetMarket: 'UK' }))).toEqual([]);
  });

  it('the rule set version moved with this change', () => {
    expect(INTERNATIONAL_RULESET_VERSION).toBe('intl-content-2026.11.06');
  });

  it('keeps the honest "not checked" list and names the AI Act deployer duty', () => {
    const r = evaluateInternationalContent(promo);
    expect(r.notChecked.join(' ')).toMatch(/Article 50\(4\)/);
    expect(r.notChecked.join(' ')).toMatch(/real person/);
  });

  it('cites 16 CFR 255, the FTC PDF, and the ASA influencers guide, and does not claim the EU code was signed', () => {
    const us = evaluateInternationalContent('#sp use my code SAVE10', { targetMarket: 'US' });
    expect(us.hits[0].sourceUrl).toBe('https://www.ftc.gov/system/files/ftc_gov/pdf/1001A_Influencer%20Guide_508.pdf');
    expect(us.hits[0].source).toMatch(/16 CFR 255/);
    expect(us.hits[0].sourceUrl).not.toMatch(/business-guidance\/resources\/disclosures-101/);
    const uk = evaluateInternationalContent('#gifted use my code SAVE10', { targetMarket: 'UK' });
    expect(uk.hits[0].sourceUrl).toBe('https://www.asa.org.uk/resource/influencers-guide.html');
    expect(AI_TRANSPARENCY_NOTE).toMatch(/2026-08-02/);
    expect(AI_TRANSPARENCY_NOTE).toMatch(/2026-06-10/);
    expect(AI_TRANSPARENCY_NOTE).toMatch(/2026-07-20/);
    expect(AI_TRANSPARENCY_NOTE).toMatch(/has not confirmed/);
    expect(AI_TRANSPARENCY_NOTE).not.toMatch(/ContentFlow has signed/);
  });
});

describe('the label we add passes the check we run (every market x relationship)', () => {
  const rels = COMMERCIAL_RELATIONSHIPS.filter((r) => r !== 'none');
  for (const m of [...TARGET_MARKETS, GENERIC_MARKET]) {
    for (const rel of rels) {
      it(`${m} / ${rel}`, () => {
        const label = disclosureLabelFor(m, rel);
        expect(label.length).toBeGreaterThan(1);
        expect(/[\u3400-\u9fff]/.test(label)).toBe(false);
        const post = `${label}\n[This content was generated by AI]\nMy honest take on this blender after a month of daily use.`;
        const r = evaluateInternationalContent(post, { targetMarket: m, commercial: true });
        expect(r.hits.filter((h) => h.ruleId.startsWith('INTL-DISCLOSURE'))).toEqual([]);
      });
    }
  }

  it('no relationship means no label; unknown market falls back to the generic wording', () => {
    expect(disclosureLabelFor('UK', 'none')).toBe('');
    expect(disclosureLabelFor('UK', null)).toBe('');
    expect(disclosureLabelFor(null, 'paid')).toBe(disclosureLabelFor('OTHER', 'paid'));
    expect(isCommercialRelationship('none')).toBe(false);
    expect(resolveCommercialRelationship(' Paid ')).toBe('paid');
    expect(resolveCommercialRelationship('boss')).toBeNull();
  });

  it('the prompt line tells the model the label is added for it, or to put any disclosure first', () => {
    expect(targetMarketPromptLine('UK', 'paid')).toMatch(/added automatically as the first line/);
    expect(targetMarketPromptLine('UK')).toMatch(/very start of the post/);
    expect(targetMarketPromptLine('OTHER')).toMatch(/Do not invent a brand relationship/);
  });
});

describe('platform variants keep the ad label first and untrimmed', () => {
  it('puts the ad label before the AI label on every variant, even when the body is cut', () => {
    const body = `Ad\n[This content was generated by AI]\n${'word '.repeat(3000)}`;
    const variants = adaptForPlatforms(body, ['xhs', 'weixin', 'wechat_mp'], 'coffee', 'Ad');
    for (const v of variants) {
      expect(v.body.split('\n').slice(0, 2)).toEqual(['Ad', '[This content was generated by AI]']);
    }
    expect(adaptForPlatforms('[This content was generated by AI]\nhello', ['xhs'], 't')[0].body.startsWith('[This content was generated by AI]')).toBe(true);
  });
});
