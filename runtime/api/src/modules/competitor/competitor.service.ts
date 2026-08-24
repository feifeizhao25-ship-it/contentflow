import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * 竞品监控。
 *
 * 修复前 `getCompetitorAnalysis` **一行数据库都没查**，
 * 直接 return `{ name: '竞品账号', followers: 100000, engagementRate: 0.05 }` ——
 * 无论传什么 id 都是这一组数字。前端 competitor 页面另有 `mockCompetitors`，
 * 前后端各编一套。而 `CompetitorMonitor` 模型早就在 schema 里。
 *
 * 同 growth：原签名收 `tenantId`，但模型上的字段是 **`user_id`**。
 */
@Injectable()
export class CompetitorService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompetitors(userId: string) {
    const rows = await this.prisma.competitorMonitor.findMany({
      where: { user_id: userId, is_active: true },
      orderBy: { last_checked_at: 'desc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async getCompetitorAnalysis(userId: string, competitorId: string) {
    const row = await this.prisma.competitorMonitor.findFirst({
      // 必须带 user_id：只按 id 查等于任何人都能读别人的竞品监控
      where: { id: competitorId, user_id: userId },
    });

    if (!row) {
      // 返回 404 而不是编一份数据 —— 「查不到」和「竞品数据就长这样」
      // 是完全不同的两件事，混淆会让用户拿假数字做决策
      throw new NotFoundException('竞品监控记录不存在');
    }

    return this.serialize(row);
  }

  private serialize(row: any) {
    const stats = (row.engagement_stats ?? {}) as Record<string, unknown>;
    const posts = Array.isArray(row.recent_posts) ? row.recent_posts : [];

    return {
      id: row.id,
      name: row.competitor_name,
      platform: row.competitor_platform,
      accountUrl: row.account_url,
      lastCheckedAt: row.last_checked_at,
      lastPostDate: row.last_post_date,
      recentPosts: posts,
      // 抓取任务还没跑过时这些字段是空的 —— 用 null 明示「暂无数据」，
      // 不要用 0 冒充，0 会被前端当成真实观测值画进图里
      followers: typeof stats.followers === 'number' ? stats.followers : null,
      engagementRate:
        typeof stats.engagement_rate === 'number' ? stats.engagement_rate : null,
      contentCount: posts.length || null,
      // 让前端能区分「没监控数据」与「数据是零」
      hasData: row.last_checked_at !== null,
    };
  }
}
