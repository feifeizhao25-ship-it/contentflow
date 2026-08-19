import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class AchievementService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllAchievements(category?: string) {
    const where: any = { is_active: true };
    if (category) where.category = category;

    return await this.prisma.achievement.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    });
  }

  async getUserAchievements(userId: string, includeLocked = true) {
    const achievements = await this.prisma.achievement.findMany({
      where: { is_active: true },
    });

    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { user_id: userId },
    });

    const userAchievementMap = new Map(userAchievements.map(ua => [ua.achievement_id, ua]));

    return achievements.map(achievement => {
      const userAchievement = userAchievementMap.get(achievement.id);
      
      if (!userAchievement) {
        return {
          ...achievement,
          is_unlocked: false,
          current_progress: 0,
          progress_percentage: 0,
          can_claim: false,
          points_claimed: false,
          unlocked_at: null,
        };
      }

      return {
        ...achievement,
        is_unlocked: userAchievement.is_unlocked,
        current_progress: userAchievement.progress,
        progress_percentage: Math.min((userAchievement.progress / achievement.target_value) * 100, 100),
        can_claim: userAchievement.is_unlocked && !userAchievement.points_claimed,
        points_claimed: userAchievement.points_claimed,
        unlocked_at: userAchievement.unlocked_at,
      };
    });
  }

  async updateAchievementProgress(userId: string, conditionType: string, increment: number) {
    const achievements = await this.prisma.achievement.findMany({
      where: { 
        condition_type: conditionType,
        is_active: true,
      },
    });

    for (const achievement of achievements) {
      let userAchievement = await this.prisma.userAchievement.findUnique({
        where: {
          user_id_achievement_id: {
            user_id: userId,
            achievement_id: achievement.id,
          },
        },
      });

      if (!userAchievement) {
        userAchievement = await this.prisma.userAchievement.create({
          data: {
            user_id: userId,
            achievement_id: achievement.id,
            progress: 0,
            target_value: achievement.target_value,
            is_unlocked: false,
            points_claimed: false,
          },
        });
      }

      if (userAchievement.is_unlocked && userAchievement.points_claimed) {
        continue;
      }

      const newProgress = Math.min(userAchievement.progress + increment, achievement.target_value);
      const isUnlocked = newProgress >= achievement.target_value && !userAchievement.is_unlocked;

      await this.prisma.userAchievement.update({
        where: { id: userAchievement.id },
        data: {
          progress: newProgress,
          is_unlocked: isUnlocked,
          unlocked_at: isUnlocked ? new Date() : userAchievement.unlocked_at,
        },
      });
    }
  }

  async claimAchievementReward(userId: string, achievementId: string) {
    const achievement = await this.prisma.achievement.findUnique({ where: { id: achievementId } });
    if (!achievement) throw new NotFoundException('成就不存在');

    const userAchievement = await this.prisma.userAchievement.findUnique({
      where: {
        user_id_achievement_id: {
          user_id: userId,
          achievement_id: achievementId,
        },
      },
    });

    if (!userAchievement) throw new BadRequestException('请先解锁该成就');
    if (!userAchievement.is_unlocked) throw new BadRequestException('成就未解锁');
    if (userAchievement.points_claimed) throw new BadRequestException('奖励已领取');

    let userPoints = await this.prisma.userPoints.findUnique({ where: { user_id: userId } });
    if (!userPoints) {
      userPoints = await this.prisma.userPoints.create({
        data: { user_id: userId, balance: 0, total_earned: 0, total_spent: 0 },
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      // 先抢占领取标记，只有把 points_claimed 翻成 true 的请求才发分。
      // 上面第 120 行的判断与发分之间存在竞态，连点两下即可重复领取。
      const claimed = await tx.userAchievement.updateMany({
        where: {
          id: userAchievement.id,
          points_claimed: false,
          is_unlocked: true,
        },
        data: { points_claimed: true, points_claimed_at: new Date() },
      });

      if (claimed.count === 0) {
        throw new BadRequestException('奖励已领取');
      }

      // increment 而非绝对赋值 —— 原来的 `balance: newBalance` 会覆盖掉
      // 读取之后写入之前发生的其他加分
      await tx.userPoints.update({
        where: { user_id: userId },
        data: {
          balance: { increment: achievement.points_reward },
          total_earned: { increment: achievement.points_reward },
          experience_points: { increment: achievement.points_reward },
        },
      });

      const after = await tx.userPoints.findUnique({ where: { user_id: userId } });
      const newBalance = after?.balance ?? 0;

      await tx.pointsLog.create({
        data: {
          user_id: userId,
          points_change: achievement.points_reward,
          balance_before: newBalance - achievement.points_reward,
          balance_after: newBalance,
          log_type: 'achievement_unlock',
          description: `解锁成就: ${achievement.name}`,
          related_id: achievementId,
        },
      });

      return {
        success: true,
        achievement_id: achievement.id,
        achievement_name: achievement.name,
        points_earned: achievement.points_reward,
        new_balance: newBalance,
        message: `解锁成就 "${achievement.name}"，获得 ${achievement.points_reward} 积分！`,
      };
    });
  }

  async getAchievementStats(userId: string) {
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { user_id: userId },
    });

    const unlockedCount = userAchievements.filter(ua => ua.is_unlocked).length;
    const claimedCount = userAchievements.filter(ua => ua.points_claimed).length;

    const achievements = await this.prisma.achievement.findMany({
      where: { is_active: true },
    });

    const difficultyStats: Record<string, { total: number; unlocked: number }> = {
      bronze: { total: 0, unlocked: 0 },
      silver: { total: 0, unlocked: 0 },
      gold: { total: 0, unlocked: 0 },
      diamond: { total: 0, unlocked: 0 },
    };

    const userAchievementMap = new Map(userAchievements.map(ua => [ua.achievement_id, ua]));

    for (const achievement of achievements) {
      const diff = achievement.difficulty as keyof typeof difficultyStats;
      if (difficultyStats[diff]) {
        difficultyStats[diff].total++;
        const userAchievement = userAchievementMap.get(achievement.id);
        if (userAchievement?.is_unlocked) difficultyStats[diff].unlocked++;
      }
    }

    return {
      total_achievements: achievements.length,
      unlocked_achievements: unlockedCount,
      claimed_rewards: claimedCount,
      completion_percentage: achievements.length > 0 
        ? Math.round((unlockedCount / achievements.length) * 100) 
        : 0,
      by_difficulty: difficultyStats,
    };
  }
}
