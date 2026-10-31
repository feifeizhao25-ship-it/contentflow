/**
 * 持续改进（分发侠 / TypeScript 版，与 Python 三个产品里的 golden / stale / radar_stage / monthly_report 同一套口径）。
 *
 * 四件事，全部默认关闭（SIL_ENABLED=0 时 runContinuousIfEnabled 什么都不做）：
 *  1 金标准问答（golden）：每个技能 / 规则 / 知识条目都有带出处的题，离线确定性打分，只产出报告和待办，不是发布闸；
 *  2 过期检测（stale）：到期、临近到期、待审核太久、没有出处、出处太旧；
 *  3 雷达线索 → 待审核入库候选（radar-stage）：只收线索，不自动通过，不对外可见，注入 / 许可证不明的直接丢；
 *  4 月度改进报告（md + json）：变更、金标准分数、过期项、待人工审核的候选。PDF 只有 Python 产品有（reportlab），这里不假装有。
 * 所有新内容 review_status=待审核；没有 reviewer 的不得标已审核；本文件不引用审批、企业微信或任何发送函数。
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { checkFalsePersona } from '../../ai/compliance/rules/false-persona';
import { detectLabelTamperingRequest } from '../../ai/compliance/rules/aigc-label';
import { renderSkillDraft } from '../skills/render';
import { TRAFFIC_SKILLS } from '../skills/catalog';
import { SILConfig } from './config';
import { licenseClass, RadarItem } from './radar';
import { scanInjection } from './sources';
import { CandidateStore, Ledger } from './store';

export const CONTINUOUS_CRON = {
  stale_scan: '30 2 * * *', // 每天 02:30
  golden_eval: '30 3 * * 0',
  radar_stage: '0 6 * * 3',
  monthly_report: '0 5 1 * *',
} as const;
export const CONTINUOUS_SLOTS = { stale_scan: 'daily@02:30', golden_eval: 'weekly:SUN@03:30', radar_stage: 'weekly:WED@06:00', monthly_report: 'monthly:1@05:00' } as const;

export type GoldenChannel = 'skill' | 'rule' | 'library';
export interface GoldenSource {
  title: string;
  issuer: string;
  url: string;
  retrieved_at: string;
}
export interface GoldenCase {
  id: string;
  skill: string;
  area: 'rag' | 'skill' | 'refusal' | 'freshness' | 'calc';
  channel: GoldenChannel;
  lang: string;
  question: string;
  expect: 'answer' | 'refuse';
  input?: Record<string, unknown>;
  rule?: string;
  entry_ids?: string[];
  must_include?: (string | string[])[];
  must_not_include?: string[];
  sources?: GoldenSource[];
  valid_until?: string;
  review_status?: string;
  reviewer?: string;
  added_at?: string;
}
export interface GoldenAnswer {
  text: string;
  refused?: boolean;
}

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const REFUSAL_ZH = ['不能', '无法', '不提供', '不做', '不会', '不应', '抱歉', '不予'];
const DAY = 86_400_000;
const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const isoDay = (s?: string): number | null => {
  const t = s ? Date.parse(String(s).slice(0, 10)) : NaN;
  return Number.isNaN(t) ? null : t;
};
const stamp = (d: Date) => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- golden
export function loadGolden(path: string): GoldenCase[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l, i) => {
      try {
        return JSON.parse(l) as GoldenCase;
      } catch {
        throw new Error(`${path}:${i + 1}: bad json`);
      }
    });
}

export function validateCase(c: GoldenCase): string[] {
  const p: string[] = [];
  for (const k of ['id', 'skill', 'area', 'channel', 'lang', 'question', 'expect'] as const) if (!c[k]) p.push(`missing:${k}`);
  if (p.length) return p;
  if (!['answer', 'refuse'].includes(c.expect)) p.push(`bad_expect:${c.expect}`);
  if (c.lang !== 'zh') p.push(`lang_mismatch:${c.lang}!=zh`); // 国内版全中文
  if (!CJK.test(c.question)) p.push('no_cjk_in_chinese_question');
  if (c.expect === 'answer') {
    if (!c.must_include?.length) p.push('answer_case_without_must_include');
    if (!c.sources?.length) p.push('answer_case_without_sources');
    for (const s of c.sources ?? []) {
      let u: URL | null = null;
      try {
        u = new URL(s.url);
      } catch {
        /* ignore */
      }
      if (!u || !(u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname.endsWith('.gov.cn')))) p.push('source_url_not_https');
      for (const k of ['title', 'issuer', 'retrieved_at'] as const) if (!s[k]) p.push(`source_missing:${k}`);
      if (s.retrieved_at && isoDay(s.retrieved_at) === null) p.push('source_bad_date');
    }
  }
  if (['已审核', 'reviewed'].includes(c.review_status ?? '') && !c.reviewer) p.push('reviewed_without_reviewer');
  if (c.valid_until && isoDay(c.valid_until) === null) p.push('bad_valid_until');
  return p;
}

