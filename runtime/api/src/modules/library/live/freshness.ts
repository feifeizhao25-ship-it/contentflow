/** 重新抓取每条资料的官方来源，发现变化，只写「状态文件」，从不改条目本身。 */
import { Candidate, ChangeSummary, EntryState, LibEntry, LibState, Link, emptyState, extractLinks, isReviewed, isoShanghai, parseDay, sha256, daysBetween, shanghaiToday } from './util';

export const REPEAL_RE = /(已废止|已失效|失效日期|废止日期|不再适用|已被废止|被废止|已被.{0,12}替代|停止执行|has been repealed|no longer in force|withdrawn|superseded by)/gi;
export const REVISION_RE = /(修订|修正|修改的决定|第[一二三四五六七八九十]+次修正|revised|updated version|amended)/gi;
export const HEAD_CHARS = 400;
export const MINOR_RATIO = 0.002;

export class FetchError extends Error {
  constructor(public kind: 'broken' | 'unreachable' | 'refused', public status: number | null = null, public detail = '') {
    super(`${kind}:${status}:${detail}`);
  }
}

export interface Page {
  url: string;
  status: number;
  title: string;
  text: string;
  raw?: string;
}
export type Fetcher = (url: string) => Promise<Page>;

type Op = { tag: 'equal' | 'replace' | 'insert' | 'delete'; i1: number; i2: number; j1: number; j2: number };

/** 最长公共子序列的块对比（和 difflib.SequenceMatcher.get_opcodes 同一类结果）。输入太大时退化为“整体替换”。 */
export function opcodes(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  if (n * m > 25_000_000) return [{ tag: 'replace', i1: 0, i2: n, j1: 0, j2: m }];
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  let cur: Op | null = null;
  const push = (tag: Op['tag'], di: number, dj: number) => {
    if (cur && cur.tag === tag) {
      cur.i2 += di;
      cur.j2 += dj;
    } else {
      cur = { tag, i1: i, i2: i + di, j1: j, j2: j + dj };
      ops.push(cur);
    }
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      push('equal', 1, 1);
      i++;
      j++;
    } else if (j < m && (i === n || dp[i * w + j + 1] >= dp[(i + 1) * w + j])) {
      push('insert', 0, 1);
      j++;
    } else {
      push('delete', 1, 0);
      i++;
    }
  }
  // 相邻的 delete+insert 合并成 replace
  const merged: Op[] = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.tag !== 'equal' && op.tag !== 'equal') {
      last.tag = 'replace';
      last.i2 = op.i2;
      last.j2 = op.j2;
    } else merged.push({ ...op });
  }
  return merged;
}

const digitsOf = (s: string): string[] => s.match(/\d+(?:\.\d+)?/g) ?? [];

export function diffSummary(oldText: string, newText: string, samples = 4): ChangeSummary {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const added: string[] = [];
  const removed: string[] = [];
  const sample: { old: string; new: string }[] = [];
  let changed = 0;
  for (const op of opcodes(a, b)) {
    if (op.tag === 'equal') continue;
    removed.push(...a.slice(op.i1, op.i2));
    added.push(...b.slice(op.j1, op.j2));
    if (op.tag === 'replace' && op.i2 - op.i1 === op.j2 - op.j1) {
      for (let k = 0; k < op.i2 - op.i1; k++) {
        const x = a[op.i1 + k];
        const y = b[op.j1 + k];
        for (const c of opcodes([...x], [...y])) if (c.tag !== 'equal') changed += Math.max(c.i2 - c.i1, c.j2 - c.j1);
      }
    } else {
      changed += a.slice(op.i1, op.i2).reduce((s, x) => s + x.length, 0) + b.slice(op.j1, op.j2).reduce((s, x) => s + x.length, 0);
    }
    if (sample.length < samples) sample.push({ old: a.slice(op.i1, op.i2).join(' / ').slice(0, 160), new: b.slice(op.j1, op.j2).join(' / ').slice(0, 160) });
  }
  const ratio = changed / Math.max(oldText.length + newText.length, 1);
  const digits_changed = JSON.stringify(digitsOf(added.join('\n')).sort()) !== JSON.stringify(digitsOf(removed.join('\n')).sort());
  return { added: added.length, removed: removed.length, ratio: Math.round(ratio * 1e5) / 1e5, digits_changed, samples: sample };
}

const count = (re: RegExp, s: string) => (s.match(re) ?? []).length;
const markers = (t: string) => ({ repeal: count(REPEAL_RE, t), revision: count(REVISION_RE, t) });
const has = (re: RegExp, s: string) => {
  re.lastIndex = 0;
  const r = re.test(s);
  re.lastIndex = 0;
  return r;
};

