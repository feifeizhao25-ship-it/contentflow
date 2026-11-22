/**
 * Promotion, discount and scarcity wording the user never supplied.
 *
 * 2026-11-21 test: a content pack for "Our coffee shop launches a pumpkin spice cold brew this weekend"
 * came back saying "While supplies last" / "limited stock" several times. The shop never said stock was
 * limited, so the script invented a scarcity promise the shop may not keep (a consumer-protection risk).
 * This is a text match, not a fact check: a phrase is "unsupplied" when neither the topic nor the user's
 * material contains the same promotion concept.
 */

interface PromoRule {
  /** Stable id, so a concept the user supplied in other words still counts as supplied. */
  concept: string;
  /** Matches the phrase in generated copy. */
  pattern: RegExp;
  /** Matches the same concept in the user's own text. */
  supplied: RegExp;
}

const RULES: PromoRule[] = [
  { concept: 'scarcity', pattern: /\b(?:while (?:supplies|stocks?) last|limited (?:stock|supply|quantit(?:y|ies)|batch|run)|until (?:it'?s|they'?re) gone|(?:almost|nearly) (?:sold out|gone)|first \d+ (?:customers|people|orders))\b/gi, supplied: /supplies last|stocks? last|limited (?:stock|supply|quantit|batch|run)|until (?:it'?s|it is|they'?re|they are) gone|sold out|first \d+|only \d+|限量|售完即止|卖完为止|售罄|先到先得/i },
  { concept: 'deadline', pattern: /\b(?:limited[- ]time(?: only| offer)?|today only|one day only|this weekend only|ends (?:tonight|today|soon)|last chance|don'?t miss out|act now|hurry)\b/gi, supplied: /limited[- ]time|today only|day only|weekend only|ends (?:tonight|today|soon)|last chance|限时|仅限|截止/i },
  { concept: 'discount', pattern: /\b(?:\d+(?:\.\d+)?\s*%\s*off|[$€£]\s?\d+(?:\.\d+)?\s*off|half[- ]price|on sale|\d+\s*%\s*discount|discount code|promo code|coupon code|buy one,? get one|bogo)\b/gi, supplied: /% ?off|\boff\b|half[- ]price|sale|discount|promo|coupon|buy one|bogo|折|优惠|半价|立减|满减|券|特价/i },
  { concept: 'free', pattern: /\b(?:free (?:shipping|delivery|gift|sample|refill|upgrade|topping|shot|cup|drink|trial)|for free|complimentary)\b/gi, supplied: /\bfree\b|complimentary|免费|赠|送/i },
  { concept: 'scarcity', pattern: /(?:限量(?:供应|发售|款)?|售完即止|卖完为止|即将售罄|先到先得|数量有限|前\s*\d+\s*名)/g, supplied: /限量|售完即止|卖完为止|售罄|先到先得|数量有限|前\s*\d+\s*名|limited|supplies last|sold out/i },
  { concept: 'deadline', pattern: /(?:限时(?:优惠|特惠|抢购)?|仅限今[天日]|今[天日]截止|最后一天|错过(?:就)?(?:再)?等一年|手慢无)/g, supplied: /限时|仅限|截止|最后一天|limited[- ]time|today only/i },
  { concept: 'discount', pattern: /(?:\d+(?:\.\d+)?\s*折|买一送一|第二(?:杯|件)半价|半价|立减\s*\d*|满\s*\d+\s*减\s*\d+|领(?:取)?优惠券|特价)/g, supplied: /折|买一送一|半价|立减|满减|满\s*\d+\s*减|优惠|特价|discount|% ?off|bogo|buy one/i },
  { concept: 'free', pattern: /(?:免费(?:送|领|试用|配送|续杯|升级)?|包邮|赠送|送\s*(?:小礼品|赠品))/g, supplied: /免费|包邮|赠|送|free|complimentary/i },
];

/**
 * Checklists and caveats name the very phrases they warn against ("- [ ] No discount or promotion claims",
 * 「不要写限量」). Skip a match on a checklist line or right after a negation on the same line.
 */
function isNegatedOrChecklist(text: string, index: number): boolean {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const before = text.slice(lineStart, index);
  if (/^\s*(?:[-*]\s*)?\[[ xX]?\]/.test(before)) return true;
  const near = before.slice(-24);
  return /\b(?:no|not|never|don'?t|do not|avoid|without|remove)\b[^.!?。！？]*$/i.test(near) || /(?:不|无|勿|避免|别|禁止|删除)[^。！？]*$/.test(near);
}

/** Promotion / discount / scarcity phrases in `content` whose concept is absent from `userText`. Up to 10, first occurrence each. */
export function findUnsuppliedPromoClaims(content: string, userText: string): string[] {
  const text = content ?? '';
  const given = userText ?? '';
  const found: string[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    if (rule.supplied.test(given)) continue;
    for (const m of text.matchAll(rule.pattern)) {
      if (isNegatedOrChecklist(text, m.index ?? 0)) continue;
      const phrase = m[0].trim();
      const key = phrase.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(phrase);
    }
  }
  return found.slice(0, 10);
}

export function promoPromptLine(global: boolean): string {
  return global
    ? ' Do not add promotions, discounts, free items, deadlines or scarcity wording (for example "while supplies last", "limited time", "% off") unless the topic or the user\'s material states them.'
    : '不要自行添加促销、折扣、赠品、限时或限量说法（例如「售完即止」「限时优惠」「买一送一」），除非主题或用户资料里写明了。';
}

export const PROMO_NOTICE_ZH = '文中出现了你没有提供的促销、折扣、限时或限量说法，可能是 AI 自行添加的。实际没有这项活动就删除，避免虚假宣传。';
export const PROMO_NOTICE_EN = 'The copy contains promotion, discount, deadline or scarcity wording you did not provide; the AI may have added it. Remove it unless the offer is real, to avoid misleading customers.';
