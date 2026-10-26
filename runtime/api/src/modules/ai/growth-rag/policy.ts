import { readFileSync } from 'fs';
import { join } from 'path';
import { runFreshnessJob } from './freshness';
import { loadRegistry, validateSource } from './registry';
import { GrowthRegistry, GrowthSource } from './types';

export interface RagDecision {
  enabled: boolean;
  sources_status: 'none' | 'validated' | 'review_required';
  reasons: string[];
}

export interface RagPolicyInput {
  enabledFlag: boolean;
  registry: GrowthRegistry;
  now?: Date;
  freshnessRan: boolean;
  evalPassed: boolean;
}

/**
 * 增长 RAG 与合规资料的 RagPolicyService 分开。
 * 三条同时成立才把 sources_status 写成 validated：来源字段齐全、新鲜度任务已跑过、冻结评测通过。
 * enabled 还要求 GROWTH_RAG_ENABLED=1。空注册表保持 none。
 */
export function decideRagPolicy(input: RagPolicyInput): RagDecision {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  if (!input.registry.sources.length) {
    reasons.push('来源未配置');
    if (!input.enabledFlag) reasons.push('GROWTH_RAG_ENABLED 未打开');
    return { enabled: false, sources_status: 'none', reasons };
  }
  const invalid = input.registry.sources.flatMap((source) => {
    const checked = validateSource(source, now);
    return checked.ok ? [] : [`${source.source_id || 'unknown'}: ${checked.errors.join('；')}`];
  });
  if (invalid.length) {
    reasons.push(...invalid);
    if (!input.enabledFlag) reasons.push('GROWTH_RAG_ENABLED 未打开');
    return { enabled: false, sources_status: 'review_required', reasons };
  }
  if (!input.freshnessRan) reasons.push('新鲜度任务未运行');
  if (!input.evalPassed) reasons.push('冻结评测未通过');
  const sourcesStatus = reasons.length ? 'review_required' : 'validated';
  if (!input.enabledFlag) reasons.push('GROWTH_RAG_ENABLED 未打开');
  return { enabled: input.enabledFlag && sourcesStatus === 'validated', sources_status: sourcesStatus, reasons };
}

export function policyFromDefaultRegistry(env: NodeJS.ProcessEnv = process.env, now = new Date()): RagDecision {
  const registry = loadRegistry();
  const freshness = registry.sources.length ? runFreshnessJob(registry.sources, now) : null;
  return decideRagPolicy({
    enabledFlag: env.GROWTH_RAG_ENABLED === '1',
    registry,
    now,
    freshnessRan: freshness?.ran === true && freshness.needsReview.length === 0,
    evalPassed: env.GROWTH_RAG_EVAL_PASSED === '1' && runFrozenEval(frozenCases(), () => []),
  });
}

export interface FrozenCase {
  id: string;
  query: string;
  expectCitations: number;
  expectRefusal: boolean;
}

export function frozenCases(file = join(__dirname, 'evals', 'frozen.jsonl')): FrozenCase[] {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FrozenCase);
}

/** 没有引用时必须拒绝下结论。评测不发明规则。 */
export function runFrozenEval(cases: FrozenCase[], citationsFor: (query: string) => { source_id: string }[]): boolean {
  return cases.every((item) => {
    const citations = citationsFor(item.query);
    if (citations.length !== item.expectCitations) return false;
    if (item.expectRefusal && citations.length > 0) return false;
    return true;
  });
}

export function usableSources(sources: GrowthSource[], now = new Date()): GrowthSource[] {
  return sources.filter((source) => validateSource(source, now).ok);
}
