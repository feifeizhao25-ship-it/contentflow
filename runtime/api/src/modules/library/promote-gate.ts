/**
 * “变好才上线”闸门（分发侠规则库，TypeScript 版，与 Python 三个产品的 promote_gate 同一口径）。
 * 暂存区候选条目要变成用户可见的规则，必须先过四道检查（离线、确定性、不调用模型）：
 *  1 证据分 ≥ 0.85：来源等级（A 官方原文=1.0 / B 转载或摘要=0.8 / C=0.5 / D 社媒线索=0）与完整度取较小者；B 级要有 second_source 才算 0.9；
 *  2 安全分 ≥ 0.85：不得出现“保证过审 / 百分百合规 / 稳赚 / 治愈”等绝对化或误导性说法，且必须写明“边界”（caution）；
 *  3 对照评测 = keep：条目自带的 probes（口语问法）在“加入后”的检索里 Hit@3 ≥ 2/3（至少 2 个问法），已有条目的探针不退步；
 *  4 不重复：同 id / 同来源链接 / 同文号不能已在工作文档里。
 * 闸门只给结论，不改任何东西；上线（approve）仍必须有审核人姓名。默认不强制：LIBRARY_PROMOTE_GATE=1 时 cli approve 才要求 keep。
 * 参考：Skill-V（arXiv 2610.11781）的非退步回放、SkillSandbox（2610.10088）的 with/without 对照与 Keep/Reject、SkillForge（2610.09832）的试用→正式。
 */
import { BM25Index } from './bm25';
import { LibEntry } from './live/util';

export const THRESHOLD = 0.85;
export const HIT_K = { value: 3 }; // 测试里可以改成 1 来构造退步
const TIER: Record<string, number> = { A: 1.0, B: 0.8, C: 0.5, D: 0 };
const MIN_PROBES = 2;
const MIN_PROBE_RATE = 2 / 3;

export type Candidate = LibEntry & { probes?: string[]; second_source?: Record<string, unknown> };
export interface GateRow {
  id: string;
  title: string;
  decision: 'keep' | 'reject';
  evidence: number;
  safety: number;
  impact: { probes: number; hit_at_3: number; hit_rate: number; regression_checked: number; regressions: { entry: string; probe: string; before: number | null; after: number | null }[]; decision: 'keep' | 'reject'; why: string[] };
  duplicates: string[];
  reasons: string[];
  evaluated_at: string;
}

export const gateEnforced = (env: NodeJS.ProcessEnv = process.env): boolean => ['1', 'true', 'yes', 'on'].includes(String(env.LIBRARY_PROMOTE_GATE ?? '0').trim().toLowerCase());

const text = (e: LibEntry): string => [e.title, e.summary, ...((e.points as string[]) ?? []), String(e.plain_tip ?? ''), String(e.caution ?? '')].join('\n');
const idxText = (e: LibEntry) => ({ heading: `${e.title} ${(e.tags ?? []).join(' ')}`, content: [e.summary, ...((e.points as string[]) ?? []), String(e.plain_tip ?? '')].join('\n') });

const norm = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\p{S}\p{C}]/gu, '');
const UNSAFE: Record<string, RegExp[]> = {
  absolute_compliance: [/(保证|确保|包)(过审|通过审核|不被处罚|不会被处罚|不违规|合规)/, /(百分之百|100)(合规|安全|过审|有效)/, /绝对(合规|安全|不会被处罚)/, /(一定|肯定)不会(被)?(处罚|封号|违规)/],
  return_promise: [/(稳赚|包赚|必赚|保证收益|保证盈利|零风险|无风险)/],
  medical_diagnosis: [/(治愈|根治|药到病除|包治)/, /(诊断|确诊)(为|是|结果)/],
};
const DISCLAIMER = /(不能|不可以?|不得|不要|不应|并非|不是|无法|不会|不宜|切勿|请勿)(用来|用于|视为|当作)?(替代|取代)(律师|法律意见|专业|医生|就医)[^，。；\n]{0,8}/g;

export function evidenceScore(e: Candidate, today: Date, domainOk?: (host: string) => boolean): { score: number; why: string[] } {
  const src = e.source ?? ({} as LibEntry['source']);
  const why: string[] = [];
  const tier = String((src as { tier?: string }).tier ?? 'D').toUpperCase().slice(0, 1);
  let tierScore = TIER[tier] ?? 0;
  if (tier === 'B' && e.second_source) tierScore = 0.9;
  else if (tier === 'B') why.push('B 级来源，需要第二份独立来源（second_source）才能上线');
  const url = String(src.url ?? '');
  const checks: Record<string, boolean> = {
    'https 链接': url.startsWith('https://'),
    '出处名称+发布机构': !!src.title && !!src.publisher,
    '读到的范围（全文/摘要）': !!src.read_scope,
    发布日期: !!e.publish_date,
    核对日期: !!e.retrieved_at,
  };
  if (domainOk && checks['https 链接']) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      /* ignore */
    }
    checks['来源域名在白名单'] = domainOk(host);
  }
  for (const [k, ok] of Object.entries(checks)) if (!ok) why.push(`缺少或不合格：${k}`);
  let completeness = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
  const t = Date.parse(String(e.retrieved_at ?? '').slice(0, 10));
  if (!Number.isNaN(t)) {
    const age = Math.floor((today.getTime() - t) / 86_400_000);
    if (age > 120) {
      why.push(`来源核对已 ${age} 天，需要重新核对`);
      completeness *= 0.8;
    }
  }
  return { score: Math.round(Math.min(tierScore, completeness) * 10_000) / 10_000, why };
}

