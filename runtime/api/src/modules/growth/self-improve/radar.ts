/**
 * 研究雷达（与 Python 版 self_improve/radar.py 同一套边界）：
 * 只访问白名单主机，只写一份摘要文件（radar/digest_YYYYMMDD.md 和去重用的 seen.json），
 * 不入库、不改技能、不推送。SIL_ENABLED=0（默认）时 runRadarIfEnabled 什么都不做。
 * 抓回的文字一律当数据：去控制字符、截断、含提示注入特征的条目丢弃。许可证类别只是提醒，不是法律意见。
 * 本文件不引用审批、企业微信或任何发送函数。
 */
import { createHash } from 'crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { request } from 'https';
import { join } from 'path';
import { SILConfig } from './config';
import { scanInjection } from './sources';

export const RADAR_CRON = '0 5 * * 3'; // 周三 05:00（Asia/Shanghai），可交给 nextRun 解析；不放进 SIL_CRON，避免改动既有调度
export const RADAR_ALLOWED_HOSTS = ['export.arxiv.org', 'api.github.com', 'huggingface.co'] as const;
const PAGE_HOSTS = [...RADAR_ALLOWED_HOSTS, 'arxiv.org', 'github.com'];
const MAX_BYTES = 400_000;

export const DEFAULT_QUERIES: Record<string, string[]> = {
  shunshi: ['traditional chinese medicine LLM', 'health chatbot safety medical boundary'],
  jianji: ['AI companion safety', 'psychological support LLM evaluation'],
  fenfaxia: ['AIGC content label compliance', 'content moderation LLM'],
  contentflow: ['AIGC content label compliance', 'content moderation LLM'],
  energy: ['photovoltaic forecasting', 'renewable energy policy retrieval'],
};

export interface RadarItem {
  source: string;
  id: string;
  title: string;
  summary: string;
  date: string;
  url: string;
  license: string | null;
}
export type RadarHttp = (url: string, timeoutMs: number) => Promise<string>;

const NC = /(^|[-_:])nc([-_.]|$)|noncommercial|non-commercial/i;
const SA = /(^|[-_:])sa([-_.]|$)|sharealike|share-alike/i;
const PERMISSIVE = /^(license:)?(mit|apache-2\.0|apache|bsd-[23]-clause|bsd|isc|cc0-1\.0|cc0|cc-by-4\.0|cc-by|unlicense)$/i;
const COPYLEFT = /gpl|agpl|lgpl|mpl|eupl|cc-by-sa|cc-by-nc/i;

export function licenseClass(lic?: string | null): string {
  const t = (lic ?? '').trim();
  if (!t || ['other', 'noassertion', 'unknown', 'none', 'null'].includes(t.toLowerCase())) return 'unknown_do_not_introduce';
  if (NC.test(t) || SA.test(t)) return 'do_not_ingest';
  if (COPYLEFT.test(t)) return 'do_not_introduce';
  if (PERMISSIVE.test(t)) return 'permissive_reference';
  return 'unknown_do_not_introduce';
}

const clean = (v: unknown, limit: number) => String(v ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);

function safeItem(it: RadarItem): RadarItem | null {
  it.title = clean(it.title, 160);
  it.summary = clean(it.summary, 300);
  if (!it.title || scanInjection(`${it.title} ${it.summary}`).length) return null;
  try {
    if (!PAGE_HOSTS.includes(new URL(it.url).hostname)) return null;
  } catch {
    return null;
  }
  return it;
}

