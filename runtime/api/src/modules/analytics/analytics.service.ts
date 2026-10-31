import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AI_TYPE_TEXT,
  AI_TYPE_TEXT_EN,
  OverviewLang,
  engagementUnavailable,
  PublishSummary,
  failureReasonText,
  overviewWindows,
  summarizePublish,
} from './own-data-overview';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string, dateRange: { start: Date; end: Date }) {
    // 汇总数据
    const publishWhere = {
      tenant_id: tenantId,
      created_at: { gte: dateRange.start, lte: dateRange.end },
    };
    const [publishByStatus, contentStats, accountStats] = await Promise.all([
      this.prisma.publishTask.groupBy({
        by: ['status'],
        where: publishWhere,
        _count: { _all: true },
      }),
      this.prisma.content.findMany({
        where: {
          tenant_id: tenantId,
          created_at: { gte: dateRange.start, lte: dateRange.end },
        },
        select: { status: true, content_type: true },
      }),
      this.prisma.platformAccount.findMany({
        where: { tenant_id: tenantId, status: 'active' },
        select: { platform: true, follower_count: true },
      }),
    ]);

    // 成功 / 失败按任务的真实状态统计（原来这两个数字写死为 0，图表永远显示「没有成功也没有失败」）
    const countOf = (...statuses: string[]) =>
      publishByStatus.filter((row) => statuses.includes(row.status)).reduce((sum, row) => sum + row._count._all, 0);
    return {
      publish: {
        total: publishByStatus.reduce((sum, row) => sum + row._count._all, 0),
        success: countOf('published'),
        failed: countOf('failed'),
      },
      content: {
        total: contentStats.length,
        byStatus: contentStats.reduce((acc, c) => {
          acc[c.status] = (acc[c.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      accounts: {
        total: accountStats.length,
        totalFollowers: accountStats.reduce((sum, a) => sum + (a.follower_count || 0), 0),
      },
    };
  }

  /**
   * 「数据分析」页：本周 / 本月（北京时间）的发布任务、失败原因、AI 生成与采纳情况。
   * 只读自有数据；平台互动数据在接通授权前不提供（engagement.available=false）。
   */
  async getOverview(tenantId: string, now: Date | number = Date.now(), lang: OverviewLang = 'zh') {
    const windows = overviewWindows(now);
    const taskWindow = (range: { start: Date; end: Date }) => ({
      tenant_id: tenantId,
      OR: [
        { scheduled_at: { gte: range.start, lt: range.end } },
        { scheduled_at: null, created_at: { gte: range.start, lt: range.end } },
      ],
    });
    const publishFor = async (range: { start: Date; end: Date }): Promise<PublishSummary> => {
      const rows = await this.prisma.publishTask.groupBy({
        by: ['status'],
        where: taskWindow(range),
        _count: { _all: true },
      });
      return summarizePublish(rows.map((r: any) => ({ status: r.status, n: r._count._all })));
    };
    const aiFor = async (range: { start: Date; end: Date }) => {
      const rows = await this.prisma.aIGeneration.groupBy({
        by: ['generation_type'],
        where: { tenant_id: tenantId, status: 'success', created_at: { gte: range.start, lt: range.end } },
        _count: { _all: true },
      });
      const byType = rows
        .map((r: any) => ({ type: r.generation_type, label: (lang === 'en' ? AI_TYPE_TEXT_EN : AI_TYPE_TEXT)[r.generation_type] ?? (lang === 'en' ? 'Other' : '其他'), count: r._count._all }))
        .sort((a: any, b: any) => b.count - a.count);
      const contentWhere = { tenant_id: tenantId, source: 'ai', created_at: { gte: range.start, lt: range.end } };
      const [savedAsContent, approvedOrPublished] = await Promise.all([
        this.prisma.content.count({ where: contentWhere }),
        this.prisma.content.count({ where: { ...contentWhere, status: { in: ['approved', 'published'] } } }),
      ]);
      return {
        generations: byType.reduce((s: number, r: any) => s + r.count, 0),
        byType,
        // 采纳：AI 生成后保存进内容库的篇数，以及其中已通过审核 / 已发布的篇数
        savedAsContent,
        approvedOrPublished,
      };
    };

    const failedRows = await this.prisma.publishTask.findMany({
      where: { ...taskWindow(windows.month), status: 'failed' },
      select: { error_code: true, error_message: true },
      take: 500,
    });
    const reasons = new Map<string, number>();
    for (const row of failedRows) {
      const text = failureReasonText(row.error_code, row.error_message, lang);
      reasons.set(text, (reasons.get(text) ?? 0) + 1);
    }

    const [weekPublish, monthPublish, weekAi, monthAi] = await Promise.all([
      publishFor(windows.week),
      publishFor(windows.month),
      aiFor(windows.week),
      aiFor(windows.month),
    ]);

    return {
      timezone: 'Asia/Shanghai',
      generatedAt: new Date(now).toISOString(),
      week: { start: windows.week.start.toISOString(), publish: weekPublish, ai: weekAi },
      month: { start: windows.month.start.toISOString(), publish: monthPublish, ai: monthAi },
      failureReasons: [...reasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      engagement: engagementUnavailable(lang),
    };
  }
}
