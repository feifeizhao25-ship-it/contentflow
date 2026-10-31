import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { join } from 'path';
import { CONTINUOUS_CRON, ContinuousJob, runContinuousIfEnabled } from './continuous';
import { NullGateway, WeComGateway, approvalPolicyFromEnv } from './approval';
import { SILConfig, configFromEnv } from './config';
import { DEFAULT_THRESHOLDS } from './gates';
import { contentflowHooks } from './hooks';
import { CycleReport, SelfImprovementLoop } from './loop';
import { SIL_CRON, SIL_TIMEZONE } from './schedule';

/** 分发侠没有检索式问答，这几项不适用；其余门禁（红队 100%、成本/延迟 ≤120%、不低于无技能基线）照常 fail-closed。 */
export const CONTENTFLOW_THRESHOLDS = { ...DEFAULT_THRESHOLDS, notApplicable: ['recall_at_8', 'faithfulness', 'citation_accuracy', 'freshness_correctness', 'calc_error'] };

export function buildLoop(env: NodeJS.ProcessEnv = process.env, now: () => Date = () => new Date()): { loop: SelfImprovementLoop; cfg: SILConfig } {
  const cfg = configFromEnv('contentflow', env, { thresholds: CONTENTFLOW_THRESHOLDS });
  const ragCacheDir = env.RAG_POLICY_DIR || join(process.cwd(), 'data', 'rag_cache');
  const wecom = new WeComGateway(async (method, url, body) => {
    const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    return res.json();
  }, env);
  const loop = new SelfImprovementLoop(cfg, contentflowHooks({ ragCacheDir, dataDir: cfg.dataDir, maxAgeDays: Number(env.RAG_MAX_AGE_DAYS ?? 30), now }), {
    approval: approvalPolicyFromEnv(env),
    gateway: wecom.configured() ? wecom : new NullGateway(),
  });
  return { loop, cfg };
}

/**
 * 每周自改进的定时任务（Asia/Shanghai）。默认关闭：SIL_ENABLED 未设为 1 时每个任务立即返回。
 * 用户可见的改动（含「重新复核来源」）必须由 POLICY_REVIEWERS 名单内的人在企业微信批准；超时作废，不会晋升。
 * TODO(owner): POLICY_REVIEWERS 留空 = 没有任何人能批准；请由负责人填写。
 */
@Injectable()
export class SelfImproveService {
  private readonly logger = new Logger(SelfImproveService.name);

  enabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return configFromEnv('contentflow', env).enabled;
  }

  async runWeekly(now = new Date(), env: NodeJS.ProcessEnv = process.env): Promise<CycleReport | { status: 'disabled' }> {
    if (!this.enabled(env)) return { status: 'disabled' };
    const { loop } = buildLoop(env, () => now);
    const rep = await loop.runWeekly(now);
    this.logger.log(`self-improve weekly: ${rep.status} proposed=${rep.proposed.length} pending=${rep.pending_approval.length} promoted=${rep.promoted.length}`);
    return rep;
  }

  runMonthly(now = new Date(), env: NodeJS.ProcessEnv = process.env) {
    if (!this.enabled(env)) return { status: 'disabled' };
    return buildLoop(env, () => now).loop.runMonthly(now);
  }

  @Cron(SIL_CRON.weekly_cycle, { name: 'self-improve-weekly', timeZone: SIL_TIMEZONE })
  async weeklyJob(): Promise<void> {
    try {
      await this.runWeekly();
    } catch (e) {
      this.logger.error(`self-improve weekly failed: ${(e as Error).message}`);
    }
  }

  @Cron(SIL_CRON.monthly_maintenance, { name: 'self-improve-monthly', timeZone: SIL_TIMEZONE })
  monthlyJob(): void {
    try {
      this.runMonthly();
    } catch (e) {
      this.logger.error(`self-improve monthly failed: ${(e as Error).message}`);
    }
  }

  /** 持续改进（金标准 / 过期 / 线索入库候选 / 月报）。SIL_ENABLED 未开时返回 null，不写任何文件。 */
  runContinuous(job: ContinuousJob, now = new Date(), env: NodeJS.ProcessEnv = process.env) {
    return runContinuousIfEnabled(job, configFromEnv('contentflow', env), now);
  }

  private safeContinuous(job: ContinuousJob): void {
    try {
      this.runContinuous(job);
    } catch (e) {
      this.logger.error(`continuous ${job} failed: ${(e as Error).message}`);
    }
  }

  @Cron(CONTINUOUS_CRON.golden_eval, { name: 'continuous-golden', timeZone: SIL_TIMEZONE })
  goldenJob(): void {
    this.safeContinuous('golden_eval');
  }

  @Cron(CONTINUOUS_CRON.stale_scan, { name: 'continuous-stale', timeZone: SIL_TIMEZONE })
  staleJob(): void {
    this.safeContinuous('stale_scan');
  }

  @Cron(CONTINUOUS_CRON.radar_stage, { name: 'continuous-radar-stage', timeZone: SIL_TIMEZONE })
  radarStageJob(): void {
    this.safeContinuous('radar_stage');
  }

  @Cron(CONTINUOUS_CRON.monthly_report, { name: 'continuous-monthly-report', timeZone: SIL_TIMEZONE })
  monthlyReportJob(): void {
    this.safeContinuous('monthly_report');
  }
}
