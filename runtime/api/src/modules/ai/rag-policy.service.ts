import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import path from 'path';

export interface RagPolicySource {
  id: string;
  source_url: string;
  source_name: string;
  published_at: string;
  retrieved_at: string;
  /** 人工复核：复核人对照原文确认内容仍然有效后填写（scripts/review_rag_source.py）。 */
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  jurisdiction: string;
  source_tier: string;
  review_status: string;
  platforms: string[];
  topics: string[];
  content: string;
}

export const COMPLIANCE_REVIEW_NOTICE = '合规规则资料需要人工复核';
/** 到期前多少天开始提醒运营。 */
export const REVIEW_REMINDER_DAYS = 5;

export interface RagSourceStatus {
  id: string;
  name: string;
  /** 最近一次有效核对时间：人工复核时间（有复核人时）或抓取时间 */
  lastCheckedAt: string | null;
  checkedBy: 'review' | 'retrieval';
  daysSinceCheck: number | null;
  daysLeft: number | null;
  state: 'current' | 'due_soon' | 'stale' | 'invalid';
}

export interface RagFreshnessReport {
  maxAgeDays: number;
  total: number;
  current: number;
  needsReview: boolean;
  notice: string | null;
  sources: RagSourceStatus[];
}

const DAY = 86_400_000;
const ALLOWED_ORIGINS = ['https://www.cac.gov.cn', 'https://www.douyin.com', 'https://www.bilibili.com'];

/**
 * 时效以「最近一次核对」为准：有复核人与复核时间（且不早于抓取、不晚于现在）时用复核时间，
 * 否则用抓取时间。不允许只改日期「骗过」时效检查——复核必须写明复核人。
 */
export function lastCheckedAt(record: Partial<RagPolicySource>, now: number): { at: number; by: 'review' | 'retrieval' } | null {
  const retrieved = Date.parse(String(record.retrieved_at ?? ''));
  if (!Number.isFinite(retrieved) || retrieved > now) return null;
  const reviewer = typeof record.reviewed_by === 'string' ? record.reviewed_by.trim() : '';
  const reviewed = Date.parse(String(record.reviewed_at ?? ''));
  if (reviewer && Number.isFinite(reviewed) && reviewed >= retrieved && reviewed <= now) return { at: reviewed, by: 'review' };
  return { at: retrieved, by: 'retrieval' };
}

