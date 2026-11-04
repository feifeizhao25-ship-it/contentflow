import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { chinaDayStart } from '../../common/china-period';
import { Lang, TodaySignals, nextStep } from './today';

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

  async today(user: { id: string; tenantId: string }, now = new Date()) {
    const lang: Lang = process.env.MARKET_REGION === 'global' ? 'en' : 'zh';
    const signals = await this.signals(user.tenantId, user.id, now);
    const day = new Date(chinaDayStart(now).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
    return {
      generated_for: day,
      language: lang,
      signals,
      next_step: nextStep(signals, lang, lang === 'zh'),
      data_source: 'your_workspace_activity',
    };
  }
}