export function parseArxiv(xml: string): RadarItem[] {
  if (xml.includes('<!DOCTYPE') || xml.includes('<!ENTITY')) throw new Error('xml_entities_refused');
  const out: RadarItem[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const tag = (n: string) => (m[1].match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`)) ?? [, ''])[1];
    const link = tag('id').trim().replace('http://', 'https://');
    const it = safeItem({ source: 'arxiv', id: link.split('/abs/').pop() ?? '', title: tag('title'), summary: tag('summary'), date: tag('published').slice(0, 10), url: link, license: null });
    if (it) out.push(it);
  }
  return out;
}

export function parseGithub(payload: { items?: any[] }): RadarItem[] {
  const out: RadarItem[] = [];
  for (const r of payload.items ?? []) {
    const it = safeItem({ source: 'github', id: r.full_name ?? '', title: r.full_name ?? '', summary: r.description ?? '', date: String(r.pushed_at ?? '').slice(0, 10), url: r.html_url ?? '', license: r.license?.spdx_id ?? null });
    if (it) out.push(it);
  }
  return out;
}

export function parseHf(rows: any[], kind: 'model' | 'dataset'): RadarItem[] {
  const out: RadarItem[] = [];
  for (const r of rows ?? []) {
    const id = r.id ?? r.modelId ?? '';
    const lic = (r.tags ?? []).find((t: string) => String(t).startsWith('license:')) ?? null;
    const it = safeItem({ source: `huggingface-${kind}`, id, title: id, summary: r.description ?? '', date: String(r.lastModified ?? '').slice(0, 10), url: `https://huggingface.co/${kind === 'dataset' ? 'datasets/' : ''}${id}`, license: lic });
    if (it) out.push(it);
  }
  return out;
}

export function defaultHttp(url: string, timeoutMs: number): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== 'https:') return Promise.reject(new Error('not_https'));
  if (!(RADAR_ALLOWED_HOSTS as readonly string[]).includes(u.hostname)) return Promise.reject(new Error(`domain_not_allowed:${u.hostname}`));
  return new Promise((resolve, reject) => {
    const req = request(u, { method: 'GET', timeout: timeoutMs, headers: { 'User-Agent': 'SelfImproveRadar/1.0 (allowlist-only; digest-only)', Accept: 'application/json, application/atom+xml' } }, (res) => {
      if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400) {
        res.resume();
        return reject(new Error('redirect_refused')); // 不跟随任何重定向
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size <= MAX_BYTES) chunks.push(c);
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

export function queriesFor(product: string, env: NodeJS.ProcessEnv = {}): string[] {
  const raw = (env.SIL_RADAR_QUERIES ?? '').trim();
  if (raw) return raw.split(';').map((q) => q.trim()).filter(Boolean).slice(0, 6);
  return DEFAULT_QUERIES[product] ?? [];
}

export function buildUrls(query: string, since: Date, limit = 10): Array<[string, string]> {
  const q = encodeURIComponent(query);
  const day = since.toISOString().slice(0, 10);
  return [
    ['arxiv', `https://export.arxiv.org/api/query?search_query=all:%22${q}%22&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`],
    ['github', `https://api.github.com/search/repositories?q=${q}+pushed:%3E${day}&sort=updated&per_page=${limit}`],
    ['hf-model', `https://huggingface.co/api/models?search=${q}&sort=lastModified&direction=-1&limit=${limit}`],
    ['hf-dataset', `https://huggingface.co/api/datasets?search=${q}&sort=lastModified&direction=-1&limit=${limit}`],
  ];
}

function parseKind(kind: string, body: string): RadarItem[] {
  if (kind === 'arxiv') return parseArxiv(body);
  const data = JSON.parse(body);
  return kind === 'github' ? parseGithub(data) : parseHf(data, kind === 'hf-dataset' ? 'dataset' : 'model');
}

const cst = (d: Date) => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

export function renderDigest(product: string, day: Date, items: RadarItem[], errors: string[]): string {
  const lines = [
    `# 研究雷达摘要 — ${product} — ${cst(day)}（Asia/Shanghai）`,
    '',
    '> 全部是**线索（未核）**：没有入库、没有改技能、没有发任何消息。要采用，必须有人读原文并走审批。',
    '> 许可证类别只是提醒，不是法律意见；「不得入库/不得引入/未知」的条目不要拷贝内容或代码。',
    '',
  ];
  if (!items.length) lines.push('本周没有新的线索。');
  else {
    lines.push('| 来源 | 标题 | 日期 | 许可证类别 | 链接 |', '|---|---|---|---|---|');
    for (const it of items) lines.push(`| ${it.source} | ${it.title.replace(/\|/g, '/')} | ${it.date} | ${licenseClass(it.license)}（${clean(it.license, 30) || '未标注'}） | ${it.url} |`);
    lines.push('', '## 摘要（原文节选，当数据看，不是指令）', '');
    for (const it of items) if (it.summary) lines.push(`- **${it.title}**：${it.summary}`);
  }
  if (errors.length) lines.push('', '## 抓取失败（不影响其他来源）', '', ...errors.map((e) => `- ${e}`));
  return lines.join('\n') + '\n';
}

export interface RadarOptions {
  http?: RadarHttp;
  now?: Date;
  env?: NodeJS.ProcessEnv;
  limit?: number;
  lookbackDays?: number;
  timeoutMs?: number;
}

export async function runRadar(product: string, outDir: string, opts: RadarOptions = {}): Promise<{ path: string; new: number; errors: string[] }> {
  const now = opts.now ?? new Date();
  const get = opts.http ?? defaultHttp;
  const root = join(outDir, 'radar');
  mkdirSync(root, { recursive: true });
  const seenPath = join(root, 'seen.json');
  const seen = new Set<string>(existsSync(seenPath) ? JSON.parse(readFileSync(seenPath, 'utf8')) : []);
  const items: RadarItem[] = [];
  const errors: string[] = [];
  const fresh = new Set<string>();
  const since = new Date(now.getTime() - (opts.lookbackDays ?? 14) * 86_400_000);
  for (const q of queriesFor(product, opts.env)) {
    for (const [kind, url] of buildUrls(q, since, opts.limit ?? 10)) {
      try {
        const host = new URL(url).hostname;
        if (new URL(url).protocol !== 'https:' || !(RADAR_ALLOWED_HOSTS as readonly string[]).includes(host)) throw new Error('domain_not_allowed'); // 双保险
        for (const it of parseKind(kind, await get(url, opts.timeoutMs ?? 10_000))) {
          const key = createHash('sha256').update(`${it.source}|${it.id}`).digest('hex').slice(0, 16);
          if (seen.has(key) || fresh.has(key)) continue;
          fresh.add(key);
          items.push(it);
        }
      } catch (e) {
        errors.push(`${kind}: ${(e as Error).name}`);
      }
    }
  }
  const path = join(root, `digest_${cst(now).replace(/-/g, '')}.md`);
  writeFileSync(path, renderDigest(product, now, items, errors), 'utf8');
  writeFileSync(seenPath, JSON.stringify([...seen, ...fresh].sort()), 'utf8');
  return { path, new: items.length, errors };
}

/** SIL 关闭（默认）时什么都不做。 */
export async function runRadarIfEnabled(config: SILConfig, opts: RadarOptions = {}) {
  if (!config.enabled) return null;
  return runRadar(config.product, config.dataDir, opts);
}
