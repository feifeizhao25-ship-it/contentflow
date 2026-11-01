/**
 * International (MARKET_REGION=global) pre-publish content checks.
 *
 * Why this file exists: the international edition used to run no checks at all
 * (the check endpoint only knew the China rule set), so risky English copy such as
 * "stop taking your blood pressure medication" or "guaranteed 10x returns" came back
 * as `clear`. This is a keyword/pattern screen, NOT legal advice and NOT a guarantee
 * that content is publishable. Every hit carries its source; "block" rules mirror
 * statements that regulators have published, "review" rules only ask a human to check.
 *
 * Sources (opened and confirmed to exist on 2026-10-31):
 *  - FTC Act section 5, 15 U.S.C. 45 (unfair or deceptive acts or practices)
 *  - FTC Health Products Compliance Guidance (Dec 2022): health claims need competent and
 *    reliable scientific evidence
 *  - FTC Policy Statement Regarding Advertising Substantiation (1984)
 *  - FTC Endorsement Guides, 16 CFR Part 255 (disclose material connections)
 *  - FDA 21 CFR 101.93(g): supplements may not claim to diagnose, treat, cure or prevent disease
 *  - UK CAP Code section 3 (misleading advertising) and section 12 (medicines, medical devices,
 *    health-related products)
 *
 * Added 2026-11-01 (each text below was opened and read that day):
 *  - 16 CFR 255.0(f), 255.1(d)/(f), 255.5: "clear and conspicuous" (on social media the disclosure should be
 *    unavoidable), advertiser and intermediary liability, disclosure of material connections
 *  - 16 CFR Part 465 (Rule on Consumer Reviews and Testimonials): 465.2 fake reviews and testimonials,
 *    465.8 fake indicators of social media influence
 *  - UK CAP Code rules 2.1 and 2.3 (marketing communications must be obviously identifiable; commercial intent)
 *    and the ASA advice "Recognising ads: social media and influencer marketing" (labels, placement)
 *  - Regulation (EU) 2024/1689 (AI Act) Article 50(2) and 50(4), and the Commission's Article 50 FAQ
 *    (applies from 2 August 2026; marking grace period to 2 December 2026 for systems already on the market)
 */
export const INTERNATIONAL_RULESET_VERSION = 'intl-content-2026.11.01';

import type { TargetMarket } from './target-market';

export const INTERNATIONAL_DISCLAIMER =
  'This is not legal advice. A clear result does not mean the content is cleared to publish; please review it yourself before posting.';

export type IntlSeverity = 'block' | 'review';
export type IntlLevel = 'violation' | 'risk' | 'clear';

export interface IntlComplianceHit {
  ruleId: string;
  severity: IntlSeverity;
  reason: string;
  source: string;
  sourceUrl: string;
  sourceRetrievedAt: string;
  matchedTerms: string[];
  humanOverrideAllowed: boolean;
}

export interface IntlComplianceResult {
  passed: boolean;
  level: IntlLevel;
  disclaimer: string;
  mode: 'normal' | 'conservative';
  ruleSetVersion: string;
  hits: IntlComplianceHit[];
  /** How many rules ran. A clear result is only as strong as this list. */
  rulesChecked: number;
  /** Hits by severity: block stops generation, review asks a person to look. */
  hitCounts: { block: number; review: number; total: number };
  /** Things this screen cannot judge. Shown to the user so "clear" is not read as "approved". */
  notChecked: string[];
}

type Applies = 'output' | 'request';

interface IntlRule {
  ruleId: string;
  severity: IntlSeverity;
  /** Where the rule runs. Default: generated output only. 'request' rules read what the user asked for. */
  appliesTo?: readonly Applies[];
  reason: string;
  source: string;
  sourceUrl: string;
  patterns: RegExp[];
  humanOverrideAllowed: boolean;
}

