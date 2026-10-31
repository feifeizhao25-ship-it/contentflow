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
 */
export const INTERNATIONAL_RULESET_VERSION = 'intl-content-2026.10.31';

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
  /** Things this screen cannot judge. Shown to the user so "clear" is not read as "approved". */
  notChecked: string[];
}

interface IntlRule {
  ruleId: string;
  severity: IntlSeverity;
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
];

const DISCLOSURE_SIGNALS = /\b(?:affiliate link|use my (?:code|link)|promo code|discount code|my code|link in (?:bio|description)|i earn a commission|commission)\b/i;
const DISCLOSURE_LABELS = /(?:#ad\b|#sponsored|#paidpartnership|\bad:|\bsponsored\b|paid partnership|\bpaid promotion\b|\bgifted\b|#gifted|\b#?affiliate disclosure\b)/i;

function disclosureHit(text: string): IntlComplianceHit | null {
  const m = text.match(DISCLOSURE_SIGNALS);
  if (!m || DISCLOSURE_LABELS.test(text)) return null;
  return {
    ruleId: 'INTL-DISCLOSURE',
    severity: 'review',
    reason: 'Promotes with a code or affiliate link but does not clearly say it is an ad or that you are paid. Material connections must be disclosed clearly.',
    source: 'FTC Endorsement Guides, 16 CFR Part 255 (disclosure of material connections); UK CAP Code section 2 (recognisability)',
    sourceUrl: FTC_ENDORSE,
    sourceRetrievedAt: RETRIEVED,
    matchedTerms: [m[0]],
    humanOverrideAllowed: true,
  };
}

export const INTERNATIONAL_NOT_CHECKED: readonly string[] = [
  'Platform-specific rules (TikTok, YouTube, Instagram, X community guidelines)',
  'Country-specific regimes beyond the US FTC/FDA and UK CAP Code (for example EU member-state law, AI Act transparency duties)',
  'Copyright, trademark and likeness rights',
  'Whether your own evidence actually supports each claim',
];

export function evaluateInternationalContent(
  content: string,
  options?: { conservative?: boolean },
): IntlComplianceResult {
  const text = String(content || '').normalize('NFKC');
  const hits: IntlComplianceHit[] = [];
  for (const rule of RULES) {
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
  const disclosure = disclosureHit(text);
  if (disclosure) hits.push(disclosure);
  const blocked = hits.some((h) => h.severity === 'block');
  const review = hits.some((h) => h.severity === 'review');
  return {
    passed: !blocked,
    level: blocked ? 'violation' : review ? 'risk' : 'clear',
    disclaimer: INTERNATIONAL_DISCLAIMER,
    mode: options?.conservative ? 'conservative' : 'normal',
    ruleSetVersion: INTERNATIONAL_RULESET_VERSION,
    hits,
    rulesChecked: RULES.length + 1,
    notChecked: [...INTERNATIONAL_NOT_CHECKED],
  };
}
