/**
 * 周知识候选钩子（分发侠 / ContentFlow）。
 *
 * 节奏写在 HARVEST_CADENCE：每周日 03:00（Asia/Shanghai）。
 * 不注册新的定时任务，也不读取新的云端密钥。人用 cli `harvest` 跑。
 * 只写调用方给出的 candidates 目录（分栏 JSON + 可读差异报告）。
 * 不改生产规则库、暂存包、增长注册表、RAG 缓存或 skills，也不调用 promote。
 *
 * publishCandidates：reviewer_signature 为空则拒绝。
 * 签名不是复核人姓名。即使签名非空，也不把候选复制进线上库；
 * 具名人工复核人仍为空。
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

export const HARVEST_CADENCE = 'weekly:SUN@03:00';
export const HARVEST_TIMEZONE = 'Asia/Shanghai';
export const WEEKLY_CATALOG_PATH = join(__dirname, 'data', 'weekly-sources.json');

export const CANDIDATE_FIELDS = [
  'url',
  'doi',
  'publisher',
  'excerpt',
  'published_at',
  'retrieved_at',
  'effective_at',
  'expires_at',
  'region',
  'content_hash',
  'license',
] as const;

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SECTION_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SKIP_JSON = new Set(['diff-report.json', 'manifest.json', 'publish-receipt.json']);

export interface WeeklySection {
  id: string;
  title: string;
  language: 'zh' | 'en' | string;
  note?: string;
}

export interface WeeklySource {
  id: string;
  section: string;
  product?: string;
  title?: string;
  url?: string;
  doi?: string;
  publisher?: string;
  excerpt?: string;
  published_at?: string;
  effective_at?: string;
  expires_at?: string;
  region?: string;
  license?: string;
  language?: string;
  fetch_error?: string;
}

export interface WeeklyCatalog {
  product?: string;
  cadence?: string;
  timezone?: string;
  note?: string;
  blocked_urls?: string[];
  sections?: WeeklySection[];
  sources: WeeklySource[];
}

export interface CandidateRecord {
  id: string;
  section: string;
  product: string;
  title: string;
  url: string;
  doi: string;
  publisher: string;
  excerpt: string;
  published_at: string;
  retrieved_at: string;
  effective_at: string;
  expires_at: string;
  region: string;
  content_hash: string;
  license: string;
  language: string;
  reviewer: '';
  named_reviewer: null;
  review_status: '待审核';
  state: 'unpublished';
  fetch_status: 'not_fetched' | 'fetched' | 'fetch_failed';
  fetch_error?: string;
}

export interface SkippedSource {
  id?: string;
  url: string;
  status: 'blocked_unverified_url' | 'unconfirmed_url';
}

export interface HarvestReport {
  generated_at: string;
  cadence: string;
  state: 'unpublished';
  reviewer: '';
  named_reviewer: null;
  review_status: '待审核';
  added: string[];
  changed: string[];
  unchanged: string[];
  removed: string[];
  skipped: SkippedSource[];
  sections: Record<string, string[]>;
  production_written: false;
  auto_promoted: false;
  note: string;
}

export interface PublishReceipt {
  state: 'queued_unpublished';
  production_written: false;
  auto_promoted: false;
  signature_accepted: true;
  reviewer_on_candidates: '';
  named_reviewer: null;
  review_status: '待审核';
  note: string;
}

export type HarvestFetcher = (url: string) => Uint8Array | string;

const DEFAULT_PRODUCTION_FILES = [
  join(__dirname, 'data', 'rule-library.json'),
  join(__dirname, 'data', 'staged-rules-20261101c.json'),
  join(__dirname, 'data', 'staged-rules-20261106.json'),
  join(__dirname, 'data', 'sources.json'),
  join(__dirname, '..', 'ai', 'growth-rag', 'sources.registry.json'),
  join(__dirname, '..', '..', '..', 'data', 'rag_cache', 'cac-ai-content-labeling-2025.json'),
  join(__dirname, '..', '..', '..', 'data', 'rag_cache', 'gb-45438-2025.json'),
  join(__dirname, '..', '..', '..', 'data', 'rag_cache', 'order-23-multi-channel-2026.json'),
  join(__dirname, '..', '..', '..', 'data', 'rag_cache', 'samr-internet-ad-article-9.json'),
  join(__dirname, '..', '..', '..', 'data', 'rag_cache', 'bilibili-ai-abuse-2025.json'),
  join(__dirname, '..', '..', '..', 'data', 'rag_cache', 'bilibili-creator-label-2023.json'),
  join(__dirname, '..', '..', '..', '..', 'web-cn', 'src', 'data', 'rule-library.json'),
  join(__dirname, '..', '..', '..', '..', '..', 'skills', 'README.md'),
];

function productionRoots(): string[] {
  return [
    join(__dirname),
    join(__dirname, '..', 'ai', 'growth-rag'),
    join(__dirname, '..', '..', '..', 'data', 'rag_cache'),
    join(__dirname, '..', '..', '..', 'data', 'library'),
    join(__dirname, '..', '..', '..', '..', 'web-cn', 'src', 'data'),
    join(__dirname, '..', '..', '..', '..', '..', 'skills'),
  ].map((p) => resolve(p));
}

export function defaultProductionPaths(): string[] {
  return DEFAULT_PRODUCTION_FILES.filter((p) => existsSync(p)).map((p) => resolve(p));
}

export function sha256(data: Uint8Array | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return createHash('sha256').update(buf).digest('hex');
}

export function dayStamp(today?: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: HARVEST_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(today ?? new Date());
}

function isInside(child: string, parent: string): boolean {
  const c = resolve(child);
  const p = resolve(parent);
  if (c === p) return true;
  const prefix = p.endsWith(sep) ? p : p + sep;
  return c.startsWith(prefix);
}

/** Candidates may not be written into the production registry, staged bundles, RAG cache, or skills. */
export function refuseProductionDir(target: string): string {
  const root = resolve(target);
  for (const banned of productionRoots()) {
    if (!existsSync(banned)) continue;
    if (isInside(root, banned)) {
      throw new Error(`refusing to write candidates into production registry or skills: ${root}`);
    }
  }
  return root;
}

