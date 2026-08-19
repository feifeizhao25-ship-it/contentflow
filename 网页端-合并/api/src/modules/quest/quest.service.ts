import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class QuestService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableQuests(userId: string, category?: string) {
    const where: any = { is_active: true };
    if (category) where.category = category;

    return await this.prisma.quest.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    });
  }

  async getUserQuestProgress(userId: string) {
    const quests = await this.prisma.quest.findMany({
      where: { is_active: true },
    });

    const userQuests = await this.prisma.userQuest.findMany({
      where: { user_id: userId },
    });

    const progressMap = new Map(userQuests.map(uq => [uq.quest_id, uq]));

    return quests.map(quest => {
      const userQuest = progressMap.get(quest.id);
      const currentProgress = userQuest?.current_progress || 0;
      const isCompleted = currentProgress >= quest.target_count;

      return {
        quest_id: quest.id,
        quest_name: quest.name,
        current_progress: currentProgress,
        target_count: quest.target_count,
        progress_percentage: Math.min((currentProgress / quest.target_count) * 100, 100),
        is_completed: isCompleted,
        points_claimed: userQuest?.points_claimed || false,
        can_claim: isCompleted && !userQuest?.points_claimed,
        expires_at: userQuest?.expires_at || null,
      };
    });
  }

  async updateQuestProgress(userId: string, questId: string, increment: number) {
    const quest = await this.prisma.quest.findUnique({ where: { id: questId } });
    if (!quest || !quest.is_active) {
      throw new NotFoundException('任务不存在或已关闭');
    }

    const now = new Date();
    let userQuest = await this.prisma.userQuest.findFirst({
      where: { user_id: userId, quest_id: questId },
    });

    if (userQuest?.expires_at && userQuest.expires_at < now) {
      await this.prisma.userQuest.delete({ where: { id: userQuest.id } });
      userQuest = null;
    }

    if (!userQuest) {
      const expiresAt = quest.is_daily
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : null;

      userQuest = await this.prisma.userQuest.create({
        data: {
          user_id: userId,
          quest_id: questId,
          current_progress: increment,
          is_completed: increment >= quest.target_count,
          expires_at: expiresAt,
        },
      });
    } else {
      const newProgress = Math.min(userQuest.current_progress + increment, quest.target_count);
      await this.prisma.userQuest.update({
        where: { id: userQuest.id },
        data: {
          current_progress: newProgress,
          is_completed: newProgress >= quest.target_count,
        },
      });
    }
  }

  async claimQuestReward(userId: string, questId: string) {
    const quest = await this.prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) throw new NotFoundException('任务不存在');

    const userQuest = await this.prisma.userQuest.findFirst({
      where: { user_id: userId, quest_id: questId },
    });

    if (!userQuest) throw new BadRequestException('请先完成任务');
    if (userQuest.points_claimed) throw new BadRequestException('奖励已领取');
    if (!userQuest.is_completed) throw new BadRequestException('任务未完成');
    if (userQuest.expires_at && userQuest.expires_at < new Date()) {
      throw new BadRequestException('任务已过期');
    }

    let userPoints = await this.prisma.userPoints.findUnique({
      where: { user_id: userId },
    });

    if (!userPoints) {
      userPoints = await this.prisma.userPoints.create({
        data: { user_id: userId, balance: 0, total_earned: 0, total_spent: 0 },
      });
    }

    const newBalance = (userPoints.balance || 0) + quest.points_reward;

    await this.prisma.userPoints.update({
      where: { user_id: userId },
      data: {
        balance: newBalance,
        total_earned: { increment: quest.points_reward },
        experience_points: { increment: quest.points_reward },
      },
    });

    await this.prisma.userQuest.update({
      where: { id: userQuest.id },
      data: { points_claimed: true },
    });

    await this.prisma.pointsLog.create({
      data: {
        user_id: userId,
        points_change: quest.points_reward,
        balance_before: userPoints.balance,
        balance_after: newBalance,
        log_type: 'quest_complete',
        description: `完成任务: ${quest.name}`,
        related_id: questId,
      },
    });

    return {
      success: true,
      quest_id: quest.id,
      quest_name: quest.name,
      points_earned: quest.points_reward,
      new_balance: newBalance,
      message: `完成任务 "${quest.name}"，获得 ${quest.points_reward} 积分！`,
    };
  }

  async getDailyQuests(userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dailyQuests = await this.prisma.quest.findMany({
      where: { is_daily: true, is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    const userQuests = await this.prisma.userQuest.findMany({
      where: {
        user_id: userId,
        quest_id: { in: dailyQuests.map(q => q.id) },
        created_at: { gte: todayStart },
      },
    });

    const completedIds = new Set(userQuests.map(uq => uq.quest_id));

    return dailyQuests.map(quest => ({
      ...quest,
      is_completed: completedIds.has(quest.id),
      progress: userQuests.find(uq => uq.quest_id === quest.id)?.current_progress || 0,
    }));
  }
}