export function safetyScore(e: Candidate): { score: number; why: string[] } {
  const why: string[] = [];
  const n = norm(text(e).replace(DISCLAIMER, ''));
  for (const [fam, pats] of Object.entries(UNSAFE)) for (const p of pats) { const m = n.match(p); if (m) why.push(`合规词族命中：${fam}（${m[0]}）`); }
  if (!String(e.caution ?? '').trim()) why.push('缺少“注意/边界”说明（caution）');
  return { score: why.length ? 0 : 1, why };
}

function rankOf(idx: BM25Index, ids: string[], q: string, target: string): number | null {
  const res = idx.query(q, 10);
  const i = res.findIndex((r) => ids[r.index] === target);
  return i < 0 ? null : i + 1;
}

export function impact(c: Candidate, doc: LibEntry[]): GateRow['impact'] {
  const probes = (c.probes ?? []).filter((p) => String(p).trim());
  const baseIds = doc.map((e) => e.id);
  const withIds = [...baseIds, c.id];
  const without = doc.length ? new BM25Index(doc.map(idxText)) : null;
  const withc = new BM25Index([...doc, c].map(idxText));
  const hits = probes.filter((p) => (rankOf(withc, withIds, p, c.id) ?? 99) <= HIT_K.value).length;
  const regressions: GateRow['impact']['regressions'] = [];
  let checked = 0;
  for (const e of doc) {
    for (const p of ((e as Candidate).probes ?? [e.title]).filter(Boolean)) {
      checked++;
      const before = without ? rankOf(without, baseIds, p, e.id) : null;
      const after = rankOf(withc, withIds, p, e.id);
      if (before !== null && before <= HIT_K.value && (after === null || after > HIT_K.value)) regressions.push({ entry: e.id, probe: p, before, after });
    }
  }
  const rate = probes.length ? hits / probes.length : 0;
  const why: string[] = [];
  if (probes.length < MIN_PROBES) why.push(`probes 太少：${probes.length} < ${MIN_PROBES}（无法证明变好）`);
  if (probes.length && rate < MIN_PROBE_RATE) why.push(`候选自己的口语问法只命中 ${hits}/${probes.length}，低于 ${MIN_PROBE_RATE.toFixed(2)}`);
  if (regressions.length) why.push(`已有条目退步 ${regressions.length} 处`);
  return { probes: probes.length, hit_at_3: hits, hit_rate: Math.round(rate * 10_000) / 10_000, regression_checked: checked, regressions, decision: why.length ? 'reject' : 'keep', why };
}

export function duplicates(c: Candidate, doc: LibEntry[]): string[] {
  const out: string[] = [];
  const url = c.source?.url;
  const no = c.source?.doc_no;
  for (const e of doc) {
    if (e.id === c.id) out.push(`id 已存在：${e.id}`);
    else if (url && e.source?.url === url) out.push(`同一来源链接已在 ${e.id}`);
    else if (no && e.source?.doc_no === no) out.push(`同一文号已在 ${e.id}`);
  }
  return out;
}

export function evaluate(c: Candidate, doc: LibEntry[], opts: { today?: Date; domainOk?: (host: string) => boolean } = {}): GateRow {
  const today = opts.today ?? new Date();
  const ev = evidenceScore(c, today, opts.domainOk);
  const sf = safetyScore(c);
  const im = impact(c, doc);
  const dups = duplicates(c, doc);
  const reasons: string[] = [];
  if (ev.score < THRESHOLD) reasons.push(`证据分 ${ev.score} < ${THRESHOLD}`, ...ev.why);
  if (sf.score < THRESHOLD) reasons.push(`安全分 ${sf.score} < ${THRESHOLD}`, ...sf.why);
  if (im.decision !== 'keep') reasons.push(...im.why);
  reasons.push(...dups);
  return { id: c.id, title: c.title, decision: reasons.length ? 'reject' : 'keep', evidence: ev.score, safety: sf.score, impact: im, duplicates: dups, reasons, evaluated_at: new Date().toISOString() };
}

export function evaluateAll(staged: Candidate[], doc: LibEntry[], opts: { today?: Date; domainOk?: (host: string) => boolean } = {}) {
  const have = new Set(doc.map((e) => e.id));
  const rows = staged.filter((c) => !have.has(c.id)).map((c) => evaluate(c, doc, opts));
  return { n: rows.length, keep: rows.filter((r) => r.decision === 'keep').map((r) => r.id), reject: rows.filter((r) => r.decision !== 'keep').map((r) => r.id), rows };
}

export function renderMd(rep: ReturnType<typeof evaluateAll>): string {
  const lines = ['# 候选条目闸门报告', '', `共 ${rep.n} 条；可交人工审核（keep）${rep.keep.length} 条，暂不通过（reject）${rep.reject.length} 条。`, '', '闸门只给结论，不上线任何东西；上线仍需人工 approve 并写审核人姓名。', ''];
  for (const r of rep.rows) {
    lines.push(`## ${r.id} ${r.title} — ${r.decision}`, `- 证据分 ${r.evidence}；安全分 ${r.safety}；探针命中 ${r.impact.hit_at_3}/${r.impact.probes}；已有条目退步 ${r.impact.regressions.length}`, ...r.reasons.map((x) => `- ✗ ${x}`), '');
  }
  return lines.join('\n');
}
