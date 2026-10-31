/**
 * Target-market option for the international edition. The same English copy needs different
 * ad-disclosure wording depending on where the audience is. Every hint below is paraphrased from the
 * regulator / self-regulatory body named in `sources`, opened on 2026-10-31. These are labelling
 * hints, not legal advice, and they only cover the markets listed. "SG" is Singapore only: other
 * Southeast Asian countries are NOT covered and are not offered as an option.
 */
export const TARGET_MARKETS = ['US', 'UK', 'IN', 'SG'] as const;
export type TargetMarket = (typeof TARGET_MARKETS)[number];

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
      { name: 'FTC, Disclosures 101 for Social Media Influencers', url: 'https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers', retrievedAt: RETRIEVED },
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
};

export function resolveTargetMarket(input: unknown): TargetMarket | null {
  const v = String(input ?? '').trim().toUpperCase();
  return (TARGET_MARKETS as readonly string[]).includes(v) ? (v as TargetMarket) : null;
}

export function disclosureHint(market: TargetMarket): DisclosureHint {
  return HINTS[market];
}

/** One line for the model prompt so the closing disclosure line uses wording that market accepts. */
export function targetMarketPromptLine(market: TargetMarket): string {
  const h = HINTS[market];
  return `The audience is in ${h.marketName}. If the post needs an advertising disclosure, use wording such as ${h.labelExamples.slice(0, 3).map((l) => `"${l}"`).join(', ')}${h.avoid.length ? `; avoid ${h.avoid.slice(0, 2).join(' and ')}` : ''}. Do not invent a brand relationship.`;
}