function snapshotBytes(paths: string[]): Map<string, Buffer | null> {
  const out = new Map<string, Buffer | null>();
  for (const path of paths) {
    const key = existsSync(path) ? resolve(path) : path;
    out.set(key, existsSync(path) ? readFileSync(path) : null);
  }
  return out;
}

function assertUnchanged(before: Map<string, Buffer | null>): void {
  for (const [key, content] of before) {
    const current = existsSync(key) ? readFileSync(key) : null;
    if (content === null && current === null) continue;
    if (content === null || current === null || !current.equals(content)) {
      throw new Error(`production path changed during candidate harvest: ${key}`);
    }
  }
}

export function loadWeeklyCatalog(path?: string): WeeklyCatalog {
  const catalogPath = path ?? WEEKLY_CATALOG_PATH;
  return JSON.parse(readFileSync(catalogPath, 'utf8')) as WeeklyCatalog;
}

function watchedPaths(extra?: string[]): string[] {
  return [...(extra ?? []), ...defaultProductionPaths()];
}

function walkJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkJson(path));
    else if (name.isFile() && name.name.endsWith('.json')) out.push(path);
  }
  return out;
}

function renderReport(report: HarvestReport, written: CandidateRecord[], sections: WeeklySection[]): string {
  const bySection = new Map<string, CandidateRecord[]>();
  for (const row of written) {
    const list = bySection.get(row.section) ?? [];
    list.push(row);
    bySection.set(row.section, list);
  }
  const lines: string[] = [
    '# 分发侠周知识候选差异',
    '',
    `- 日期：${report.generated_at}`,
    '- 节奏：每周日 03:00（Asia/Shanghai）。由人执行命令，不新增云端定时任务，也不需要新的密钥。',
    '- 状态：未发布',
    '- 复核人：（空）',
    '- 审核状态：待审核',
    '',
    '这些记录只在候选目录里。生产规则库、暂存包、增长注册表、RAG 缓存和 skills 没有被改写，暂存包也没有被提升到用户能看到的文档。',
    '',
  ];
  for (const section of sections) {
    const rows = bySection.get(section.id) ?? [];
    const en = section.language === 'en';
    lines.push(`## ${section.title}`, '');
    if (section.note) lines.push(section.note, '');
    if (!rows.length) {
      lines.push(en ? 'No candidates in this section.' : '本栏没有候选。', '');
      continue;
    }
    for (const row of rows) {
      const added = report.added.includes(row.id);
      const changed = report.changed.includes(row.id);
      if (en) {
        const verb = added ? 'Added' : changed ? 'Changed' : 'Unchanged';
        lines.push(`- ${verb} \`${row.id}\` ${row.title} — ${row.publisher}`);
        lines.push(`  ${row.url}`);
      } else {
        const verb = added ? '新增' : changed ? '有变化' : '未变化';
        lines.push(`- ${verb} \`${row.id}\` ${row.title}（${row.publisher}）`);
        lines.push(`  ${row.url}`);
      }
    }
    lines.push('');
  }
  const skipped = report.skipped.map((s) => `${s.id ?? '（无编号）'}（${s.status}）`).join('、');
  lines.push(
    '## 差异',
    '',
    `- 新增：${report.added.join('、') || '无'}`,
    `- 有变化：${report.changed.join('、') || '无'}`,
    `- 未变化：${report.unchanged.join('、') || '无'}`,
    `- 本次不再列出：${report.removed.join('、') || '无'}`,
    `- 未写入：${skipped || '无'}`,
    '',
    '发布候选时，复核人签名留空会被拒绝。签名本身不是复核人姓名；在具名人工复核人写入之前，不会把候选复制进线上库。',
    '',
  );
  return lines.join('\n');
}