export function evaluateSource(entry: LibEntry, prev: EntryState | undefined, page: Page | null, err: FetchError | null, now: Date, opts: { baselineText?: string | null; injection?: (t: string) => string[] } = {}): EntryState {
  const reviewed = isReviewed(entry);
  const st: EntryState = { ...(prev ?? {}) };
  st.first_seen_at ??= isoShanghai(now);
  st.source_url = entry.source?.url ?? '';
  st.last_checked_at = isoShanghai(now);
  if (err) {
    st.failures = Number(st.failures ?? 0) + 1;
    st.http_status = err.status;
    st.check = err.kind === 'broken' ? 'url_broken' : err.kind === 'refused' ? 'refused' : 'unreachable';
    st.error = err.kind;
    return st;
  }
  if (!page) throw new Error('page required');
  st.failures = 0;
  delete st.error;
  st.http_status = page.status ?? 200;
  const { title, text } = page;
  const h = sha256(text);
  st.title = title;
  st.content_hash = h;
  st.chars = text.length;
  const signals: string[] = [];
  if (opts.injection) signals.push(...opts.injection(text).map((p) => `injection:${p}`));
  const baselineHash = (reviewed ? entry.reviewed_hash : undefined) || prev?.baseline_hash;
  st.baseline_hash = baselineHash || h;
  if (!prev && !entry.reviewed_hash) {
    st.check = 'ok';
    st.baseline_title = title;
    st.markers = markers(text);
    st.baseline_unverified = true;
    st.last_ok_at = isoShanghai(now);
    st.signals = signals;
    return st;
  }
  const baseTitle = prev?.baseline_title ?? title;
  const baseMarkers = prev?.markers ?? markers(text);
  st.baseline_title ??= baseTitle;
  st.markers ??= baseMarkers;
  if (h === st.baseline_hash && title === baseTitle) {
    st.check = 'ok';
    st.change = null;
    st.last_ok_at = isoShanghai(now);
    st.signals = signals;
    return st;
  }
  const mk = markers(text);
  const head = `${title}\n${text.slice(0, HEAD_CHARS)}`;
  const repeal = has(REPEAL_RE, head) || mk.repeal > (baseMarkers.repeal ?? 0);
  const revision = (has(REVISION_RE, title) && !has(REVISION_RE, baseTitle)) || mk.revision > (baseMarkers.revision ?? 0);
  if (title !== baseTitle) signals.push('title_changed');
  if (revision) signals.push('revision_marker');
  if (repeal) signals.push('repeal_marker');
  const ch: ChangeSummary = opts.baselineText != null ? diffSummary(opts.baselineText, text) : { added: null, removed: null, ratio: null, digits_changed: true, samples: [] };
  const pc = prev?.change;
  ch.detected_at = prev?.content_hash === h && pc?.detected_at ? pc.detected_at : isoShanghai(now);
  const minor = ch.ratio !== null && ch.ratio < MINOR_RATIO && !ch.digits_changed && !repeal && !revision && title === baseTitle;
  if (repeal) st.check = 'repeal_signal';
  else if (minor) {
    st.check = 'minor_change';
    st.last_ok_at = isoShanghai(now);
  } else st.check = 'changed';
  st.change = ch;
  st.signals = signals;
  if (!reviewed) {
    st.baseline_hash = h;
    st.baseline_title = title;
    st.markers = mk;
  }
  return st;
}

export interface Snapshots {
  read(id: string, kind: 'baseline' | 'latest'): string | null;
  write(id: string, kind: 'baseline' | 'latest', text: string): void;
  exists(id: string, kind: 'baseline' | 'latest'): boolean;
}

export async function checkEntries(entries: LibEntry[], state: LibState | undefined, fetch: Fetcher, now: Date, opts: { product?: string; snapshots?: Snapshots; injection?: (t: string) => string[]; manualHosts?: Record<string, string> } = {}): Promise<LibState> {
  const out: LibState = JSON.parse(JSON.stringify(state ?? emptyState()));
  out.entries ??= {};
  out.candidates ??= [];
  out.schema = 1;
  out.product = opts.product ?? out.product ?? '';
  out.generated_at = isoShanghai(now);
  const cache = new Map<string, { page: Page | null; err: FetchError | null }>();
  const manual = opts.manualHosts ?? {};
  for (const e of entries) {
    const url = e.source?.url;
    if (!url || e.status === '已废止') continue;
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      /* bad url handled by fetch */
    }
    if (host in manual) {
      const prev = out.entries[e.id] ?? {};
      out.entries[e.id] = { ...prev, source_url: url, check: 'manual', reason: manual[host], last_checked_at: isoShanghai(now), first_seen_at: prev.first_seen_at ?? isoShanghai(now) };
      continue;
    }
    let hit = cache.get(url);
    if (!hit) {
      try {
        hit = { page: await fetch(url), err: null };
      } catch (ex) {
        hit = { page: null, err: ex instanceof FetchError ? ex : new FetchError('unreachable', null, (ex as Error)?.name ?? 'error') };
      }
      cache.set(url, hit);
    }
    const baseText = opts.snapshots?.read(e.id, 'baseline') ?? null;
    out.entries[e.id] = evaluateSource(e, out.entries[e.id], hit.page, hit.err, now, { baselineText: baseText, injection: opts.injection });
    if (opts.snapshots && hit.page) {
      if (!opts.snapshots.exists(e.id, 'baseline') || !isReviewed(e)) opts.snapshots.write(e.id, 'baseline', hit.page.text);
      opts.snapshots.write(e.id, 'latest', hit.page.text);
    }
  }
  return out;
}

