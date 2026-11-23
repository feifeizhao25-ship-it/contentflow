import { GrowthSource } from './types';

/**
 * 增长 RAG 的相关度下限（库外问题不挂来源）。
 *
 * 原来的本地检索总是返回分数最高的前 3 条：问“今天上海天气怎么样”也会挂上《标识办法》。
 * 这里只看一件事：问句里的中文双字词（去掉“的、吗、怎么”这类虚字）和英文/数字词，
 * 有多大比例出现在这条来源的标题或正文里。低于下限的来源不算命中。
 *
 * 0.3 用 evals/ 下的题调出（离线、不调用模型）：
 * - 金标准语料题 180 道、手写库内问法 12 道：最低 0.364，全部保留；
 * - 库外题 16 道（out_of_corpus_v1.jsonl）：最高 0.2，全部拒答；冻结集拒答题 0.111。
 * 可用 GROWTH_RAG_MIN_COVERAGE 覆盖（0 到 1，0 表示关闭）。
 */
const STOP_CHARS = new Set(Array.from('的了是在有我你他她它们这那个一不也都很而会把被让给跟比等还对才能吗呢吧啊么怎要想该应什么哪些怎样如何可以多少'));

export const DEFAULT_MIN_COVERAGE = 0.3;

export function minCoverage(env: Record<string, string | undefined> = process.env): number {
  const raw = String(env.GROWTH_RAG_MIN_COVERAGE ?? '').trim();
  if (!raw) return DEFAULT_MIN_COVERAGE;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) return DEFAULT_MIN_COVERAGE;
  return value;
}

/** 问句或来源里的检索词：中文去虚字后的双字词，加上两位以上的英文/数字词（小写）。 */
export function coverageGrams(text: string): Set<string> {
  const out = new Set<string>();
  for (const run of String(text ?? '').match(/[\u4e00-\u9fff]+/g) ?? []) {
    const clean = Array.from(run).filter((ch) => !STOP_CHARS.has(ch)).join('');
    for (let i = 0; i + 1 < clean.length; i += 1) out.add(clean.slice(i, i + 2));
  }
  for (const word of String(text ?? '').match(/[A-Za-z0-9]{2,}/g) ?? []) out.add(word.toLowerCase());
  return out;
}

/** 问句检索词被这条来源覆盖的比例（0 到 1）。问句没有任何检索词时返回 0。 */
export function queryCoverage(query: string, sourceText: string): number {
  const need = coverageGrams(query);
  if (!need.size) return 0;
  const have = coverageGrams(sourceText);
  let hit = 0;
  for (const gram of need) if (have.has(gram)) hit += 1;
  return hit / need.size;
}

/**
 * 只用本地算法（字面重叠 + 相关度下限）给出引用，不联网、不调用模型。
 * 冻结评测用它检验“库外问题不挂来源”，不用于对外回答。
 */
export function localCitations(query: string, sources: GrowthSource[], options: { limit?: number; minCoverage?: number } = {}): Array<{ source_id: string; score: number }> {
  const floor = options.minCoverage ?? minCoverage();
  return sources
    .map((source) => ({ source_id: source.source_id, cover: queryCoverage(query, `${source.title}\n${source.text}`) }))
    .filter((item) => item.cover > 0 && (floor <= 0 || item.cover >= floor))
    .sort((a, b) => b.cover - a.cover || a.source_id.localeCompare(b.source_id))
    .slice(0, options.limit ?? 3)
    .map((item) => ({ source_id: item.source_id, score: Number(item.cover.toFixed(4)) }));
}
