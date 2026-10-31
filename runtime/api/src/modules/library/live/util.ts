import { createHash } from 'crypto';

export const REVIEWED = ['已审核'];
export const PENDING = ['待审核'];
export type Check = 'ok' | 'minor_change' | 'changed' | 'repeal_signal' | 'url_broken' | 'unreachable' | 'refused' | 'manual';

export interface LibSource {
  title?: string;
  publisher?: string;
  doc_no?: string;
  url: string;
  read_scope?: string;
  [k: string]: unknown;
}

/** 资料条目（和 web-cn 的 rule-library.json 同一格式；审核后多出 reviewed_hash 等字段）。 */
export interface LibEntry {
  id: string;
  title: string;
  summary: string;
  category: string;
  tags?: string[];
  platforms?: string[];
  source: LibSource;
  status: string;
  review_status: string;
  publish_date?: string;
  effective_date?: string;
  retrieved_at?: string;
  reviewer?: string;
  reviewed_at?: string;
  approved_at?: string;
  last_verified_at?: string;
  updated_on?: string;
  change_note?: string;
  reviewed_hash?: string;
  version?: number;
  superseded_by?: string | null;
  ttl_days?: number;
  [k: string]: unknown;
}

export interface EntryState {
  check?: Check;
  content_hash?: string;
  baseline_hash?: string;
  baseline_title?: string;
  baseline_unverified?: boolean;
  title?: string;
  chars?: number;
  markers?: { repeal: number; revision: number };
  signals?: string[];
  change?: ChangeSummary | null;
  failures?: number;
  http_status?: number | null;
  error?: string;
  reason?: string;
  source_url?: string;
  first_seen_at?: string;
  last_ok_at?: string;
  last_checked_at?: string;
}

export interface Candidate {
  id: string;
  title: string;
  url: string;
  listing_id: string;
  listing_url: string;
  publisher: string;
  publish_date: string | null;
  category_hint: string;
  found_at: string;
  provenance: { fetched_at: string; listing_hash: string; read_scope: string; tier: string };
  license_note: string;
  status: '待核实';
  review_status: '待审核';
}

export interface LibState {
  schema: number;
  product?: string;
  generated_at?: string;
  entries: Record<string, EntryState>;
  candidates: Candidate[];
  seen_links?: Record<string, string[]>;
  listing_errors?: Record<string, { at: string; kind: string; status?: number | null }>;
}

export interface ChangeSummary {
  added: number | null;
  removed: number | null;
  ratio: number | null;
  digits_changed: boolean;
  samples: { old: string; new: string }[];
  detected_at?: string;
}

export const emptyState = (): LibState => ({ schema: 1, entries: {}, candidates: [] });

export function isReviewed(e: { review_status?: string }): boolean {
  return REVIEWED.includes(String(e.review_status ?? '').trim());
}

export function statusCode(label?: string): 'in_force' | 'draft' | 'repealed' | 'unverified' {
  switch (String(label ?? '').trim()) {
    case '现行':
      return 'in_force';
    case '征求意见稿':
      return 'draft';
    case '已废止':
      return 'repealed';
    default:
      return 'unverified';
  }
}

export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' | 'YYYY-MM' | ISO 时间 -> 当天 00:00 UTC 的毫秒数（仅到月的取 1 日）；不是日期返回 null。 */
export function parseDay(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(String(v).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3] ?? 1);
  const t = Date.UTC(y, mo - 1, d);
  const chk = new Date(t);
  return chk.getUTCFullYear() === y && chk.getUTCMonth() === mo - 1 && chk.getUTCDate() === d ? t : null;
}

export const dayStr = (t: number): string => new Date(t).toISOString().slice(0, 10);
export const daysBetween = (later: number, earlier: number): number => Math.round((later - earlier) / DAY_MS);
export const addDays = (t: number, n: number): number => t + n * DAY_MS;

/** 上海时间的“今天”。 */
export function shanghaiToday(now: Date = new Date()): number {
  const s = new Date(now.getTime() + 8 * 3_600_000);
  return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
}

/** 带 +08:00 的时间戳，日期部分就是上海本地日期。 */
export function isoShanghai(now: Date): string {
  const s = new Date(now.getTime() + 8 * 3_600_000);
  return `${s.toISOString().slice(0, 19)}+08:00`;
}

// ── HTML 文本抽取 ───────────────────────────────────────────────
const NOISE_LINE = /(浏览量|阅读量|点击量|访问量|阅读次数|浏览次数|字号[:：]|打印本页|关闭窗口|分享到|扫一扫|当前位置|责任编辑|网站地图|隐私政策|版权所有|ICP备|京公网安备|Cookie|cookies|Share this|Print this|Back to top|Skip to main content)/i;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
export function unescapeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

export function extractText(raw: string): { title: string; text: string } {
  const tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw);
  const title = tm ? unescapeHtml(tm[1]).replace(/\s+/g, ' ').trim() : '';
  let body = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  body = body.replace(/<(script|style|noscript|nav|header|footer|aside|form|iframe|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  body = body.replace(/<\/?(p|div|br|li|tr|h[1-6]|section|article|table|ul|ol)\b[^>]*>/gi, '\n');
  body = unescapeHtml(body.replace(/<[^>]+>/g, ' '));
  const lines: string[] = [];
  for (const ln0 of body.split(/\r?\n/)) {
    const ln = ln0.replace(/[ \t\u00a0\u3000]+/g, ' ').trim();
    if (!ln || NOISE_LINE.test(ln)) continue;
    lines.push(ln);
  }
  return { title, text: lines.join('\n') };
}

export interface Link {
  title: string;
  url: string;
  date: string | null;
}

export function extractLinks(raw: string, base: string): Link[] {
  const out: Link[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const href = m[1].trim();
    const text = unescapeHtml(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text || /^(javascript:|mailto:)/i.test(href)) continue;
    let url: string;
    try {
      url = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    const end = m.index + m[0].length;
    const tail = raw.slice(end, end + 160);
    const head = raw.slice(Math.max(0, m.index - 120), m.index);
    const dm = /(20\d{2})[-年./](\d{1,2})[-月./](\d{1,2})/.exec(tail) ?? /(20\d{2})[-年./](\d{1,2})[-月./](\d{1,2})/.exec(head);
    let date: string | null = null;
    if (dm) {
      const t = parseDay(`${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`);
      date = t === null ? null : dayStr(t);
    }
    out.push({ title: text, url, date });
  }
  return out;
}
