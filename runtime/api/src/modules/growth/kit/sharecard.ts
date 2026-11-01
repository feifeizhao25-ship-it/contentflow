/** Share-card payloads (Open Graph + text) with language and disclaimer checks. `errors` non-empty means: do not show or post. */
import { buildTaggedUrl } from './attribution';
import { isChineseSurface, isEnglishOnly, scanClaims } from './claims';

export type Locale = 'en' | 'zh';
export type Topic = 'wellness' | 'culture' | 'energy' | 'content';

export const DISCLAIMERS: Record<string, string> = {
  'en:wellness': 'For general wellness. Not medical advice.',
  'en:culture': 'For reflection and entertainment only.',
  'en:energy': 'Estimates only. Not investment advice.',
  'en:content': 'AI-assisted. Review before publishing.',
  'zh:wellness': '仅供日常养生参考，不构成医疗建议。',
  'zh:culture': '文化参考，仅供参考与娱乐。',
  'zh:energy': '测算结果仅供参考，不构成投资建议。',
  'zh:content': '内容由 AI 辅助生成，发布前请人工审阅。',
};
const MAX_TITLE: Record<string, number> = { en: 60, zh: 30 };
const MAX_DESC: Record<string, number> = { en: 160, zh: 80 };

export interface CardInput {
  locale: Locale;
  topic: Topic;
  title: string;
  description: string;
  landingUrl: string;
  source?: string;
  campaign?: string;
  imageUrl?: string;
}

export interface CardOk {
  ok: true;
  errors: [];
  og: Record<string, string>;
  twitter: Record<string, string>;
  text: string;
  disclaimer: string;
}
export type CardResult = CardOk | { ok: false; errors: string[] };

export function buildShareCard(inp: CardInput): CardResult {
  const errors: string[] = [];
  if (inp.locale !== 'en' && inp.locale !== 'zh') errors.push('locale');
  if (!(`${inp.locale}:${inp.topic}` in DISCLAIMERS)) errors.push('topic');
  const text = `${inp.title} ${inp.description}`;
  if (inp.locale === 'en' && !isEnglishOnly(text)) errors.push('english_only_violation');
  if (inp.locale === 'zh' && !isChineseSurface(text)) errors.push('chinese_surface_violation');
  if (inp.locale in MAX_TITLE) {
    if (inp.title.length > MAX_TITLE[inp.locale]) errors.push('title_too_long');
    if (inp.description.length > MAX_DESC[inp.locale]) errors.push('description_too_long');
  }
  for (const [cat, m] of scanClaims(text)) errors.push(`claim:${cat}:${m}`);
  if (errors.length) return { ok: false, errors };
  const url = buildTaggedUrl(inp.landingUrl, inp.source ?? 'share', 'social-organic', inp.campaign ?? 'sharecard');
  const disclaimer = DISCLAIMERS[`${inp.locale}:${inp.topic}`];
  return {
    ok: true,
    errors: [],
    og: { 'og:title': inp.title, 'og:description': inp.description, 'og:url': url, 'og:type': 'website', ...(inp.imageUrl ? { 'og:image': inp.imageUrl } : {}) },
    twitter: { 'twitter:card': 'summary_large_image', 'twitter:title': inp.title, 'twitter:description': inp.description },
    text: `${inp.title}\n${inp.description}\n${url}\n${disclaimer}`,
    disclaimer,
  };
}
