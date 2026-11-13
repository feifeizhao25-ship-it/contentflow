/**
 * 金标准 / 留出集打分（离线）。
 * 答案必须是语料原文的子串；分数不得低于 eval_baseline.json。
 * 不调用模型，也不发布任何条目。
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { STAGED_FILE, defaultAnswer, GoldenCase, loadGolden, loadStaged, runGolden } from '../../growth/self-improve/continuous';
import { CorpusPassage, loadPassages, passageById, retrievePassages } from './corpus';
import { frozenCases, refusalFrozenCases, runFrozenEval } from './policy';

export interface EvalBaseline {
  golden_pass_rate: number;
  corpus_grounding: number;
  faithfulness: number;
  citation_accuracy: number;
  recall_at_8: number;
  frozen_holdout_grounding: number;
  refusal_accuracy: number;
}

export function loadBaseline(file = join(__dirname, '../../../../data/eval/eval_baseline.json')): EvalBaseline {
  return JSON.parse(readFileSync(file, 'utf8')) as EvalBaseline;
}

export interface CorpusMetrics {
  golden_total: number;
  golden_pass_rate: number;
  corpus_cases: number;
  corpus_grounding: number;
  faithfulness: number;
  citation_accuracy: number;
  recall_at_8: number;
  frozen_total: number;
  frozen_holdout: number;
  frozen_holdout_grounding: number;
  refusal_accuracy: number;
  platforms: Record<string, number>;
}

function rate(ok: number, total: number): number {
  return total ? Math.round((ok / total) * 1000) / 1000 : 0;
}

export function scoreCorpusEval(cases = loadGolden(join(__dirname, '../../../../data/eval/golden_contentflow_zh.jsonl')), passages: CorpusPassage[] = loadPassages()): CorpusMetrics {
  const staged = loadStaged(STAGED_FILE);
  const answer = (item: GoldenCase) => defaultAnswer(item, staged);
  const golden = runGolden(cases, answer, { now: new Date('2026-10-31T10:00:00Z') });
  const corpusCases = cases.filter((item) => item.channel === 'corpus' && item.expect === 'answer');
  let grounded = 0;
  let faithful = 0;
  let cited = 0;
  let recalled = 0;
  for (const item of corpusCases) {
    const passage = passageById(String(item.corpus_id ?? ''), passages);
    const replied = answer(item);
    const includes = (item.must_include ?? []).every((need) => {
      const alts = typeof need === 'string' ? [need] : need;
      return alts.some((text) => passage?.text.includes(text));
    });
    if (passage && includes) grounded += 1;
    if (passage && replied.text === passage.text && !replied.refused) faithful += 1;
    if (passage && item.sources?.[0]?.url === passage.url) cited += 1;
    const top = retrievePassages(item.question, passages, 8);
    if (passage && top.some((hit) => hit.id === passage.id)) recalled += 1;
  }
  const holdout = frozenCases().filter((item) => item.expectCitations > 0 && item.corpus_id && item.must_include?.length);
  let holdoutOk = 0;
  for (const item of holdout) {
    const passage = passageById(item.corpus_id ?? '', passages);
    const top = retrievePassages(item.query, passages, 8);
    const spanOk = (item.must_include ?? []).every((span) => passage?.text.includes(span) && item.answer === passage?.text);
    if (passage && spanOk && top.some((hit) => hit.id === passage.id)) holdoutOk += 1;
  }
  const refusals = cases.filter((item) => item.expect === 'refuse');
  const refusalOk = refusals.filter((item) => {
    const replied = answer(item);
    return replied.refused || /不能|无法|不提供|不做|不会|不应|抱歉|不予/.test(replied.text);
  }).length;
  const frozenRefusals = refusalFrozenCases();
  const refusalGate = runFrozenEval(frozenRefusals, () => []) ? 1 : 0;
  const platforms: Record<string, number> = {};
  for (const item of corpusCases) {
    const platform = String(item.platform ?? '');
    if (platform) platforms[platform] = (platforms[platform] ?? 0) + 1;
  }
  return {
    golden_total: golden.total,
    golden_pass_rate: golden.rate,
    corpus_cases: corpusCases.length,
    corpus_grounding: rate(grounded, corpusCases.length),
    faithfulness: rate(faithful, corpusCases.length),
    citation_accuracy: rate(cited, corpusCases.length),
    recall_at_8: rate(recalled, corpusCases.length),
    frozen_total: frozenCases().length,
    frozen_holdout: holdout.length,
    frozen_holdout_grounding: rate(holdoutOk, holdout.length),
    refusal_accuracy: refusals.length ? rate(refusalOk, refusals.length) * refusalGate : refusalGate,
    platforms,
  };
}

export function belowBaseline(metrics: CorpusMetrics, baseline: EvalBaseline): string[] {
  const gaps: string[] = [];
  const check = (name: keyof EvalBaseline, value: number) => {
    if (typeof baseline[name] === 'number' && value < baseline[name]) gaps.push(`${name}: ${value} < ${baseline[name]}`);
  };
  check('golden_pass_rate', metrics.golden_pass_rate);
  check('corpus_grounding', metrics.corpus_grounding);
  check('faithfulness', metrics.faithfulness);
  check('citation_accuracy', metrics.citation_accuracy);
  check('recall_at_8', metrics.recall_at_8);
  check('frozen_holdout_grounding', metrics.frozen_holdout_grounding);
  check('refusal_accuracy', metrics.refusal_accuracy);
  return gaps;
}

export type { GoldenCase };