const RETRIEVED = '2026-10-31';
const FTC_HEALTH = 'https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance';
const FTC_SUBSTANTIATION = 'https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation';
const FTC_ENDORSE = 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255';
const FDA_101_93 = 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-B/part-101/subpart-F/section-101.93';
const FTC_ACT = 'https://www.law.cornell.edu/uscode/text/15/45';
const CAP_3 = 'https://www.asa.org.uk/type/non_broadcast/code_section/03.html';
const CAP_2 = 'https://www.asa.org.uk/type/non_broadcast/code_section/02.html';
const ASA_SOCIAL = 'https://www.asa.org.uk/advice-online/recognising-ads-social-media.html';
const FTC_REVIEWS = 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-465';
const FTC_255_0 = 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255/section-255.0';
const AI_ACT_50 = 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj';
const AI_ACT_FAQ = 'https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act';
const RETRIEVED_2 = '2026-11-01';

const DISEASE =
  '(?:anxiety|depression|diabet\\w*|cancer\\w*|tumou?rs?|covid\\S*|hypertension|high blood pressure|arthritis|alzheimer\\w*|adhd|insomnia|infections?|asthma|heart disease|ibs|eczema|psoriasis)';

const RULES: IntlRule[] = [
  {
    ruleId: 'INTL-MEDICATION-STOP',
    severity: 'block',
    reason: 'Tells people to stop or replace prescribed medication. Health claims need competent scientific evidence, and advice like this can cause real harm.',
    source: 'FTC Health Products Compliance Guidance (Dec 2022); UK CAP Code section 12 (health-related products)',
    sourceUrl: FTC_HEALTH,
    patterns: [
      /\bstop(?:ped)?\s+(?:taking|using)\s+(?:your|the|all|any)?\s*[\w\s-]{0,30}?(?:medication|medicine|meds|pills|insulin|prescription)/i,
      /\b(?:replaces?|replacing|instead of|ditch|skip|no (?:more|need for))\s+(?:your\s+|the\s+)?[\w\s-]{0,20}?(?:medication|medicine|meds|insulin|prescription|doctor)/i,
    ],
    humanOverrideAllowed: false,
  },
  {
    ruleId: 'INTL-DISEASE-CLAIM',
    severity: 'block',
    reason: 'Claims to cure, treat or prevent a disease. Supplements and general products may not make disease claims, and any health claim needs scientific substantiation.',
    source: 'FDA 21 CFR 101.93(g); FTC Health Products Compliance Guidance (Dec 2022)',
    sourceUrl: FDA_101_93,
    patterns: [
      new RegExp(`\\b(?:cures?|cured|curing|heals?|healed|reverses?|eliminates?|treats?|prevents?|fights?|kills?)\\s+(?:your\\s+|the\\s+)?${DISEASE}`, 'i'),
      /\b(?:cures?|cured)\s+(?:\w+\s+){0,3}in\s+\d+\s+(?:days?|weeks?|hours?)/i,
      /\bmiracle (?:cure|treatment|pill)\b/i,
    ],
    humanOverrideAllowed: false,
  },
  {
    ruleId: 'INTL-GUARANTEED-RETURNS',
    severity: 'block',
    reason: 'Guarantees investment results or says there is no risk. Guaranteed-return and risk-free claims are treated as deceptive.',
    source: 'FTC Act section 5 (15 U.S.C. 45); FTC Policy Statement Regarding Advertising Substantiation; UK CAP Code section 3',
    sourceUrl: FTC_ACT,
    patterns: [
      /\bguarantee[sd]?\b[^.\n]{0,40}\b(?:returns?|profits?|gains?|income|\d+\s?x|\d+\s?%|roi)\b/i,
      /\b(?:\d+\s?x)\s+(?:returns?|your money|profits?)\b/i,
      /\b(?:risk[- ]free|no[- ]risk|zero[- ]risk|can'?t lose|cannot lose|never lose|sure thing|get rich quick)\b/i,
      /\bno risk at all\b/i,
      /\b(?:double|triple|10x)\s+your\s+(?:money|investment)\b/i,
    ],
    humanOverrideAllowed: false,
  },
  {
    ruleId: 'INTL-GUARANTEED-RESULT',
    severity: 'review',
    reason: 'Promises a result with certainty ("guaranteed", "100%", "forever"). Objective claims need a reasonable basis before they are published.',
    source: 'FTC Policy Statement Regarding Advertising Substantiation (1984); UK CAP Code section 3',
    sourceUrl: FTC_SUBSTANTIATION,
    patterns: [
      /\b(?:guaranteed|guarantees?)\b/i,
      /\b100\s?%\s+(?:\w+\s+){0,2}(?:proof|safe|effective|guaranteed|natural|results?|compliant|secure)\b/i,
      /\b(?:works|lasts?|safe)\s+(?:every time|forever|for life)\b/i,
    ],
    humanOverrideAllowed: true,
  },
  {
    ruleId: 'INTL-SUPERLATIVE',
    severity: 'review',
    reason: 'Uses an unqualified "best" or "#1" claim. Comparative and ranking claims need evidence you can show.',
    source: 'FTC Policy Statement Regarding Advertising Substantiation (1984); UK CAP Code section 3',
    sourceUrl: FTC_SUBSTANTIATION,
    patterns: [
      /(?:#|no\.?\s?|number\s)1\b(?:\s+(?:rated|ranked|best|selling|choice))?/i,
      /\b(?:best|greatest|most (?:trusted|popular|effective))\s+(?:\w+\s+){0,3}in the world\b/i,
      /\bworld'?s? (?:best|first|leading|#1)\b/i,
    ],
    humanOverrideAllowed: true,
  },
  {
    ruleId: 'INTL-AUTHORITY-CLAIM',
    severity: 'review',
    reason: 'Claims regulator approval or certification. The FDA does not approve dietary supplements, and there is no general "GDPR certified" badge; check what is actually held.',
    source: 'FTC Act section 5 (15 U.S.C. 45); FDA 21 CFR 101.93',
    sourceUrl: FDA_101_93,
    patterns: [
      /\bfda[- ](?:approved|cleared|certified|endorsed)\b/i,
      /\b(?:clinically proven|doctor[- ]recommended|doctors? (?:love|hate|recommend))\b/i,
      /\bgdpr[- ](?:proof|certified|approved)\b/i,
    ],
    humanOverrideAllowed: true,
  },
  {
    ruleId: 'INTL-FAKE-REVIEW',
    severity: 'block',
    appliesTo: ['request'],
    reason: 'Asks for fake or invented reviews, ratings or testimonials, or for text posing as a real customer, patient or expert. Writing or selling a review or testimonial that misrepresents that the reviewer exists or used the product is an unfair or deceptive practice.',
    source: '16 CFR 465.2 (fake or false consumer reviews, consumer testimonials, or celebrity testimonials); 16 CFR 255.1(a), (f)',
    sourceUrl: FTC_REVIEWS,
    patterns: [
      /\b(?:write|create|generate|make|produce|draft|compose|post|fabricate|invent|buy|order|purchase)\b[^.\n]{0,60}?\b(?:fake|fabricated|made[- ]up|invented|bogus|phony)\s+(?:\w+\s+){0,2}(?:reviews?|testimonials?|endorsements?|ratings?)\b/i,
      /\b(?:write|create|generate|make|produce|draft|compose)\b[^.\n]{0,40}?\b(?:\d+|several|some|a few|ten|twenty|five|dozens?)\s+(?:5|five)[- ]star\s+(?:\w+\s+){0,2}(?:reviews?|ratings?)\b/i,
      /\b(?:pretend(?:ing)?|act(?:ing)?|pos(?:e|ing)|impersonat\w*|role[- ]?play(?:ing)?)\b[^.\n]{0,40}?\b(?:as|to be)\s+(?:a|an|the)?\s*(?:real|satisfied|happy|verified|actual)?\s*(?:customer|client|patient|user|buyer|doctor|nurse|dentist|physician)\b[^.\n]{0,80}?\b(?:review|testimonial|endorse\w*|recommend\w*|promot\w*)/i,
      /\b(?:reviews?|testimonials?)\b[^.\n]{0,60}?\b(?:from|by)\s+(?:a\s+)?(?:fake|non-?existent|made[- ]up|fictional)\s+(?:customers?|users?|people|persons?|accounts?)\b/i,
    ],
    humanOverrideAllowed: false,
  },
  {
    ruleId: 'INTL-FAKE-INDICATORS',
    severity: 'block',
    appliesTo: ['request'],
    reason: 'Asks for bought or fake followers, likes, views or comments. Selling, distributing, buying or procuring fake indicators of social media influence to misrepresent influence for a commercial purpose is an unfair or deceptive practice.',
    source: '16 CFR 465.8 (misuse of fake indicators of social media influence)',
    sourceUrl: FTC_REVIEWS,
    patterns: [
      /\b(?:buy|purchase|order|get|boost|grow|increase|add|generate|sell)\b[^.\n]{0,40}?\b(?:fake|bot|bought|paid)\s+(?:(?:instagram|tiktok|youtube|facebook|linkedin|x|twitter)\s+)?(?:followers?|likes?|views?|subscribers?|comments?|engagement|plays?)\b/i,
      /\b(?:buy|purchase|order)\s+(?:\d[\d,.]*\s?k?\s+)?(?:(?:instagram|tiktok|youtube|facebook|linkedin|x|twitter)\s+)?(?:followers|likes|views|subscribers)\b/i,
      /\b(?:follower|like|view|subscriber|engagement)\s+(?:farms?|bots?|bot networks?)\b/i,
    ],
    humanOverrideAllowed: false,
  },
  {
    ruleId: 'INTL-AI-LABEL-REMOVAL',
    severity: 'block',
    appliesTo: ['request'],
    reason: 'Asks to remove, hide or evade the AI-generated label, watermark or metadata, or to pass AI output off as human work. Providers must mark AI outputs in a machine-readable way, and deployers must disclose deepfakes and AI text on matters of public interest.',
    source: 'Regulation (EU) 2024/1689 (AI Act) Article 50(2) and 50(4); Commission Article 50 FAQ',
    sourceUrl: AI_ACT_50,
    patterns: [
      /\b(?:remove|strip|delete|hide|drop|erase|get rid of|take off|bypass|evade|circumvent|defeat)\b[^.\n]{0,40}?\b(?:ai|a\.i\.|machine)[- ]?(?:generated\s+)?(?:label|disclosure|watermark|metadata|tag|marker|notice|detection)/i,
      /\bso\s+(?:nobody|no one|people|readers|viewers|they|the platform|platforms)\s+(?:can(?:'|no)?t|can|could|cannot|can not|won'?t|will not|don'?t|do not)\s+(?:\w+\s+)?(?:tell|know|detect|notice|spot|see)\b[^.\n]{0,40}?\b(?:ai|generated|machine|bot)\b/i,
      /\b(?:don'?t|do not|without|never)\s+(?:label|mark|disclose|flag)\w*\s+(?:it|this|the (?:post|content|text|image|video))?\s*as\s+(?:ai|generated|machine)/i,
      /\bpass\w*\s+(?:it|this|the (?:text|content|post|image|video))?\s*off\s+as\s+(?:human|handwritten|hand-written|written by (?:a )?human|real footage|a real photo)\b/i,
    ],
    humanOverrideAllowed: false,
  },
  {
    ruleId: 'INTL-DEEPFAKE-ENDORSEMENT',
    severity: 'block',
    appliesTo: ['request'],
    reason: 'Asks for a synthetic face or voice of a real or well-known person endorsing or selling something. A testimonial that implies a real person used or backs a product when they did not misrepresents that person, and deepfakes must be disclosed.',
    source: '16 CFR 465.2(a) and 465.1(b), (f) (celebrity and consumer testimonials include depictions of likeness); Regulation (EU) 2024/1689 Article 50(4)',
    sourceUrl: FTC_REVIEWS,
    patterns: [
      /\b(?:deep[- ]?fake|face[- ]?swap\w*|voice[- ]?clon\w*|clon\w*\s+(?:the\s+|his\s+|her\s+|their\s+)?(?:voice|face)|synthetic\s+(?:voice|face))\b(?=[^.\n]{0,120}?\b(?:celebrit\w*|famous|well-known|actor|actress|singer|athlete|influencer|doctor|presenter|politician|real person|real people|someone)\b)(?=[^.\n]{0,120}?\b(?:endors\w*|recommend\w*|promot\w*|testimonial|advert\w*|sell\w*|review)\b)/i,
    ],
    humanOverrideAllowed: false,
  },
];

const DISCLOSURE_SIGNALS = /\b(?:affiliate links?|use my (?:code|link)|promo code|discount code|my code|link in (?:bio|description)|i earn a commission|commission|was gifted|got gifted|gifted (?:to me|by)|#gifted|free (?:product|sample|item)s?|pr package|in partnership with|brand ambassador|paid partnership|sponsored by|partnered with)\b/i;
/** Legacy labels (no target market chosen): kept as before so existing behaviour does not change. */
const DISCLOSURE_LABELS = /(?:#ad\b|#sponsored|#paidpartnership|\bad:|\bsponsored\b|paid partnership|\bpaid promotion\b|\bgifted\b|#gifted|\b#?affiliate disclosure\b)/i;

interface MarketLabelRule {
  /** Labels the regulator or self-regulatory body names (or the closest equivalent). */
  accept: RegExp;
  /** Labels the same body says are not enough on their own. */
  weak: RegExp;
  /** UK only: the label should be at the very start, so look for it in this many leading characters. */
  upfrontChars?: number;
  acceptedText: string;
  source: string;
  sourceUrl: string;
}

const LEAD = '(?:^|[\\s\\[(*>])';
const TAIL = '(?=$|[\\s\\]):.,!?*\\-\\u2013\\u2014#])';
const MARKET_LABELS: Partial<Record<TargetMarket, MarketLabelRule>> = {
  UK: {
    accept: new RegExp(`${LEAD}(?:#)?(?:ad|advert|advertising|advertisement|ad feature|advertisement feature)${TAIL}`, 'i'),
    weak: /(?:#?sponsored\b|#?gifted\b|#?aff(?:iliate)?\b|#sp\b|#spon\b|#collab\b|#?\w*ambassador\b|\bsupported by\b|\bfunded by\b|\bin association with\b|\bthanks to\b|#partner\b)/i,
    upfrontChars: 100,
    acceptedText: '"Ad", "Advert", "Advertising", "Advertisement" or "Ad Feature"',
    source: 'UK CAP Code rules 2.1 and 2.3; ASA, Recognising ads: social media and influencer marketing',
    sourceUrl: ASA_SOCIAL,
  },
  US: {
    accept: new RegExp(`(?:#ad\\b|${LEAD}ad${TAIL}|\\bads?:|\\badvertisement\\b|#sponsored\\b|\\bsponsored\\b|paid partnership|#paidpartnership|\\bpaid promotion\\b|thanks to [^.\\n]{1,40} for (?:the )?(?:free|gifted))`, 'i'),
    weak: /(?:#sp\b|#spon\b|#collab\b|#thanks\w*\b|#ambassador\b)/i,
    acceptedText: '"ad", "advertisement", "sponsored", "paid partnership" or "Thanks to <brand> for the free product"',
    source: '16 CFR 255.0(f) and 255.5 (clear and conspicuous; unavoidable on social media); FTC Disclosures 101 for Social Media Influencers (weak-label list kept from the 2026-10-31 reading; the page could not be re-opened on 2026-11-01)',
    sourceUrl: FTC_255_0,
  },
  IN: {
    accept: /(?:#(?:ad|advertisement|sponsored|collaboration|partnership|employee|freegift|free gift|affiliate)\b|\badvertisement\b)/i,
    weak: /(?:\bsponsored\b|\bgifted\b|#?\w*ambassador\b|#sp\b|#spon\b|#collab\b|\baffiliate\b|\bpartnership\b)/i,
    acceptedText: '#Ad, #Advertisement, #Sponsored, #Collaboration, #Partnership, #Employee, #Free gift or #Affiliate',
    source: 'ASCI Influencer Guidelines (permitted label list)',
    sourceUrl: 'https://www.ascionline.in/social/wp-content/uploads/2025/04/ASCI-Influencer-Guidelines.pdf',
  },
  SG: {
    accept: /(?:#(?:adv|sp|sponsored|endorsed)\b|this post (?:was|is) sponsored by|this post includes affiliate links)/i,
    weak: /(?:\bgifted\b|#?\w*ambassador\b|#collab\b)/i,
    acceptedText: '#adv, #sp, #sponsored, #endorsed, "This post was sponsored by <brand>" or "This post includes affiliate links"',
    source: 'ASAS Annex B: Guidance notes for interactive marketing communication & social media',
    sourceUrl: 'https://asas.org.sg/Portals/0/Annex%20B%20-%20Guidance%20notes%20for%20Interactive%20Marketing%20Communication%20and%20Social%20Media.pdf',
  },
};

function hashtagTailOnly(text: string, labelIndex: number): boolean {
  // The label sits only inside a trailing run of three or more hashtags, with real text before it.
  const m = text.match(/(?:\s*#[\w-]+){3,}\s*$/);
  return !!m && m.index !== undefined && m.index > 0 && labelIndex >= m.index;
}

function disclosureHits(text: string, opts: { targetMarket?: TargetMarket | null; commercial?: boolean }): IntlComplianceHit[] {
  const signal = text.match(DISCLOSURE_SIGNALS);
  if (!signal && !opts.commercial) return [];
  const matched = signal ? [signal[0]] : ['declared commercial relationship'];
  const mk = (ruleId: string, reason: string, source: string, sourceUrl: string, terms: string[] = matched): IntlComplianceHit => ({
    ruleId, severity: 'review', reason, source, sourceUrl, sourceRetrievedAt: RETRIEVED_2, matchedTerms: terms, humanOverrideAllowed: true,
  });
  const market = opts.targetMarket && MARKET_LABELS[opts.targetMarket] ? opts.targetMarket : null;
  if (!market) {
    if (DISCLOSURE_LABELS.test(text)) return [];
    return [{
      ruleId: 'INTL-DISCLOSURE',
      severity: 'review',
      reason: 'Promotes with a code or affiliate link but does not clearly say it is an ad or that you are paid. Material connections must be disclosed clearly.',
      source: 'FTC Endorsement Guides, 16 CFR Part 255 (disclosure of material connections); UK CAP Code section 2 (recognisability)',
      sourceUrl: FTC_ENDORSE,
      sourceRetrievedAt: RETRIEVED,
      matchedTerms: matched,
      humanOverrideAllowed: true,
    }];
  }
  const rule = MARKET_LABELS[market]!;
  const found = rule.accept.exec(text);
  if (found) {
    const hits: IntlComplianceHit[] = [];
    if (rule.upfrontChars !== undefined && found.index > rule.upfrontChars) {
      hits.push(mk('INTL-DISCLOSURE-PLACEMENT', `The label is not at the start of the post. The ASA expects a prominent "ad" label upfront, before the reader engages, not further down.`, rule.source, rule.sourceUrl, [found[0].trim().slice(0, 40)]));
    } else if ((market === 'UK' || market === 'US') && hashtagTailOnly(text, found.index)) {
      hits.push(mk('INTL-DISCLOSURE-PLACEMENT', 'The label is only inside a block of hashtags at the end. A disclosure buried in hashtags is not clear and conspicuous (on social media it should be unavoidable).', rule.source, rule.sourceUrl, [found[0].trim().slice(0, 40)]));
    }
    return hits;
  }
  const weak = rule.weak.exec(text);
  if (weak) {
    return [mk('INTL-DISCLOSURE-LABEL', `The disclosure wording "${weak[0].trim().slice(0, 30)}" is not enough on its own for this market. Use ${rule.acceptedText}.`, rule.source, rule.sourceUrl, [weak[0].trim().slice(0, 40)])];
  }
  return [mk('INTL-DISCLOSURE', `Promotes with a code, affiliate link, free product or partnership but has no disclosure label for this market. Use ${rule.acceptedText}, at the start of the post.`, rule.source, rule.sourceUrl)];
}

export const INTERNATIONAL_NOT_CHECKED: readonly string[] = [
  'Platform-specific rules (TikTok, YouTube, Instagram, X community guidelines)',
  'Country-specific regimes beyond the US FTC/FDA, the UK CAP Code, India (ASCI) and Singapore (ASAS) labelling hints (for example EU member-state advertising law, and the deployer duties under AI Act Article 50(4) that depend on whether your text is on a matter of public interest and has human review)',
  'Whether a review, testimonial or endorsement you publish came from a real person with real experience (only requests that ask for fakes are blocked)',
  'Copyright, trademark and likeness rights',
  'Whether your own evidence actually supports each claim',
];

const appliesTo = (rule: IntlRule, where: Applies) => (rule.appliesTo ?? ['output']).includes(where);

export interface IntlRequestResult {
  blocked: boolean;
  ruleSetVersion: string;
  hits: IntlComplianceHit[];
}

/**
 * Screens what the user ASKED for (topic, style, keywords, material, image prompt) before anything is generated or any quota
 * is reserved. Only block-level request rules run: fake reviews and testimonials, fake followers or likes, removing the AI label,
 * and synthetic endorsements by real people. It never inspects generated text.
 */
export function evaluateInternationalRequest(input: string | readonly string[]): IntlRequestResult {
  const text = (Array.isArray(input) ? input.join('\n') : String(input || '')).normalize('NFKC');
  const hits: IntlComplianceHit[] = [];
  for (const rule of RULES) {
    if (!appliesTo(rule, 'request') || rule.severity !== 'block') continue;
    const matched: string[] = [];
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m) matched.push(m[0].trim().slice(0, 60));
    }
    if (matched.length) {
      hits.push({
        ruleId: rule.ruleId, severity: rule.severity, reason: rule.reason, source: rule.source, sourceUrl: rule.sourceUrl,
        sourceRetrievedAt: RETRIEVED_2, matchedTerms: [...new Set(matched)], humanOverrideAllowed: false,
      });
    }
  }
  return { blocked: hits.length > 0, ruleSetVersion: INTERNATIONAL_RULESET_VERSION, hits };
}

export function evaluateInternationalContent(
  content: string,
  options?: { conservative?: boolean; targetMarket?: TargetMarket | null; commercial?: boolean },
): IntlComplianceResult {
  const text = String(content || '').normalize('NFKC');
  const hits: IntlComplianceHit[] = [];
  for (const rule of RULES) {
    if (!appliesTo(rule, 'output')) continue;
    const matched: string[] = [];
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m) matched.push(m[0].trim().slice(0, 60));
    }
    if (matched.length) {
      hits.push({
        ruleId: rule.ruleId,
        severity: rule.severity,
        reason: rule.reason,
        source: rule.source,
        sourceUrl: rule.sourceUrl,
        sourceRetrievedAt: RETRIEVED,
        matchedTerms: [...new Set(matched)],
        humanOverrideAllowed: rule.humanOverrideAllowed,
      });
    }
  }
  hits.push(...disclosureHits(text, { targetMarket: options?.targetMarket, commercial: options?.commercial }));
  const blocked = hits.some((h) => h.severity === 'block');
  const review = hits.some((h) => h.severity === 'review');
  return {
    passed: !blocked,
    level: blocked ? 'violation' : review ? 'risk' : 'clear',
    disclaimer: INTERNATIONAL_DISCLAIMER,
    mode: options?.conservative ? 'conservative' : 'normal',
    ruleSetVersion: INTERNATIONAL_RULESET_VERSION,
    hits,
    hitCounts: {
      block: hits.filter((h) => h.severity === 'block').length,
      review: hits.filter((h) => h.severity === 'review').length,
      total: hits.length,
    },
    rulesChecked: RULES.filter((r) => appliesTo(r, 'output')).length + 3,
    notChecked: [...INTERNATIONAL_NOT_CHECKED],
  };
}
