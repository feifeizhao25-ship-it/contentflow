import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
}
