import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string, dateRange: { start: Date; end: Date }) {
    // 汇总数据
    const [publishStats, contentStats, accountStats, engagementStats] = await Promise.all([
      this.prisma.publishTask.groupBy({
        by: ['status'],
        where: {
          tenant_id: tenantId,
          created_at: { gte: dateRange.start, lte: dateRange.end },
        },
        _count: true,
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
      this.prisma.contentStats.aggregate({
        where: {
          publish_task: {
            tenant_id: tenantId,
            created_at: { gte: dateRange.start, lte: dateRange.end },
          },
        },
        _sum: {
          views: true,
          likes: true,
          comments: true,
          shares: true,
          saves: true,
          followers_gained: true,
        },
      }),
    ]);

    const publishByStatus = Object.fromEntries(
      publishStats.map((row) => [row.status, row._count]),
    );
    const totalPublish = Object.values(publishByStatus).reduce((sum, value) => sum + value, 0);

    return {
      publish: {
        total: totalPublish,
        success: publishByStatus.published || 0,
        failed: publishByStatus.failed || 0,
        byStatus: publishByStatus,
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
      engagement: {
        views: engagementStats._sum.views || 0,
        likes: engagementStats._sum.likes || 0,
        comments: engagementStats._sum.comments || 0,
        shares: engagementStats._sum.shares || 0,
        saves: engagementStats._sum.saves || 0,
        followersGained: engagementStats._sum.followers_gained || 0,
      },
    };
  }
}