export function validateAll(cases: GoldenCase[]) {
  const seen = new Set<string>();
  const dup: string[] = [];
  const invalid: Record<string, string[]> = {};
  for (const c of cases) {
    if (seen.has(c.id)) dup.push(c.id);
    seen.add(c.id);
    const pr = validateCase(c);
    if (pr.length) invalid[c.id ?? '?'] = pr;
  }
  return { n: cases.length, invalid, duplicate_ids: dup, ok: !Object.keys(invalid).length && !dup.length };
}

/** 覆盖：每个技能至少 minCases 题。 */
export function coverage(cases: GoldenCase[], skillIds: string[], minCases = 2) {
  const cnt: Record<string, number> = {};
  for (const c of cases) cnt[c.skill] = (cnt[c.skill] ?? 0) + 1;
  return {
    counts: Object.fromEntries(skillIds.map((s) => [s, cnt[s] ?? 0])),
    missing: skillIds.filter((s) => !cnt[s]),
    thin: skillIds.filter((s) => cnt[s] > 0 && cnt[s] < minCases),
    unknown_skill_cases: Object.keys(cnt).filter((s) => !skillIds.includes(s)).sort(),
  };
}

export function scoreCase(c: GoldenCase, a: GoldenAnswer): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const refused = !!a.refused || REFUSAL_ZH.some((m) => a.text.includes(m));
  if (c.expect === 'refuse') {
    if (!refused) reasons.push('should_refuse');
  } else {
    if (a.refused) reasons.push('refused_but_should_answer');
    const t = norm(a.text);
    for (const need of c.must_include ?? []) {
      const alts = typeof need === 'string' ? [need] : need;
      if (!alts.some((x) => t.includes(norm(x)))) reasons.push(`missing:${alts.join('|').slice(0, 40)}`);
    }
  }
  const nt = norm(a.text);
  for (const bad of c.must_not_include ?? []) if (nt.includes(norm(bad))) reasons.push(`forbidden:${bad.slice(0, 40)}`);
  return { ok: reasons.length === 0, reasons };
}

export interface StagedEntry {
  id: string;
  title: string;
  text: string;
  source_tier: string;
  license: string;
  valid_from: string;
  valid_until: string;
  origin: string;
  url: string;
  status?: string;
  lang: string;
  review_status: string;
  visible: boolean;
  auto_approved: boolean;
  content_hash: string;
  note?: string;
}

export function loadStaged(path: string): StagedEntry[] {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')).entries as StagedEntry[]) : [];
}

/** 默认“答案”：技能草稿 / 规则预检 / 待审核条目文本。测的是覆盖和边界，不是措辞。 */
export function defaultAnswer(c: GoldenCase, staged: StagedEntry[] = []): GoldenAnswer {
  if (c.channel === 'skill') {
    const d = renderSkillDraft(c.skill, c.input ?? { text: c.question });
    return { text: d.body, refused: d.refused };
  }
  if (c.channel === 'library') {
    const hit = staged.filter((e) => (c.entry_ids ?? []).includes(e.id));
    return { text: hit.map((e) => `${e.title}\n${e.text}`).join('\n'), refused: !hit.length };
  }
  const text = String(c.input?.text ?? c.question);
  if (c.rule === 'aigc-label') {
    return detectLabelTamperingRequest(text) ? { text: '不能协助删除、篡改或隐匿 AI 生成合成内容标识（办法第十条）。', refused: true } : { text: '未命中标识篡改请求' };
  }
  const r = checkFalsePersona(text);
  if (c.rule === 'false-persona-labels') return { text: r.labelDoesNotExempt && !r.ok ? '标注“虚构演绎”或“AI 生成”不能规避，不免除；仍命中虚假人设规则。' : '未命中' };
  return r.ok ? { text: '未命中虚假人设规则（关键词级预检，仍需人工看）。' } : { text: `不能协助：命中 ${r.issues.map((i) => i.code).join('、')}`, refused: true };
}

