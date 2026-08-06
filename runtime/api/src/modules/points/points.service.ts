import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export interface CheckInResult {
  success: boolean;
  points_earned: number;
  streak_days: number;
  balance: number;
  message: string;
}

export interface PointsInfo {
  balance: number;
  total_earned: number;
  total_spent: number;
  streak_days: number;
  level: number;
  experience_points: number;
  next_level_xp: number;
}

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取或创建用户积分记录
   */
  async getOrCreateUserPoints(userId: string) {
    let userPoints = await this.prisma.userPoints.findUnique({
      where: { user_id: userId },
    });

    if (!userPoints) {
      userPoints = await this.prisma.userPoints.create({
        data: { user_id: userId },
      });
    }

    return userPoints;
  }

  /**
   * 执行签到
   */
  async checkIn(userId: string): Promise<CheckInResult> {
    const userPoints = await this.getOrCreateUserPoints(userId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 检查今日是否已签到
    if (userPoints.last_checkin_date) {
      const lastCheckIn = new Date(userPoints.last_checkin_date);
      const lastCheckInDay = new Date(
        lastCheckIn.getFullYear(),
        lastCheckIn.getMonth(),
        lastCheckIn.getDate()
      );

      if (lastCheckInDay.getTime() === today.getTime()) {
        return {
          success: false,
          points_earned: 0,
          streak_days: userPoints.streak_days,
          balance: userPoints.balance,
          message: '今日已签到，明天再来吧！',
        };
      }
    }

    // 计算连续签到天数
    let newStreakDays = 1;
    if (userPoints.last_checkin_date) {
      const lastCheckIn = new Date(userPoints.last_checkin_date);
      const lastCheckInDay = new Date(
        lastCheckIn.getFullYear(),
        lastCheckIn.getMonth(),
        lastCheckIn.getDate()
      );

      // 如果昨天签到了，连续天数+1
      if (lastCheckInDay.getTime() === yesterday.getTime()) {
        newStreakDays = userPoints.streak_days + 1;
      }
    }

    // 计算签到积分（连续天数越多，积分越多）
    const basePoints = 10;
    const bonusPoints = Math.min(newStreakDays * 5, 50); // 最多额外50分
    const totalPoints = basePoints + bonusPoints;

    // 更新用户积分
    const updatedPoints = await this.prisma.userPoints.update({
      where: { user_id: userId },
      data: {
        balance: { increment: totalPoints },
        total_earned: { increment: totalPoints },
        streak_days: newStreakDays,
        last_checkin_date: now,
        experience_points: { increment: totalPoints },
        level: this.calculateLevel(userPoints.experience_points + totalPoints),
      },
    });

    // 记录积分日志
    await this.prisma.pointsLog.create({
      data: {
        user_id: userId,
        points_change: totalPoints,
        balance_before: userPoints.balance,
        balance_after: updatedPoints.balance,
        log_type: 'checkin',
        description: `签到获得积分，连续签到 ${newStreakDays} 天`,
      },
    });

    return {
      success: true,
      points_earned: totalPoints,
      streak_days: newStreakDays,
      balance: updatedPoints.balance,
      message: `签到成功！获得 ${totalPoints} 积分（基础 ${basePoints} + 连续签到奖励 ${bonusPoints}）`,
    };
  }

  /**
   * 获取用户积分信息
   */
  async getPointsInfo(userId: string): Promise<PointsInfo> {
    const userPoints = await this.getOrCreateUserPoints(userId);
    const nextLevelXp = (userPoints.level + 1) * 1000;

    return {
      balance: userPoints.balance,
      total_earned: userPoints.total_earned,
      total_spent: userPoints.total_spent,
      streak_days: userPoints.streak_days,
      level: userPoints.level,
      experience_points: userPoints.experience_points,
      next_level_xp: nextLevelXp,
    };
  }

  /**
   * 获取用户积分（简版）
   */
  async getUserPoints(userId: string) {
    return this.getOrCreateUserPoints(userId);
  }

  /**
   * 获取用户积分统计
   */
  async getUserPointsStats(userId: string) {
    const userPoints = await this.getOrCreateUserPoints(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今日是否已签到
    const checkedInToday = userPoints.last_checkin_date 
      ? new Date(userPoints.last_checkin_date) >= today 
      : false;

    return {
      balance: userPoints.balance,
      level: userPoints.level,
      experience_points: userPoints.experience_points,
      next_level_xp: (userPoints.level + 1) * 1000,
      streak_days: userPoints.streak_days,
      longest_streak: userPoints.longest_streak,
      checked_in_today: checkedInToday,
      total_earned: userPoints.total_earned,
      total_spent: userPoints.total_spent,
    };
  }

  /**
   * 获取积分日志
   */
  async getPointsLogs(userId: string, page = 1, limit = 20) {
    const [logs, total] = await Promise.all([
      this.prisma.pointsLog.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pointsLog.count({ where: { user_id: userId } }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 完成任务获得积分
   */
  async awardTaskPoints(userId: string, taskId: string, points: number, description?: string) {
    const userPoints = await this.getOrCreateUserPoints(userId);

    const updatedPoints = await this.prisma.userPoints.update({
      where: { user_id: userId },
      data: {
        balance: { increment: points },
        total_earned: { increment: points },
        experience_points: { increment: points },
        level: this.calculateLevel(userPoints.experience_points + points),
      },
    });

    await this.prisma.pointsLog.create({
      data: {
        user_id: userId,
        points_change: points,
        balance_before: userPoints.balance,
        balance_after: updatedPoints.balance,
        log_type: 'task_complete',
        description: description || '完成任务获得积分',
        related_id: taskId,
      },
    });

    return {
      success: true,
      points_earned: points,
      balance: updatedPoints.balance,
    };
  }

  /**
   * 消耗积分
   */
  async spendPoints(userId: string, amount: number, logType: string, description: string, relatedId?: string) {
    const userPoints = await this.getOrCreateUserPoints(userId);

    if (userPoints.balance < amount) {
      throw new BadRequestException(`积分不足，需要 ${amount} 积分，当前余额 ${userPoints.balance}`);
    }

    const updatedPoints = await this.prisma.userPoints.update({
      where: { user_id: userId },
      data: {
        balance: { decrement: amount },
        total_spent: { increment: amount },
      },
    });

    await this.prisma.pointsLog.create({
      data: {
        user_id: userId,
        points_change: -amount,
        balance_before: userPoints.balance,
        balance_after: updatedPoints.balance,
        log_type: logType,
        description,
        related_id: relatedId,
      },
    });

    return {
      success: true,
      points_spent: amount,
      balance: updatedPoints.balance,
    };
  }

  /**
   * 计算等级
   */
  private calculateLevel(xp: number): number {
    return Math.floor(xp / 1000) + 1;
  }
}