@Injectable()
export class RagPolicyService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RagPolicyService.name);
  private reminderTimer?: NodeJS.Timeout;
  constructor(private readonly config: ConfigService) {}

  private directory() {
    return this.config.get<string>('RAG_POLICY_DIR') || path.join(process.cwd(), 'data', 'rag_cache');
  }

  private maxAgeDays() {
    const maxAgeDays = Number(this.config.get('RAG_MAX_AGE_DAYS') ?? 30);
    if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 365) throw new Error('RAG_MAX_AGE_DAYS 必须为 1 到 365 的整数');
    return maxAgeDays;
  }

  private async readAll(): Promise<Array<{ name: string; record: RagPolicySource | null }>> {
    let names: string[];
    try { names = (await fs.readdir(this.directory())).filter(name => name.endsWith('.json')); }
    catch { this.logger.warn(`RAG policy directory unavailable: ${this.directory()}`); return []; }
    const out: Array<{ name: string; record: RagPolicySource | null }> = [];
    for (const name of names.sort()) {
      try { out.push({ name, record: JSON.parse(await fs.readFile(path.join(this.directory(), name), 'utf8')) as RagPolicySource }); }
      catch { out.push({ name, record: null }); }
    }
    return out;
  }

  /** 来源本身是否合格（与时效无关）。 */
  private isWellFormed(record: RagPolicySource): boolean {
    try {
      const source = new URL(record.source_url);
      const published = Date.parse(record.published_at);
      const retrieved = Date.parse(record.retrieved_at);
      return record.review_status === 'verified' && record.jurisdiction === 'CN'
        && ['S', 'A'].includes(record.source_tier)
        && ALLOWED_ORIGINS.includes(source.origin)
        && !source.username && !source.password && !source.hash
        && Number.isFinite(published) && published <= retrieved
        && typeof record.id === 'string' && !!record.id.trim()
        && typeof record.source_name === 'string' && !!record.source_name.trim()
        && typeof record.content === 'string' && !!record.content.trim()
        && Array.isArray(record.platforms) && record.platforms.length > 0
        && record.platforms.every(value => typeof value === 'string' && !!value.trim())
        && Array.isArray(record.topics) && record.topics.length > 0
        && record.topics.every(value => typeof value === 'string' && !!value.trim());
    } catch {
      return false;
    }
  }

  async select(platforms: string[] = [], topic = ''): Promise<RagPolicySource[]> {
    const maxAgeDays = this.maxAgeDays();
    const now = Date.now();
    const normalizedPlatforms = new Set(platforms.map(value => value.toLowerCase()));
    const selected: RagPolicySource[] = [];
    for (const { name, record } of await this.readAll()) {
      if (!record) { this.logger.warn(`Ignored unreadable RAG source: ${name}`); continue; }
      const checked = lastCheckedAt(record, now);
      const valid = !!checked && this.isWellFormed(record) && now - checked.at <= maxAgeDays * DAY;
      if (!valid) { this.logger.warn(`Ignored stale or invalid RAG source: ${name}`); continue; }
      const platformMatch = record.platforms.includes('all') || record.platforms.some(value => normalizedPlatforms.has(value.toLowerCase()));
      const topicMatch = record.topics.includes('all') || record.topics.some(value => topic.includes(value));
      if (platformMatch && topicMatch) selected.push(record);
    }
    return selected.slice(0, 5);
  }

  /** 每条资料的时效状态：给界面提示「合规规则资料需要人工复核」，也给运营提醒用。 */
  async freshnessReport(now = Date.now()): Promise<RagFreshnessReport> {
    const maxAgeDays = this.maxAgeDays();
    const sources: RagSourceStatus[] = (await this.readAll()).map(({ name, record }) => {
      const checked = record ? lastCheckedAt(record, now) : null;
      if (!record || !checked || !this.isWellFormed(record)) {
        return { id: record?.id || name, name: record?.source_name || name, lastCheckedAt: null, checkedBy: 'retrieval' as const, daysSinceCheck: null, daysLeft: null, state: 'invalid' as const };
      }
      const daysSince = Math.floor((now - checked.at) / DAY);
      const daysLeft = maxAgeDays - daysSince;
      const state = now - checked.at > maxAgeDays * DAY ? 'stale' as const : daysLeft <= REVIEW_REMINDER_DAYS ? 'due_soon' as const : 'current' as const;
      return { id: record.id, name: record.source_name, lastCheckedAt: new Date(checked.at).toISOString(), checkedBy: checked.by, daysSinceCheck: daysSince, daysLeft, state };
    });
    const current = sources.filter((s) => s.state === 'current' || s.state === 'due_soon').length;
    const needsReview = sources.length === 0 || sources.some((s) => s.state === 'stale' || s.state === 'invalid');
    return {
      maxAgeDays,
      total: sources.length,
      current,
      needsReview,
      notice: needsReview ? `${COMPLIANCE_REVIEW_NOTICE}：平台规则资料超过 ${maxAgeDays} 天未核对，AI 生成暂不引用这些资料，发布前请自行核对平台最新规则。` : null,
      sources,
    };
  }

  /**
   * 给运营的提醒：服务启动时与之后每 24 小时检查一次。
   * 过期 / 无效 → error 日志「[合规资料复核提醒]」；距到期 ≤ 5 天 → warn 日志。
   * 目前没有运营后台，提醒落在服务日志里，由日志告警（或后续接入的钉钉 / 企业微信机器人）转给负责人。
   */
  async remindOperators(now = Date.now()): Promise<RagFreshnessReport> {
    const report = await this.freshnessReport(now);
    for (const source of report.sources) {
      if (source.state === 'stale') {
        this.logger.error(`[合规资料复核提醒] ${COMPLIANCE_REVIEW_NOTICE}：「${source.name}」上次核对于 ${source.lastCheckedAt?.slice(0, 10)}，已 ${source.daysSinceCheck} 天，超过 ${report.maxAgeDays} 天时效，线上已停止引用。请对照原文复核后用 scripts/review_rag_source.py 登记复核人与日期。`);
      } else if (source.state === 'invalid') {
        this.logger.error(`[合规资料复核提醒] 「${source.name}」来源字段不完整或无法解析，线上未引用，请检查资料文件。`);
      } else if (source.state === 'due_soon') {
        this.logger.warn(`[合规资料复核提醒] 「${source.name}」还有 ${source.daysLeft} 天到期（上次核对 ${source.lastCheckedAt?.slice(0, 10)}），请安排复核。`);
      }
    }
    if (report.total === 0) this.logger.error(`[合规资料复核提醒] ${COMPLIANCE_REVIEW_NOTICE}：没有找到任何合规规则资料。`);
    return report;
  }

  async onApplicationBootstrap() {
    if (process.env.NODE_ENV === 'test') return;
    await this.remindOperators().catch((error) => this.logger.error(`合规资料时效检查失败：${error instanceof Error ? error.message : error}`));
    this.reminderTimer = setInterval(() => { void this.remindOperators().catch(() => undefined); }, DAY);
    this.reminderTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.reminderTimer) clearInterval(this.reminderTimer);
  }

  buildContext(sources: RagPolicySource[]) {
    if (!sources.length) return '\n\n当前没有通过来源、时效和适用范围校验的合规资料。不要编造平台规则、引用或宣称已通过合规审核；仅生成待人工核对的草稿。';
    return `\n\n以下为已核验的合规资料，只能据此形成合规提醒，不得编造资料中没有的事实：\n${sources.map((source, index) => `[${index + 1}] ${source.source_name}（发布：${source.published_at}；检索：${source.retrieved_at}${source.reviewed_at ? `；人工复核：${source.reviewed_at}` : ''}）\n${source.content}`).join('\n\n')}`;
  }
}