export interface GoldenReport {
  ran_at: string;
  total: number;
  passed: number;
  rate: number;
  failed: { id: string; skill: string; reasons: string[] }[];
  regressions: string[];
  skipped_expired: string[];
  by_skill: Record<string, { n: number; ok: number }>;
  coverage: ReturnType<typeof coverage>;
  validation: ReturnType<typeof validateAll>;
  results: Record<string, boolean>;
}

export function runGolden(cases: GoldenCase[], answer: (c: GoldenCase) => GoldenAnswer, opts: { now?: Date; prev?: Record<string, boolean>; skillIds?: string[] } = {}): GoldenReport {
  const now = opts.now ?? new Date();
  const validation = validateAll(cases);
  const results: Record<string, boolean> = {};
  const failed: GoldenReport['failed'] = [];
  const skipped: string[] = [];
  const bySkill: GoldenReport['by_skill'] = {};
  for (const c of cases) {
    if (validation.invalid[c.id]) continue; // 校验不合格的题不运行
    const until = isoDay(c.valid_until);
    if (until !== null && until < isoDay(stamp(now))!) {
      skipped.push(c.id); // 过期的题不当通过也不当失败，交给 stale 报告
      continue;
    }
    let sc: { ok: boolean; reasons: string[] };
    try {
      sc = scoreCase(c, answer(c));
    } catch (e) {
      sc = { ok: false, reasons: [`error:${(e as Error).name}`] };
    }
    results[c.id] = sc.ok;
    bySkill[c.skill] ??= { n: 0, ok: 0 };
    bySkill[c.skill].n++;
    if (sc.ok) bySkill[c.skill].ok++;
    else failed.push({ id: c.id, skill: c.skill, reasons: sc.reasons });
  }
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  const regressions = Object.keys(results).filter((id) => opts.prev?.[id] === true && !results[id]);
  return {
    ran_at: stamp(now),
    total,
    passed,
    rate: total ? Math.round((passed / total) * 1000) / 1000 : 0,
    failed,
    regressions,
    skipped_expired: skipped,
    by_skill: bySkill,
    coverage: coverage(cases, opts.skillIds ?? [...new Set(cases.map((c) => c.skill))]),
    validation,
    results,
  };
}

// ---------------------------------------------------------------- stale
export type StaleKind = 'expired' | 'expiring_soon' | 'review_overdue' | 'no_source' | 'golden_source_old';
export interface StaleItem {
  kind: StaleKind;
  id: string;
  reason: string;
}
const REASON: Record<StaleKind, string> = {
  expired: '已过有效期，需要人工复核后续期或下线',
  expiring_soon: '临近有效期，请提前安排复核',
  review_overdue: '待审核超过 30 天，仍无人审核',
  no_source: '没有出处，不得作为依据',
  golden_source_old: '金标准题的出处读取日期已超过 365 天，需要重新核对原文',
};
export interface StaleOptions {
  now?: Date;
  expiringDays?: number;
  reviewDays?: number;
  sourceDays?: number;
}

export function staleScan(cases: GoldenCase[], staged: StagedEntry[], opts: StaleOptions = {}): StaleItem[] {
  const today = isoDay(stamp(opts.now ?? new Date()))!;
  const soon = (opts.expiringDays ?? 45) * DAY;
  const out: StaleItem[] = [];
  const push = (kind: StaleKind, id: string) => out.push({ kind, id, reason: REASON[kind] });
  const dated = (id: string, until?: string, review?: string, added?: string) => {
    const u = isoDay(until);
    if (u !== null && u < today) push('expired', id);
    else if (u !== null && u - today <= soon) push('expiring_soon', id);
    const a = isoDay(added);
    if ((review ?? '待审核') === '待审核' && a !== null && today - a > (opts.reviewDays ?? 30) * DAY) push('review_overdue', id);
  };
  for (const c of cases) {
    dated(c.id, c.valid_until, c.review_status, c.added_at);
    if (c.expect === 'answer') {
      if (!c.sources?.length) push('no_source', c.id);
      else if (c.sources.some((s) => { const r = isoDay(s.retrieved_at); return r !== null && today - r > (opts.sourceDays ?? 365) * DAY; })) push('golden_source_old', c.id);
    }
  }
  for (const e of staged) {
    dated(e.id, e.valid_until, e.review_status, e.valid_from);
    if (!e.url) push('no_source', e.id);
  }
  return out;
}

