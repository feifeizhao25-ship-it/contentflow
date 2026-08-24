import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) { }

  async getDashboard(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateRange = { start: today, end: new Date() };

    // 1. 获取发布任务统计
    const tasks = await this.prisma.publishTask.findMany({
      where: { tenant_id: tenantId }
    });

    const todayTasks = tasks.filter((t: any) => new Date(t.created_at) >= today);
    const successCount = tasks.filter((t: any) => t.status === 'published').length;
    const failedCount = tasks.filter((t: any) => t.status === 'failed').length;

    // 2. 获取内容统计
    const contents = await this.prisma.content.findMany({
      where: { tenant_id: tenantId }
    });

    // 3. 账号统计
    const accounts = await this.prisma.platformAccount.findMany({
      where: { tenant_id: tenantId, status: 'active' }
    });

    // 4. 最近活动 (合并内容创建和发布任务)
    const recentActivities = [
      ...tasks.map((t: any) => ({
        id: t.id,
        type: 'publish',
        title: '发布任务',
        status: t.status,
        created_at: t.created_at,
        platform: t.platform
      })),
      ...contents.map((c: any) => ({
        id: c.id,
        type: 'create',
        title: c.title || '新内容创作',
        status: 'completed',
        created_at: c.created_at,
        platform: 'system'
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

    return {
      stats: {
        todayPublishes: todayTasks.length,
        totalSuccess: successCount,
        totalFailed: failedCount,
        totalAccounts: accounts.length,
        totalFollowers: accounts.reduce((sum: number, a: any) => sum + (a.follower_count || 0), 0),
        contentCount: contents.length,
      },
      recentActivities,
      platformDistribution: accounts.reduce((acc: any, curr: any) => {
        acc[curr.platform] = (acc[curr.platform] || 0) + 1;
        return acc;
      }, {})
    };
  }
}
