/**
 * Target-market option for the international edition. The same English copy needs different
 * ad-disclosure wording depending on where the audience is. Every hint below is paraphrased from the
 * regulator / self-regulatory body named in `sources`, opened on 2026-10-31. These are labelling
 * hints, not legal advice, and they only cover the markets listed. "SG" is Singapore only: other
 * Southeast Asian countries are NOT covered and are not offered as an option.
 */
export const TARGET_MARKETS = ['US', 'UK', 'IN', 'SG'] as const;
/**
 * Any other country: no country-specific rules are built in (none are invented). The hint only carries
 * the general principles in ICPEN's guidelines for digital influencers, and says to check the local regulator.
 */
export const GENERIC_MARKET = 'OTHER' as const;
/** Everything the API accepts for `targetMarket`. */
export const ACCEPTED_TARGET_MARKETS = [...TARGET_MARKETS, GENERIC_MARKET] as const;
export type TargetMarket = (typeof ACCEPTED_TARGET_MARKETS)[number];

export interface DisclosureHint {
  market: TargetMarket;
  marketName: string;
  /** Wording the regulator names as acceptable. */
  labelExamples: string[];
  /** Wording to avoid, where the source says so. */
  avoid: string[];
  placement: string;
  sources: Array<{ name: string; url: string; retrievedAt: string }>;
  note: string;
}

const RETRIEVED = '2026-10-31';