export function harvestWeekly(opts: {
  candidatesDir: string;
  today?: Date;
  fetcher?: HarvestFetcher;
  catalogPath?: string;
  productionPaths?: string[];
}): HarvestReport {
  const today = dayStamp(opts.today);
  const root = refuseProductionDir(opts.candidatesDir);
  const catalog = loadWeeklyCatalog(opts.catalogPath);
  const blocked = new Set((catalog.blocked_urls ?? []).map((u) => u.replace(/\/+$/, '')));
  const before = snapshotBytes(watchedPaths(opts.productionPaths));
  const manifestPath = join(root, 'manifest.json');
  const previous = new Map<string, string>();
  if (existsSync(manifestPath)) {
    const prior = JSON.parse(readFileSync(manifestPath, 'utf8')) as { candidates?: { id: string; content_hash: string }[] };
    for (const row of prior.candidates ?? []) previous.set(row.id, row.content_hash);
  }

  const written: CandidateRecord[] = [];
  const skipped: SkippedSource[] = [];
  mkdirSync(root, { recursive: true });
  for (const source of catalog.sources ?? []) {
    const url = String(source.url ?? '').trim();
    const bare = url.replace(/\/+$/, '');
    if (!url || !url.startsWith('https://') || blocked.has(url) || blocked.has(bare)) {
      skipped.push({ id: source.id, url, status: url && (blocked.has(url) || blocked.has(bare)) ? 'blocked_unverified_url' : 'unconfirmed_url' });
      continue;
    }
    if (!ID_RE.test(source.id)) throw new Error('unsafe source id');
    if (!SECTION_RE.test(source.section)) throw new Error('unsafe section id');
    let body: Uint8Array | null = null;
    let fetchStatus: CandidateRecord['fetch_status'] = 'not_fetched';
    let fetchError: string | undefined;
    if (opts.fetcher) {
      try {
        const fetched = opts.fetcher(url);
        body = typeof fetched === 'string' ? Buffer.from(fetched, 'utf8') : Buffer.from(fetched);
        fetchStatus = 'fetched';
      } catch (exc) {
        fetchStatus = 'fetch_failed';
        fetchError = String((exc as Error)?.message ?? exc).slice(0, 300);
      }
    }
    const raw = body ?? Buffer.from(String(source.excerpt ?? ''), 'utf8');
    const record: CandidateRecord = {
      id: source.id,
      section: source.section,
      product: source.product || catalog.product || 'contentflow',
      title: source.title || source.id,
      url,
      doi: source.doi ?? '',
      publisher: source.publisher ?? '',
      excerpt: source.excerpt ?? '',
      published_at: source.published_at ?? '',
      retrieved_at: today,
      effective_at: source.effective_at ?? '',
      expires_at: source.expires_at ?? '',
      region: source.region ?? '',
      content_hash: sha256(raw),
      license: source.license ?? '',
      language: source.language ?? '',
      reviewer: '',
      named_reviewer: null,
      review_status: '待审核',
      state: 'unpublished',
      fetch_status: fetchStatus,
    };
    if (fetchError) record.fetch_error = fetchError;
    for (const field of CANDIDATE_FIELDS) {
      if (!(field in record)) throw new Error(`candidate missing ${field}`);
    }
    const dir = join(root, record.section);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${record.id}.json`);
    if (!isInside(file, root) || relative(root, file).startsWith('..')) throw new Error('unsafe candidate path');
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    written.push(record);
  }

  const ids = new Set(written.map((row) => row.id));
  const added = written.filter((row) => !previous.has(row.id)).map((row) => row.id);
  const changed = written.filter((row) => previous.has(row.id) && previous.get(row.id) !== row.content_hash).map((row) => row.id);
  const unchanged = written.filter((row) => previous.has(row.id) && previous.get(row.id) === row.content_hash).map((row) => row.id);
  const removed = [...previous.keys()].filter((id) => !ids.has(id));
  const sections: Record<string, string[]> = {};
  for (const row of written) {
    sections[row.section] ??= [];
    sections[row.section].push(row.id);
  }
  const report: HarvestReport = {
    generated_at: today,
    cadence: catalog.cadence || HARVEST_CADENCE,
    state: 'unpublished',
    reviewer: '',
    named_reviewer: null,
    review_status: '待审核',
    added,
    changed,
    unchanged,
    removed,
    skipped,
    sections,
    production_written: false,
    auto_promoted: false,
    note: '候选未发布，未写入生产规则库、暂存包、增长注册表、RAG 缓存或 skills。复核人留空。未自动提升暂存包。',
  };
  writeFileSync(join(root, 'diff-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(join(root, 'diff-report.md'), renderReport(report, written, catalog.sections ?? []), 'utf8');
  const manifest = {
    generated_at: today,
    cadence: report.cadence,
    state: 'unpublished',
    candidates: written.map((row) => ({ id: row.id, section: row.section, content_hash: row.content_hash })),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  assertUnchanged(before);
  return report;
}

export function publishCandidates(
  reviewerSignature: string,
  opts: { candidatesDir: string; productionPaths?: string[] },
): PublishReceipt {
  if (reviewerSignature == null || !String(reviewerSignature).trim()) {
    throw new Error('refusing publish: reviewer_signature is empty');
  }
  const root = refuseProductionDir(opts.candidatesDir);
  const before = snapshotBytes(watchedPaths(opts.productionPaths));
  mkdirSync(root, { recursive: true });
  const receipt: PublishReceipt = {
    state: 'queued_unpublished',
    production_written: false,
    auto_promoted: false,
    signature_accepted: true,
    reviewer_on_candidates: '',
    named_reviewer: null,
    review_status: '待审核',
    note: '签名只放行队列记录，不覆盖生产规则库、增长注册表、RAG 缓存或 skills，也不填写复核人姓名。在具名人工复核人写入之前，不会把候选复制进线上库。',
  };
  writeFileSync(join(root, 'publish-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  for (const path of walkJson(root)) {
    if (SKIP_JSON.has(path.slice(path.lastIndexOf(sep) + 1))) continue;
    const row = JSON.parse(readFileSync(path, 'utf8')) as CandidateRecord;
    const named = row.named_reviewer == null ? '' : String(row.named_reviewer);
    if (String(row.reviewer ?? '').trim() || named.trim() || row.review_status !== '待审核' || row.state !== 'unpublished') {
      assertUnchanged(before);
      throw new Error('publish must leave candidates unpublished and reviewer empty');
    }
  }
  assertUnchanged(before);
  return receipt;
}
