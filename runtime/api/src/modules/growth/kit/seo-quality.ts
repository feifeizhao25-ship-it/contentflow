/**
 * Programmatic-page quality gate aligned with Google's scaled-content-abuse policy and GEO evidence.
 * A page may only go live if it has: enough original substance, a real difference from sibling pages, dated sources,
 * title/body that match the user question it answers, no forbidden claims, and an AI-assistance note when AI wrote it.
 * Structured data is for rich-result eligibility only; we do NOT claim it improves AI citations.
 */
import { isChineseSurface, isEnglishOnly, scanClaims } from './claims';

const MIN_WORDS_EN = 150;
const MIN_CHARS_ZH = 300;
const MAX_SIBLING_SIMILARITY = 0.6;
const MIN_QUESTION_OVERLAP = 0.5;
const WORD = /[a-z0-9']+/g;
const ZH_CHAR = /[\u3400-\u9fff]/g;

export interface PageDraft {
  url: string;
  locale: 'en' | 'zh';
  question: string; // the real user question this page answers
  title: string;
  body: string;
  sources: Array<{ url: string; date: string }>; // date: YYYY-MM-DD
  aiAssisted: boolean;
  aiNote: string;
}

function tokens(text: string, locale: string): string[] {
  if (locale === 'zh') {
    const chars = text.match(ZH_CHAR) ?? [];
    const out: string[] = [];
    for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
    return out;
  }
  return text.toLowerCase().match(WORD) ?? [];
}

function shingles(toks: string[], k = 3): Set<string> {
  if (toks.length < k) return toks.length ? new Set([toks.join(' ')]) : new Set();
  const s = new Set<string>();
  for (let i = 0; i <= toks.length - k; i++) s.add(toks.slice(i, i + k).join('\u0001'));
  return s;
}

export function similarity(a: string, b: string, locale: string): number {
  const sa = shingles(tokens(a, locale));
  const sb = shingles(tokens(b, locale));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export function questionOverlap(question: string, title: string, bodyHead: string, locale: string): number {
  const q = new Set(tokens(question, locale));
  if (!q.size) return 0;
  const t = new Set(tokens(`${title} ${bodyHead}`, locale));
  let n = 0;
  for (const x of q) if (t.has(x)) n++;
  return n / q.size;
}

export interface GateResult {
  publish: boolean;
  noindex: boolean;
  reasons: string[];
  maxSiblingSimilarity: number;
}

const DAY = 86_400_000;
const isoDay = (s: string): number | null => (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) ? Date.parse(s + 'T00:00:00Z') : null);

export function checkPage(page: PageDraft, siblings: string[], today: Date = new Date(), maxSourceAgeDays = 365): GateResult {
  const reasons: string[] = [];
  if (page.locale === 'en') {
    if (!isEnglishOnly(page.title + page.body)) reasons.push('english_only_violation');
    if ((page.body.toLowerCase().match(WORD) ?? []).length < MIN_WORDS_EN) reasons.push('thin_content');
  } else if (page.locale === 'zh') {
    if ((page.body.match(ZH_CHAR) ?? []).length < MIN_CHARS_ZH) reasons.push('thin_content');
    if (!isChineseSurface(page.title + page.body)) reasons.push('chinese_surface_violation');
  } else {
    reasons.push('locale');
  }
  if (questionOverlap(page.question, page.title, page.body.slice(0, 400), page.locale) < MIN_QUESTION_OVERLAP) reasons.push('question_mismatch');
  const worst = siblings.reduce((m, s) => Math.max(m, similarity(page.body, s, page.locale)), 0);
  if (worst > MAX_SIBLING_SIMILARITY) reasons.push('near_duplicate');
  if (!page.sources.length) {
    reasons.push('no_sources');
  } else {
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    for (const s of page.sources) {
      const t = isoDay(s.date ?? '');
      if (t === null) {
        reasons.push('source_date_invalid');
        break;
      }
      if (Math.floor((todayUtc - t) / DAY) > maxSourceAgeDays) {
        reasons.push('source_stale');
        break;
      }
    }
  }
  for (const [cat] of scanClaims(`${page.title} ${page.body}`)) reasons.push(`claim:${cat}`);
  if (page.aiAssisted && !page.aiNote.trim()) reasons.push('missing_ai_note');
  const uniq = [...new Set(reasons)].sort();
  return { publish: uniq.length === 0, noindex: uniq.length > 0, reasons: uniq, maxSiblingSimilarity: Math.round(worst * 1000) / 1000 };
}

/** schema.org Article for rich-result eligibility. Validate in Search Console before relying on it. */
export function articleJsonLd(page: PageDraft, published: string, authorName: string): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: page.title.slice(0, 110), datePublished: published, author: { '@type': 'Organization', name: authorName }, mainEntityOfPage: page.url, inLanguage: page.locale });
}
