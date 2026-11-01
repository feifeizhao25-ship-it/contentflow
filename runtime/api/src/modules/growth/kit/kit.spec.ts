import {
  articleJsonLd, buildShareCard, buildTaggedUrl, checkPage, classify, DEFAULT_POLICY, evaluateReferral, fingerprint, growthFlagsFromEnv,
  hasCjk, isEnglishOnly, makeReferralCode, pairKey, parseAttribution, scanClaims, CODE_ALPHABET, PageDraft, Claim, History,
} from './index';

describe('growth kit (opt-in, all flags OFF)', () => {
  it('flags default off', () => {
    expect(growthFlagsFromEnv({})).toEqual({ growthLoop: false, referral: false, sharecard: false, seoPages: false });
    expect(growthFlagsFromEnv()).toEqual({ growthLoop: false, referral: false, sharecard: false, seoPages: false });
    expect(growthFlagsFromEnv({ REFERRAL_ENABLED: '1', SEO_PAGES_ENABLED: 'true' })).toEqual({ growthLoop: false, referral: true, sharecard: false, seoPages: true });
    expect(growthFlagsFromEnv({ REFERRAL_ENABLED: '0', SHARECARD_ENABLED: 'no' }).referral).toBe(false);
  });

  it('attribution parses channels and drops PII', () => {
    const r = parseAttribution('https://x.test/p?utm_source=Reddit&utm_medium=social&utm_campaign=Spring-2027&utm_term=jane@example.com&gclid=abc');
    expect(r.utm_source).toBe('reddit');
    expect(r.channel).toBe('social');
    expect(r.hasClickId).toBe(true);
    expect('utm_term' in r).toBe(false);
    expect(JSON.stringify(r)).not.toContain('gclid');
    expect(parseAttribution('https://x.test/', 'https://www.perplexity.ai/search?q=a').channel).toBe('ai_search');
    expect(parseAttribution('https://x.test/', 'https://www.google.com/').channel).toBe('organic_search');
    expect(parseAttribution('not a url').channel).toBe('direct');
    expect(parseAttribution('https://x.test/?utm_medium=cpc').channel).toBe('paid');
    expect(parseAttribution('https://x.test/', 'https://x.test/a', ['x.test']).channel).toBe('direct');
    expect(classify(undefined, 'https://news.example.org/post')).toBe('referral');
  });

  it('tagged urls reject PII', () => {
    expect(buildTaggedUrl('https://a.test/p', 'x', 'social', 'c1')).toContain('utm_source=x');
    expect(() => buildTaggedUrl('https://a.test/p', 'me@a.com', 'social', 'c1')).toThrow();
  });

  it('referral codes are deterministic and secret-bound', () => {
    const a = makeReferralCode('u1', 'k1');
    expect(a).toBe(makeReferralCode('u1', 'k1'));
    expect(a).not.toBe(makeReferralCode('u1', 'k2'));
    expect(a).toHaveLength(8);
    expect([...a].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    expect(() => makeReferralCode('u1', '')).toThrow();
    expect(fingerprint('device-1', 'k1')).toHaveLength(32);
    expect(fingerprint('device-1', 'k1')).not.toContain('device-1');
  });

  const NOW = new Date('2026-11-20T12:00:00Z');
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
  const claim = (over: Partial<Claim> = {}): Claim => ({ inviterId: 'a', inviteeId: 'b', claimedAt: daysAgo(20), inviteeCreatedAt: daysAgo(20), qualifiedAt: daysAgo(16), ...over });
  const hist = (over: Partial<History> = {}): History => ({ claimsLast24h: 0, rewardedLifetime: 0, paired: new Set(), ...over });

  it('referral evaluation: release, hold, and abuse rules', () => {
    expect(evaluateReferral(claim(), hist(), DEFAULT_POLICY, NOW).status).toBe('release');
    expect(evaluateReferral(claim({ qualifiedAt: null }), hist(), DEFAULT_POLICY, NOW).status).toBe('pending');
    expect(evaluateReferral(claim({ qualifiedAt: daysAgo(3) }), hist(), DEFAULT_POLICY, NOW).reasons).toEqual(['hold_period']);
    expect(evaluateReferral(claim({ inviteeId: 'a' }), hist(), DEFAULT_POLICY, NOW).reasons).toEqual(['self_referral']);
    expect(evaluateReferral(claim(), hist({ paired: new Set([pairKey('a', 'b')]) }), DEFAULT_POLICY, NOW).reasons).toEqual(['duplicate_pair']);
    expect(evaluateReferral(claim({ inviteeCreatedAt: daysAgo(400) }), hist(), DEFAULT_POLICY, NOW).reasons).toEqual(['invitee_not_new']);
    const shared = evaluateReferral(claim({ inviterDeviceFp: 'x', inviteeDeviceFp: 'x' }), hist(), DEFAULT_POLICY, NOW);
    expect(shared.status).toBe('review');
    expect(shared.reasons).toContain('shared_device');
    expect(shared.inviterUnits).toBe(0);
    expect(evaluateReferral(claim({ inviterPaymentFp: 'p', inviteePaymentFp: 'p' }), hist(), DEFAULT_POLICY, NOW).reasons).toContain('shared_payment');
    expect(evaluateReferral(claim(), hist({ claimsLast24h: 99 }), DEFAULT_POLICY, NOW).status).toBe('review');
    expect(evaluateReferral(claim(), hist({ rewardedLifetime: 50 }), DEFAULT_POLICY, NOW).reasons).toEqual(['lifetime_cap']);
    const ok = evaluateReferral(claim(), hist(), DEFAULT_POLICY, NOW);
    expect([ok.inviterUnits, ok.inviteeUnits]).toEqual([1, 1]);
  });

  it('claims scan and language checks', () => {
    expect(scanClaims('This tea cures insomnia').length).toBeGreaterThan(0);
    expect(scanClaims('保证收益，稳赚').length).toBeGreaterThan(0);
    expect(scanClaims('Ranked #1 for sleep').length).toBeGreaterThan(0);
    expect(scanClaims('Seasonal habits for general wellness. Estimates only. Not investment advice. More text follows.')).toEqual([]);
    expect(isEnglishOnly('Hello 24 solar terms')).toBe(true);
    expect(hasCjk('你好')).toBe(true);
  });

  it('share cards: en/zh, errors and disclaimers', () => {
    const ok = buildShareCard({ locale: 'en', topic: 'wellness', title: 'Spring Equinox routine', description: 'A gentle evening wind-down for the season.', landingUrl: 'https://seasonsvip.com/solar-terms/chunfen' });
    expect(ok.errors).toEqual([]);
    if (ok.ok) {
      expect(ok.og['og:url']).toContain('utm_medium=social-organic');
      expect(ok.disclaimer.startsWith('For general wellness')).toBe(true);
    }
    expect(buildShareCard({ locale: 'en', topic: 'wellness', title: '春分', description: 'x', landingUrl: 'https://a.test' }).errors).toContain('english_only_violation');
    const zh = buildShareCard({ locale: 'zh', topic: 'energy', title: '储能电价政策更新', description: '本周各省分时电价变化摘要', landingUrl: 'https://a.test/p' });
    expect(zh.errors).toEqual([]);
    if (zh.ok) expect(zh.text).toContain('不构成投资建议');
    expect(buildShareCard({ locale: 'en', topic: 'wellness', title: 'Cures anxiety fast', description: 'ok', landingUrl: 'https://a.test' }).errors.some((e) => e.startsWith('claim:medical'))).toBe(true);
    expect(buildShareCard({ locale: 'en', topic: 'culture', title: 'x'.repeat(80), description: 'ok', landingUrl: 'https://a.test' }).errors).toContain('title_too_long');
  });

  const BODY = 'Seasonal sleep routines for the Spring Equinox explain how day length changes and which gentle habits people use to wind down. '.repeat(12);
  const page = (over: Partial<PageDraft> = {}): PageDraft => ({
    url: 'https://a.test/p', locale: 'en', question: 'spring equinox sleep routine', title: 'Spring Equinox sleep routine', body: BODY,
    sources: [{ url: 'https://www.hko.gov.hk', date: '2026-10-01' }], aiAssisted: true, aiNote: 'Drafted with AI and reviewed by a person.', ...over,
  });
  const TODAY = new Date('2026-11-01T00:00:00Z');

  it('seo gate publishes good pages and holds bad ones', () => {
    expect(checkPage(page(), [], TODAY).publish).toBe(true);
    const dup = checkPage(page(), [BODY], TODAY);
    expect(dup.reasons).toContain('near_duplicate');
    expect(dup.noindex).toBe(true);
    const thin = checkPage(page({ body: 'short', question: 'q', title: 'q', sources: [], aiNote: '' }), [], TODAY);
    expect(thin.reasons).toEqual(expect.arrayContaining(['thin_content', 'no_sources', 'missing_ai_note']));
    expect(checkPage(page({ sources: [{ url: 'https://a', date: '2024-01-01' }], aiAssisted: false }), [], TODAY).reasons).toContain('source_stale');
    expect(checkPage(page({ sources: [{ url: 'https://a', date: 'yesterday' }] }), [], TODAY).reasons).toContain('source_date_invalid');
    expect(checkPage(page({ body: BODY + ' This tea cures insomnia.' }), [], TODAY).reasons).toContain('claim:medical');
    const zh = page({ locale: 'zh', question: '春分 作息 怎么调整', title: '春分作息怎么调整', body: '春分前后昼夜等长，作息可以循序渐进地调整。'.repeat(30), sources: [{ url: 'https://a', date: '2026-10-20' }], aiNote: '本文由 AI 辅助起草并经人工审阅。' });
    expect(checkPage(zh, [], TODAY).publish).toBe(true);
    expect(JSON.parse(articleJsonLd(page(), '2026-11-01', 'Org'))['@type']).toBe('Article');
  });
});