// ---------------------------------------------------------------- radar → staged leads
export interface StagedLead {
  id: string;
  title: string;
  url: string;
  source: string;
  date: string;
  license_class: string;
  status: '待审核';
  lead_only: true;
  visible: false;
  auto_approved: false;
  staged_at: string;
}

/** 读最新 radar/items_*.json，转成“线索”。线索不是知识条目：没有正文、不可见、不自动通过；注入和许可证不明的直接丢。 */
export function stageRadar(dataDir: string, now = new Date()): { path: string | null; staged: number; dropped: Record<string, number> } {
  const dir = join(dataDir, 'radar');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^items_\d{8}\.json$/.test(f)).sort() : [];
  const dropped: Record<string, number> = { injection: 0, license: 0, duplicate: 0 };
  if (!files.length) return { path: null, staged: 0, dropped };
  const outDir = join(dataDir, 'staged');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, 'radar_leads.json');
  const have: StagedLead[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const ids = new Set(have.map((l) => l.id));
  const items: RadarItem[] = JSON.parse(readFileSync(join(dir, files[files.length - 1]), 'utf8'));
  for (const it of items) {
    if (scanInjection(`${it.title} ${it.summary}`).length) {
      dropped.injection++;
      continue;
    }
    const lc = licenseClass(it.license);
    if (lc === 'do_not_ingest' || lc === 'unknown_do_not_introduce') {
      dropped.license++;
      continue;
    }
    const id = `lead-${createHash('sha256').update(`${it.source}|${it.id}`).digest('hex').slice(0, 12)}`;
    if (ids.has(id)) {
      dropped.duplicate++;
      continue;
    }
    ids.add(id);
    have.push({ id, title: String(it.title).slice(0, 200), url: it.url, source: it.source, date: it.date, license_class: lc, status: '待审核', lead_only: true, visible: false, auto_approved: false, staged_at: stamp(now) });
  }
  writeFileSync(file, JSON.stringify(have, null, 2), 'utf8');
  return { path: file, staged: have.length, dropped };
}

// ---------------------------------------------------------------- monthly report
export interface MonthlyInputs {
  month: string;
  golden: GoldenReport | null;
  prevGolden: { rate: number; ran_at: string } | null;
  stale: StaleItem[];
  changes: { t: string; id: string; to: string; target?: string }[];
  pending: { id: string; kind: string; summary: string }[];
  leads: StagedLead[];
  staged: StagedEntry[];
}

export function renderMonthlyMd(m: MonthlyInputs): string {
  const L: string[] = [`# 分发侠 持续改进月报 ${m.month}`, '', '> 所有新增内容均为“待审核”，没有任何专家签字；本报告不代表任何内容已被批准。', ''];
  L.push('## 1 本月变更（来自变更日志）', '');
  L.push(...(m.changes.length ? m.changes.map((c) => `- ${c.t} ${c.id} → ${c.to}${c.target ? `（${c.target}）` : ''}`) : ['- 本月没有变更']), '');
  L.push('## 2 金标准问答分数', '');
  if (!m.golden) L.push('- 本月没有运行记录');
  else {
    const g = m.golden;
    L.push(`- 通过 ${g.passed}/${g.total}（${(g.rate * 100).toFixed(1)}%）${m.prevGolden ? `；上次 ${(m.prevGolden.rate * 100).toFixed(1)}%（${m.prevGolden.ran_at}）` : ''}`);
    L.push(`- 退步题：${g.regressions.length ? g.regressions.join('、') : '无'}`);
    L.push(`- 覆盖缺口：${[...g.coverage.missing, ...g.coverage.thin].join('、') || '无'}`);
    for (const f of g.failed) L.push(`- 失败 ${f.id}（${f.skill}）：${f.reasons.join('、')}`);
  }
  L.push('', '## 3 过期 / 陈旧项', '');
  L.push(...(m.stale.length ? m.stale.map((s) => `- [${s.kind}] ${s.id}：${s.reason}`) : ['- 无']), '');
  L.push('## 4 等待人工审核', '');
  const waiting = [...m.pending.map((p) => `- 候选 ${p.id}（${p.kind}）：${p.summary}`), ...m.leads.map((l) => `- 雷达线索 ${l.id}：${l.title}（${l.url}；许可证类别 ${l.license_class}）`), ...m.staged.filter((e) => e.review_status === '待审核').map((e) => `- 待审核条目 ${e.id}：${e.title}`)];
  L.push(...(waiting.length ? waiting : ['- 无']), '');
  return L.join('\n');
}

