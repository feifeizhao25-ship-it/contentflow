/**
 * Channel attribution: parse UTM and referrer into a small, privacy-safe record.
 * - Only allow-listed keys are kept; values are lower-cased, length-capped and dropped if they look like personal data.
 * - Click ids (gclid, fbclid, ttclid, msclkid) are recorded as a boolean `hasClickId`, never stored.
 * - No cookies, no fingerprinting. The caller decides whether consent allows storing the record.
 */
export type Channel = 'paid' | 'email' | 'social' | 'referral' | 'ai_search' | 'organic_search' | 'direct';

const ALLOWED = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'] as const;
const CLICK_IDS = ['gclid', 'fbclid', 'ttclid', 'msclkid', 'wbraid', 'gbraid'];
const MAX_LEN = 64;
const PII = [/[^@\s]+@[^@\s]+\.[a-z]{2,}/i, /\d{8,}/, /https?:\/\//i];
const UNSAFE = /[^a-z0-9_\-.\u4e00-\u9fff]/g;

const AI_SEARCH = ['chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'gemini.google.com', 'copilot.microsoft.com', 'claude.ai', 'kimi.com', 'doubao.com', 'yuanbao.tencent.com', 'tongyi.aliyun.com'];
const SEARCH = ['google.', 'bing.com', 'duckduckgo.com', 'baidu.com', 'sogou.com', 'so.com', 'yahoo.', 'yandex.'];
const SOCIAL = ['reddit.com', 'x.com', 'twitter.com', 't.co', 'linkedin.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'xiaohongshu.com', 'douyin.com', 'weibo.com', 'bilibili.com', 'zhihu.com', 'mp.weixin.qq.com', 'producthunt.com'];
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsocial', 'display', 'cpm', 'ads'];

function clean(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().toLowerCase().slice(0, MAX_LEN);
  if (!s) return null;
  if (PII.some((p) => p.test(s))) return null;
  const out = s.replace(UNSAFE, '-').replace(/^-+|-+$/g, '');
  return out || null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function classify(medium: string | null | undefined, referrer: string | null | undefined, hasClickId = false): Channel {
  const m = (medium ?? '').toLowerCase();
  if (PAID_MEDIUMS.includes(m) || (hasClickId && !['email', 'social', 'organic'].includes(m))) return 'paid';
  if (m === 'email') return 'email';
  if (m === 'social' || m === 'social-organic') return 'social';
  if (m === 'referral' || m === 'affiliate') return 'referral';
  const h = hostOf(referrer ?? '');
  if (h) {
    if (AI_SEARCH.some((d) => h === d || h.endsWith('.' + d))) return 'ai_search';
    if (SEARCH.some((d) => h.includes(d))) return 'organic_search';
    if (SOCIAL.some((d) => h === d || h.endsWith('.' + d))) return 'social';
    return 'referral';
  }
  return 'direct';
}

export interface AttributionRecord {
  channel: Channel;
  hasClickId: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  ref?: string;
}

/** Never throws on malformed input. */
export function parseAttribution(url: string, referrer?: string | null, ownHosts: string[] = []): AttributionRecord {
  let q = new URLSearchParams();
  try {
    q = new URL(url).searchParams;
  } catch {
    /* malformed or relative: no query */
  }
  const rec: Partial<AttributionRecord> = {};
  for (const k of ALLOWED) {
    const v = clean(q.get(k));
    if (v) rec[k] = v;
  }
  const hasClickId = CLICK_IDS.some((k) => q.has(k));
  const ref = ownHosts.includes(hostOf(referrer ?? '')) ? null : referrer;
  return { ...rec, hasClickId, channel: classify(rec.utm_medium, ref, hasClickId) };
}

/** Tagged link for OpenClaw-prepared posts. Values are validated with the same cleaner. */
export function buildTaggedUrl(base: string, source: string, medium: string, campaign: string, content?: string): string {
  const parts: Array<[string, string]> = [['utm_source', source], ['utm_medium', medium], ['utm_campaign', campaign]];
  if (content) parts.push(['utm_content', content]);
  const cleaned = parts.map(([k, v]) => [k, clean(v)] as const);
  if (cleaned.some(([, v]) => !v)) throw new Error('utm value empty or looks like personal data');
  return base + (base.includes('?') ? '&' : '?') + cleaned.map(([k, v]) => `${k}=${v}`).join('&');
}