const HINTS: Record<TargetMarket, DisclosureHint> = {
  US: {
    market: 'US',
    marketName: 'United States',
    labelExamples: ['ad', 'advertisement', 'sponsored', 'Thanks to <brand> for the free product'],
    avoid: ['sp', 'spon', 'collab', 'a stand-alone "thanks" or "ambassador"'],
    placement:
      'Put the disclosure with the endorsement itself, not only in a profile or behind "more". In video, show it in the video (audio and visual is better); repeat it periodically in live streams.',
    sources: [
      { name: 'FTC, Disclosures 101 for Social Media Influencers (PDF)', url: 'https://www.ftc.gov/system/files/ftc_gov/pdf/1001A_Influencer%20Guide_508.pdf', retrievedAt: '2026-11-06' },
      { name: 'FTC Endorsement Guides, 16 CFR 255.5', url: 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255/section-255.5', retrievedAt: RETRIEVED },
    ],
    note: 'Disclose any material connection: payment, free or discounted products, family or employment ties.',
  },
  UK: {
    market: 'UK',
    marketName: 'United Kingdom',
    labelExamples: ['Ad', 'Advert', 'Advertising', 'Advertisement'],
    avoid: ['"sponsored" on its own (open to varied interpretation)', 'a brand @mention or discount code alone', 'a label buried in a list of hashtags or under "See more"'],
    placement: 'Prominent and upfront, visible before the viewer engages, on mobile, desktop and in-app; label each item of a carousel that carries promotion.',
    sources: [
      { name: 'ASA, Influencers\' guide to making clear that ads are ads', url: 'https://www.asa.org.uk/resource/influencers-guide.html', retrievedAt: '2026-11-06' },
      { name: 'ASA, Recognising ads: social media and influencer marketing', url: 'https://www.asa.org.uk/advice-online/recognising-ads-social-media.html', retrievedAt: RETRIEVED },
      { name: 'GOV.UK (CMA), Social media endorsements: guidance for content creators', url: 'https://www.gov.uk/government/publications/social-media-endorsements-guidance-for-content-creators/social-media-endorsements-being-transparent-with-your-followers', retrievedAt: RETRIEVED },
    ],
    note: 'Applies to paid, gifted, affiliate and own-brand promotion alike.',
  },
  IN: {
    market: 'IN',
    marketName: 'India',
    labelExamples: ['#Ad', '#Advertisement', '#Sponsored', '#Collaboration', '#Partnership', '#Employee', '#Free gift', '#Affiliate'],
    avoid: ['labels outside ASCI\'s permitted list', 'disclosure only in the bio or in a group of hashtags'],
    placement:
      'Upfront and prominent, in English or the language of the ad. On captionless images and videos, superimpose the label; follow ASCI minimum on-screen durations for video.',
    sources: [
      { name: 'ASCI, Influencer Guidelines', url: 'https://www.ascionline.in/social/wp-content/uploads/2025/04/ASCI-Influencer-Guidelines.pdf', retrievedAt: RETRIEVED },
      { name: 'ASCI, Influencer advertising FAQs', url: 'https://www.ascionline.in/social/faqs/', retrievedAt: RETRIEVED },
    ],
    note: 'The permitted label list is ASCI\'s and is reviewed periodically; check the current guidelines before publishing.',
  },
  SG: {
    market: 'SG',
    marketName: 'Singapore',
    labelExamples: ['#adv', '#sp', '#sponsored', '#endorsed', 'This post was sponsored by <brand>', 'This post includes affiliate links'],
    avoid: [],
    placement: 'As early as reasonably possible: in the picture or caption for images, visibly within the video, audibly in audio.',
    sources: [
      { name: 'ASAS, Annex B: Guidance notes for interactive marketing communication & social media', url: 'https://asas.org.sg/Portals/0/Annex%20B%20-%20Guidance%20notes%20for%20Interactive%20Marketing%20Communication%20and%20Social%20Media.pdf', retrievedAt: RETRIEVED },
    ],
    note: 'Covers Singapore only. Other Southeast Asian markets are not covered by this option.',
  },
  OTHER: {
    market: 'OTHER',
    marketName: 'Other country (general guidance)',
    labelExamples: [],
    avoid: [],
    placement:
      'Say clearly and prominently whether the content has been paid for, and be open about other commercial relationships that might matter to the audience (free products, affiliate links, employment or family ties).',
    sources: [
      { name: 'ICPEN, Guidelines for Digital Influencers (Online Reviews and Endorsements, June 2016)', url: 'https://www.icpen.org/industry-guidance', retrievedAt: '2026-11-01' },
      { name: 'ACCC, International consumer protection enforcers issue guidance for online reviews and endorsements stakeholders', url: 'https://www.accc.gov.au/media-release/international-consumer-protection-enforcers-issue-guidance-for-online-reviews-and-endorsements-stakeholders', retrievedAt: '2026-11-01' },
    ],
    note: 'No country-specific wording or labels are built in for this option. ICPEN states these are general principles, not a substitute for legal advice or national law: check your own advertising regulator\'s rules before publishing.',
  },
};

export function resolveTargetMarket(input: unknown): TargetMarket | null {
  const v = String(input ?? '').trim().toUpperCase();
  return (ACCEPTED_TARGET_MARKETS as readonly string[]).includes(v) ? (v as TargetMarket) : null;
}

export function disclosureHint(market: TargetMarket): DisclosureHint {
  return HINTS[market];
}

export const COMMERCIAL_RELATIONSHIPS = ['none', 'paid', 'gifted', 'affiliate', 'own_brand'] as const;
export type CommercialRelationship = (typeof COMMERCIAL_RELATIONSHIPS)[number];

export function resolveCommercialRelationship(input: unknown): CommercialRelationship | null {
  const v = String(input ?? '').trim().toLowerCase();
  return (COMMERCIAL_RELATIONSHIPS as readonly string[]).includes(v) ? (v as CommercialRelationship) : null;
}

/** True when the creator says money, goods or an affiliate link are involved. */
export function isCommercialRelationship(r: CommercialRelationship | null | undefined): boolean {
  return !!r && r !== 'none';
}

const DISCLOSURE_LABELS: Record<TargetMarket, Record<Exclude<CommercialRelationship, 'none'>, string>> = {
  US: { paid: 'Ad', gifted: 'Ad: product received free from the brand', affiliate: 'Ad: affiliate links, I earn a commission', own_brand: 'Ad' },
  UK: { paid: 'Ad', gifted: 'Ad: product gifted by the brand', affiliate: 'Ad: affiliate links', own_brand: 'Ad' },
  IN: { paid: '#Ad', gifted: '#Free gift', affiliate: '#Affiliate', own_brand: '#Ad' },
  SG: { paid: '#adv', gifted: 'This post was sponsored by the brand (free product)', affiliate: 'This post includes affiliate links', own_brand: '#adv' },
  OTHER: { paid: 'Ad: paid partnership', gifted: 'Ad: product received free from the brand', affiliate: 'Ad: affiliate links, I earn a commission', own_brand: 'Ad: my own product' },
};

/**
 * The disclosure label put on the FIRST line of a post when the creator declares a commercial relationship.
 * Uses wording each market's source names (see HINTS). Returns '' when there is no relationship.
 */
export function disclosureLabelFor(market: TargetMarket | null | undefined, relationship: CommercialRelationship | null | undefined): string {
  if (!isCommercialRelationship(relationship)) return '';
  return DISCLOSURE_LABELS[market ?? GENERIC_MARKET][relationship as Exclude<CommercialRelationship, 'none'>];
}

/** One line for the model prompt so the closing disclosure line uses wording that market accepts. */
export function targetMarketPromptLine(market: TargetMarket, relationship?: CommercialRelationship | null): string {
  const h = HINTS[market];
  const upfront = isCommercialRelationship(relationship)
    ? ` The creator has declared this post is commercial (${relationship}). The disclosure label is added automatically as the first line: do not write your own, and never put a disclosure only among hashtags.`
    : ' Any disclosure goes at the very start of the post, never only at the end or among hashtags.';
  if (market === GENERIC_MARKET) {
    return 'The audience is in a country with no built-in disclosure rule set. If the post needs an advertising disclosure, state any material connection (payment, free product, affiliate link) clearly and upfront in plain words. Do not invent a brand relationship.' + upfront;
  }
  return `The audience is in ${h.marketName}. If the post needs an advertising disclosure, use wording such as ${h.labelExamples.slice(0, 3).map((l) => `"${l}"`).join(', ')}${h.avoid.length ? `; avoid ${h.avoid.slice(0, 2).join(' and ')}` : ''}. Do not invent a brand relationship.${upfront}`;
}
