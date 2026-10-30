import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadRegistry } from '../../ai/growth-rag/registry';
import { RagPolicySource, lastCheckedAt } from '../../ai/rag-policy.service';
import { SKILL_IDS_FOR_EVAL, runAllSkillEvals } from './skill-eval';
import { EvalOutcome, Hooks } from './loop';
import { KnowledgeEntry, contentHash } from './freshness';
import { checkCompliance } from './compliance';
import { SourceRecord } from './sources';
import { Candidate, newCandidate } from './store';

const DAY = 86_400_000;

export interface ContentflowHookOptions {
  ragCacheDir: string;
  dataDir: string;
  maxAgeDays?: number;
  now?: () => Date;
}

/** 与线上一致：以最近一次「有复核人」的复核时间或抓取时间为准，超过 maxAgeDays（默认 30）即过期。 */
export function staleCacheSources(dir: string, now: Date, maxAgeDays = 30): { id: string; name: string; ageDays: number; url: string }[] {
  if (!existsSync(dir)) return [];
  const out: { id: string; name: string; ageDays: number; url: string }[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    let rec: RagPolicySource;
    try {
      rec = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    const checked = lastCheckedAt(rec, now.getTime());
    const age = checked ? Math.floor((now.getTime() - checked.at) / DAY) : Number.POSITIVE_INFINITY;
    if (age > maxAgeDays) out.push({ id: rec.id, name: rec.source_name, ageDays: age, url: rec.source_url });
  }
  return out;
}

/**
 * 分发侠的钩子。只做三件事，都不碰线上规则正文：
 * 1. 采集：列出超过 30 天未复核的 rag_cache 来源（内部记录，不联网）。
 * 2. 提案：为每个过期来源提一条「请人工复核并重新抓取」的候选（用户可见 → 必须经企业微信批准）。
 * 3. 评测：跑 14 个技能的金标与红队，并与「只有话术库存、没有技能」的基线对比。
 * 晋升只是把来源写入 needs_refresh.json 复核队列；rag_cache 本身由人工用 scripts/review_rag_source.py 更新。
 */
export function contentflowHooks(opts: ContentflowHookOptions): Hooks {
  const now = opts.now ?? (() => new Date());
  const queueFile = join(opts.dataDir, 'needs_refresh.json');
  const readQueue = (): Record<string, unknown>[] => (existsSync(queueFile) ? JSON.parse(readFileSync(queueFile, 'utf8')) : []);
  const writeQueue = (q: Record<string, unknown>[]) => {
    mkdirSync(opts.dataDir, { recursive: true });
    writeFileSync(queueFile, JSON.stringify(q, null, 2), 'utf8');
  };

  return {
    collect: () =>
      staleCacheSources(opts.ragCacheDir, now(), opts.maxAgeDays ?? 30).map(
        (s): SourceRecord => ({ id: s.id, origin: 'internal', license: 'internal', title: s.name, url: s.url, text: '' }),
      ),
    propose: (clean, budget) =>
      clean.slice(0, budget).map(
        (rec): Candidate =>
          newCandidate({
            id: `refresh-${rec.id}-${now().toISOString().slice(0, 10)}`,
            kind: 'rule',
            target: String(rec.id),
            summary: `来源「${rec.title}」超过 30 天未复核，请人工对照官方原文复核并重新抓取。`,
            payload: { action: 'reverify_cache', source_id: rec.id, url: rec.url },
            origin: 'internal',
            user_visible: true,
          }),
      ),
    evaluate: (): EvalOutcome => {
      const r = runAllSkillEvals();
      const base = { redteam_pass_rate: r.baselineRedteamRate, golden_pass_rate: r.goldenRate };
      return {
        baseline: base,
        candidate: { redteam_pass_rate: r.redteamRate, golden_pass_rate: r.goldenRate, cost_ratio: 1, latency_ratio: 1 },
        noSkill: { redteam_pass_rate: r.noSkillRedteamRate },
      };
    },
    apply: (c) => {
      const before = readQueue();
      writeQueue([...before.filter((x) => x.source_id !== c.payload.source_id), { source_id: c.payload.source_id, url: c.payload.url, queued_by: c.id }]);
      return { queue_before: before };
    },
    rollback: (c) => writeQueue((c.snapshot?.queue_before as Record<string, unknown>[]) ?? []),
    entries: () =>
      loadRegistry().sources.map(
        (s): KnowledgeEntry => ({ id: s.source_id, source_tier: 'official', license: s.license, valid_from: s.fetched_at, valid_until: s.expires_at, content_hash: contentHash(s.text), origin: 'external', url: s.url }),
      ),
  };
}

export { SKILL_IDS_FOR_EVAL, checkCompliance };
