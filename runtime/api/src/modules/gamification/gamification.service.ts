import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GamificationService {
    private readonly logger = new Logger(GamificationService.name);

    constructor(private readonly prisma: PrismaService) { }

    // 获取用户游戏化状态
    async getUserStatus(userId: string) {
        let profile = await this.prisma.gamificationProfile.findUnique({
            where: { user_id: userId },
        });

        if (!profile) {
            // 懒创建
            profile = await this.prisma.gamificationProfile.create({
                data: { user_id: userId },
            });
        }

        return profile;
    }

    // 增加经验值
    async addXp(userId: string, amount: number, source: string) {
        const profile = await this.getUserStatus(userId);

        let newXp = profile.xp + amount;
        let newLevel = profile.level;
        let nextLevelXp = profile.next_level_xp;

        // 简单升级逻辑: 下一级需要 当前等级 * 100 XP (累积)
        // 或者每级增加 1.5 倍? 保持简单: Level N -> (N * 100) additional XP
        // 假设 next_level_xp 是到达下一级所需的总经验还是当前级的阈值?
        // 这里假设 next_level_xp 是当前等级升级所需的经验上限

        let leveledUp = false;
        while (newXp >= nextLevelXp) {
            newXp -= nextLevelXp;
            newLevel++;
            nextLevelXp = Math.floor(nextLevelXp * 1.2);
            leveledUp = true;
            this.logger.log(`User ${userId} leveled up to ${newLevel}!`);
        }

        const updated = await this.prisma.gamificationProfile.update({
            where: { id: profile.id },
            data: {
                xp: newXp,
                level: newLevel,
                next_level_xp: nextLevelXp,
            },
        });

        if (leveledUp) {
            // TODO: Emit LevelUp Event
        }

        return updated;
    }

    // 更新连续签到/活跃
    async updateStreak(userId: string) {
        const profile = await this.getUserStatus(userId);
        const now = new Date();
        const lastActivity = profile.last_activity_at ? new Date(profile.last_activity_at) : null;

        let currentStreak = profile.current_streak;

        if (lastActivity) {
            const diffHours = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
            const isSameDay = now.getDate() === lastActivity.getDate() &&
                now.getMonth() === lastActivity.getMonth() &&
                now.getFullYear() === lastActivity.getFullYear();

            if (isSameDay) {
                // 同一天，只更新最后活动时间，不增加 streak
                return await this.prisma.gamificationProfile.update({
                    where: { id: profile.id },
                    data: { last_activity_at: now }
                });
            } else if (diffHours < 48) {
                // 实际上应该是判断是否是"昨天"
                // 简单判断: 间隔小于48小时且不是同一天，算连续
                currentStreak++;
            } else {
                // 断签
                currentStreak = 1;
            }
        } else {
            currentStreak = 1;
        }

        return await this.prisma.gamificationProfile.update({
            where: { id: profile.id },
            data: {
                current_streak: currentStreak,
                longest_streak: Math.max(currentStreak, profile.longest_streak),
                last_activity_at: now,
            },
        });
    }

    // 解锁成就
    async unlockAchievement(userId: string, achievementId: string, metadata?: any) {
        const existing = await this.prisma.userAchievement.findUnique({
            where: {
                user_id_achievement_id: {
                    user_id: userId,
                    achievement_id: achievementId,
                },
            },
        });

        if (existing) return existing;

        const achievement = await this.prisma.userAchievement.create({
            data: {
                user_id: userId,
                achievement_id: achievementId,
                metadata: metadata || {},
            },
        });

        this.logger.log(`User ${userId} unlocked achievement: ${achievementId}`);
        return achievement;
    }

    // 获取用户成就
    async getUserAchievements(userId: string) {
        return await this.prisma.userAchievement.findMany({
            where: { user_id: userId },
        });
    }
}
