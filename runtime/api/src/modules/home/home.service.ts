import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { chinaDayStart } from '../../common/china-period';
import { EMPTY_PROFILE, ProfileAnswers } from '../library/feed';
import { Lang, TodaySignals, nextStep } from './today';
import { pendingItems, suggestionsForProfile } from './suggestions';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async signals(tenantId: string, userId: string, now: Date): Promise<TodaySignals> {
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const p = this.prisma as any;
    const [accounts, content7, drafts, pending, approved, published7, failed7, scheduled, materials, goals] = await Promise.all([
      p.platformAccount.findMany({ where: { tenant_id: tenantId, status: 'active' }, select: { platform: true } }),
      p.content.count({ where: { tenant_id: tenantId, status: { not: 'deleted' }, created_at: { gte: since } } }),
      p.content.count({ where: { tenant_id: tenantId, status: 'draft' } }),
      p.content.count({ where: { tenant_id: tenantId, status: 'pending_review' } }),
      p.content.count({ where: { tenant_id: tenantId, status: 'approved', publish_tasks: { none: {} } } }),
      p.publishTask.count({ where: { tenant_id: tenantId, status: { in: ['published', 'manual_done'] }, created_at: { gte: since } } }),
      p.publishTask.count({ where: { tenant_id: tenantId, status: 'failed', created_at: { gte: since } } }),
      p.publishTask.count({ where: { tenant_id: tenantId, status: { in: ['pending', 'queued'] }, scheduled_at: { gt: now } } }),
      p.material.count({ where: { tenant_id: tenantId } }),
      p.growthGoal ? p.growthGoal.count({ where: { user_id: userId, status: 'active' } }) : 0,
    ]);
    const platforms = [...new Set<string>(accounts.map((a: { platform: string }) => a.platform).filter(Boolean))].sort();
    return {
      accounts: accounts.length, platforms, content_7d: content7, drafts, pending_review: pending, approved_unpublished: approved,
      published_7d: published7, failed_7d: failed7, scheduled_upcoming: scheduled, materials, active_goals: goals,
    };
  }

  /** 增长计划用：只给用户编号，租户从用户记录里取（growth 的查询按 user_id，控制器不传 tenantId）。 */
  async signalsForUser(userId: string, now = new Date()): Promise<TodaySignals> {
    const u = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { tenant_id: true } });
    return this.signals(u?.tenant_id ?? '', userId, now);
  }

  private async profile(userId: string): Promise<ProfileAnswers> {
    const find = (this.prisma as any).user?.findUnique;
    if (typeof find !== 'function') return EMPTY_PROFILE;
    const row = await find.call((this.prisma as any).user, {
      where: { id: userId },
      select: { industry: true, job_role: true, growth_stage: true, province: true },
    });
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    return {
      industry: text(row?.industry),
      jobRole: text(row?.job_role),
      growthStage: text(row?.growth_stage),
      province: text(row?.province),
    };
  }

  private async pendingRows(tenantId: string): Promise<Array<{ id?: unknown; title?: unknown }>> {
    const findMany = (this.prisma as any).content?.findMany;
    if (typeof findMany !== 'function') return [];
    const rows = await findMany.call((this.prisma as any).content, {
      where: { tenant_id: tenantId, status: 'pending_review' },
      select: { id: true, title: true },
      orderBy: { created_at: 'desc' },
      take: 5,
    });
    return Array.isArray(rows) ? rows : [];
  }

  async today(user: { id: string; tenantId: string }, now = new Date()) {
    const lang: Lang = process.env.MARKET_REGION === 'global' ? 'en' : 'zh';
    const [signals, profile, pending] = await Promise.all([
      this.signals(user.tenantId, user.id, now),
      this.profile(user.id),
      this.pendingRows(user.tenantId),
    ]);
    const day = new Date(chinaDayStart(now).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
    // 国际版响应不增加这些字段。国内版在没绑账号时仍给出注册资料能对上的建议，并列出待审核正文。
    const domestic = lang === 'zh'
      ? { suggestions: suggestionsForProfile(profile), pending_items: pendingItems(pending) }
      : {};
    return {
      generated_for: day,
      language: lang,
      signals,
      next_step: nextStep(signals, lang, lang === 'zh'),
      ...domestic,
      data_source: 'your_workspace_activity',
    };
  }
}
