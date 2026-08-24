import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string, dateRange: { start: Date; end: Date }) {
    // 汇总数据
    const [publishStats, contentStats, accountStats] = await Promise.all([
      this.prisma.publishTask.aggregate({
        where: {
          tenant_id: tenantId,
          created_at: { gte: dateRange.start, lte: dateRange.end },
        },
        _count: true,
        _sum: { retry_count: true },
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

    return {
      publish: {
        total: publishStats._count,
        success: 0, // 需从任务状态计算
        failed: 0,
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