export interface Watch {
  id: string;
  name?: string;
  publisher?: string;
  listing_url: string;
  title_include?: string[];
  license_note?: string;
  category_hint?: string;
}

/** 从权威来源的列表页暂存新候选（只有标题、链接、日期；永远「待核实 / 待审核」，不进库、不进检索）。 */
export async function discover(watch: Watch[], state: LibState, fetch: Fetcher, now: Date, opts: { knownUrls?: string[]; urlOk?: (u: string) => boolean; recentDays?: number; maxNew?: number } = {}): Promise<LibState> {
  const out: LibState = JSON.parse(JSON.stringify(state));
  out.candidates ??= [];
  const seen = (out.seen_links ??= {});
  const known = new Set<string>([...(opts.knownUrls ?? []), ...out.candidates.map((c) => c.url)]);
  const recent = opts.recentDays ?? 45;
  const maxNew = opts.maxNew ?? 20;
  const today = shanghaiToday(now);
  let added = 0;
  for (const w of watch) {
    let page: Page;
    try {
      page = await fetch(w.listing_url);
    } catch (ex) {
      const fe = ex instanceof FetchError ? ex : new FetchError('unreachable', null, (ex as Error)?.name);
      (out.listing_errors ??= {})[w.id] = { at: isoShanghai(now), kind: fe.kind, status: fe.status };
      continue;
    }
    if (out.listing_errors) delete out.listing_errors[w.id];
    const first = !(w.id in seen);
    const here = new Set(seen[w.id] ?? []);
    const links: Link[] = extractLinks(page.raw ?? '', w.listing_url);
    const include = (w.title_include ?? []).map((k) => k.toLowerCase());
    for (const ln of links) {
      if (opts.urlOk && !opts.urlOk(ln.url)) continue;
      const isNew = !here.has(ln.url);
      here.add(ln.url);
      if (!isNew || known.has(ln.url)) continue;
      if (include.length && !include.some((k) => ln.title.toLowerCase().includes(k))) continue;
      const d = parseDay(ln.date);
      if (first && !(d !== null && daysBetween(today, d) <= recent)) continue;
      if (added >= maxNew) break;
      const cand: Candidate = {
        id: `cand-${sha256(ln.url).slice(0, 10)}`,
        title: ln.title,
        url: ln.url,
        listing_id: w.id,
        listing_url: w.listing_url,
        publisher: w.publisher ?? '',
        publish_date: ln.date,
        category_hint: w.category_hint ?? '',
        found_at: isoShanghai(now),
        provenance: { fetched_at: isoShanghai(now), listing_hash: sha256(page.text), read_scope: '仅列表页标题与日期，正文未读', tier: '待核实（未达 A 级）' },
        license_note: w.license_note ?? '',
        status: '待核实',
        review_status: '待审核',
      };
      out.candidates.push(cand);
      known.add(ln.url);
      added++;
    }
    seen[w.id] = [...here].sort().slice(-800);
  }
  out.generated_at = isoShanghai(now);
  return out;
}

export const CHECK_ZH: Record<string, string> = {
  manual: '该站点拒绝程序访问，需人工到浏览器核对',
  ok: '未变化',
  minor_change: '细微变动（已记录）',
  changed: '来源内容有变化',
  repeal_signal: '来源出现「废止/失效」迹象',
  url_broken: '链接失效',
  unreachable: '暂时无法访问',
  refused: '被抓取规则拒绝',
};

/** 给审核人看的 Markdown 摘要（中文）。 */
export function renderReport(entries: LibEntry[], state: LibState): string {
  const by = new Map(entries.map((e) => [e.id, e]));
  const lines = [`# 规则库来源核对报告（${state.generated_at ?? ''}）`, ''];
  const attn = Object.entries(state.entries).filter(([, s]) => s.check !== 'ok');
  lines.push(`- 已核对 ${Object.keys(state.entries).length} 条；需要人看的 ${attn.length} 条；新候选 ${state.candidates.length} 条。`);
  lines.push('- 以上只是提示，没有任何内容因此上线或被改写；是否更新由审核人决定。', '');
  if (attn.length) {
    lines.push('## 需要人工处理');
    for (const [id, s] of attn.sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`- **${id}** ${by.get(id)?.title ?? ''}：${CHECK_ZH[s.check ?? ''] ?? s.check}${s.signals?.length ? `（${s.signals.join(', ')}）` : ''}  来源：${s.source_url ?? ''}`);
      for (const smp of (s.change?.samples ?? []).slice(0, 2)) lines.push(`  - 旧：${smp.old}`, `  - 新：${smp.new}`);
    }
  }
  if (state.candidates.length) {
    lines.push('', '## 暂存的新候选（只读过标题，需人工读全文后才可能成为条目）');
    for (const c of state.candidates) lines.push(`- ${c.title}（${c.publisher}，${c.publish_date ?? '日期未知'}）${c.url}`);
  }
  return `${lines.join('\n')}\n`;
}