// ---------------------------------------------------------------- orchestration
export const GOLDEN_FILE = join(__dirname, '../../../../data/eval/golden_contentflow_zh.jsonl');
export const STAGED_FILE = join(__dirname, '../../../../data/library/staged_entries_20261031b.json');

export type ContinuousJob = 'golden_eval' | 'stale_scan' | 'radar_stage' | 'monthly_report';

export function runContinuous(job: ContinuousJob, cfg: SILConfig, now = new Date(), paths: { golden?: string; staged?: string } = {}) {
  const cases = loadGolden(paths.golden ?? GOLDEN_FILE);
  const staged = loadStaged(paths.staged ?? STAGED_FILE);
  const out = join(cfg.dataDir, 'continuous');
  mkdirSync(out, { recursive: true });
  const ledger = new Ledger(join(cfg.dataDir, 'changelog.jsonl'));
  const lastPath = join(out, 'golden_last.json');
  const readLast = (): GoldenReport | null => (existsSync(lastPath) ? JSON.parse(readFileSync(lastPath, 'utf8')) : null);
  if (job === 'golden_eval') {
    const prev = readLast();
    const rep = runGolden(cases, (c) => defaultAnswer(c, staged), { now, prev: prev?.results, skillIds: [...TRAFFIC_SKILLS.map((s) => s.id), 'false-persona', 'aigc-label'] });
    if (prev) writeFileSync(join(out, 'golden_prev.json'), JSON.stringify({ rate: prev.rate, ran_at: prev.ran_at }), 'utf8');
    writeFileSync(join(out, `golden_${stamp(now).replace(/-/g, '')}.json`), JSON.stringify(rep, null, 2), 'utf8');
    writeFileSync(lastPath, JSON.stringify(rep, null, 2), 'utf8');
    ledger.append({ t: stamp(now), id: 'golden_eval', to: `rate=${rep.rate}`, target: `failed=${rep.failed.length} regressions=${rep.regressions.length}` });
    return rep;
  }
  if (job === 'stale_scan') {
    const items = staleScan(cases, staged, { now });
    writeFileSync(join(out, `stale_${stamp(now).replace(/-/g, '')}.json`), JSON.stringify(items, null, 2), 'utf8');
    return items;
  }
  if (job === 'radar_stage') return stageRadar(cfg.dataDir, now);
  // monthly_report
  const month = stamp(now).slice(0, 7);
  const lastGolden = readLast();
  const changes = new Ledger(join(cfg.dataDir, 'changelog.jsonl')).entries().map((r) => r.event).filter((e) => String(e.t ?? '').startsWith(month)).map((e) => ({ t: String(e.t), id: String(e.id), to: String(e.to), target: e.target ? String(e.target) : undefined }));
  const store = existsSync(join(cfg.dataDir, 'candidates')) ? new CandidateStore(cfg.dataDir) : null;
  const pending = (store ? store.list('pending_approval') : []).map((c) => ({ id: c.id, kind: c.kind, summary: c.summary }));
  const leadsFile = join(cfg.dataDir, 'staged', 'radar_leads.json');
  const leads: StagedLead[] = existsSync(leadsFile) ? JSON.parse(readFileSync(leadsFile, 'utf8')) : [];
  const input: MonthlyInputs = { month, golden: lastGolden, prevGolden: existsSync(join(out, 'golden_prev.json')) ? JSON.parse(readFileSync(join(out, 'golden_prev.json'), 'utf8')) : null, stale: staleScan(cases, staged, { now }), changes, pending, leads, staged };
  const base = join(out, `monthly_${month.replace('-', '')}`);
  writeFileSync(`${base}.md`, renderMonthlyMd(input), 'utf8');
  writeFileSync(`${base}.json`, JSON.stringify(input, null, 2), 'utf8');
  return { md: `${base}.md`, json: `${base}.json` };
}

/** SIL_ENABLED 未开（默认）时什么都不做。 */
export function runContinuousIfEnabled(job: ContinuousJob, cfg: SILConfig, now = new Date()) {
  if (!cfg.enabled) return null;
  return runContinuous(job, cfg, now);
}
