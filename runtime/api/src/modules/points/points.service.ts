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
    //
    // 上面「今日是否已签到」的判断与这里的写入之间存在竞态：
    // 连点两下签到按钮，两个请求都读到 last_checkin_date 是昨天，
    // 都通过判断、都加分 —— 一天领两次。
    // 改为条件更新：只在 last_checkin_date 仍早于今天时才生效。
    const checkinUpdate = await this.prisma.userPoints.updateMany({
      where: {
        user_id: userId,
        OR: [
          { last_checkin_date: null },
          { last_checkin_date: { lt: today } },
        ],
      },
      data: {
        balance: { increment: totalPoints },
        total_earned: { increment: totalPoints },
        streak_days: newStreakDays,
        last_checkin_date: now,
        experience_points: { increment: totalPoints },
        level: this.calculateLevel(userPoints.experience_points + totalPoints),
      },
    });

    if (checkinUpdate.count === 0) {
      // 另一个并发请求刚刚签到成功
      const current = await this.prisma.userPoints.findUnique({
        where: { user_id: userId },
      });
      return {
        success: false,
        points_earned: 0,
        streak_days: current?.streak_days ?? userPoints.streak_days,
        balance: current?.balance ?? userPoints.balance,
        message: '今日已签到，明天再来吧！',
      };
    }

    const updatedPoints = await this.prisma.userPoints.findUnique({
      where: { user_id: userId },
    });
    const balanceAfter = updatedPoints?.balance ?? userPoints.balance + totalPoints;

    // 记录积分日志
    await this.prisma.pointsLog.create({
      data: {
        user_id: userId,
        points_change: totalPoints,
        balance_before: balanceAfter - totalPoints,
        balance_after: balanceAfter,
        log_type: 'checkin',
        description: `签到获得积分，连续签到 ${newStreakDays} 天`,
      },
    });

    return {
      success: true,
      points_earned: totalPoints,
      streak_days: newStreakDays,
      balance: balanceAfter,
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
   *
   * 原实现「先判断 balance < amount，再 decrement」是典型双花：
   * 两个并发请求都通过判断、都执行扣减，余额变负数。
   * 现改为带条件的 updateMany —— 余额不足时影响 0 行，由数据库保证原子性。
   */
  async spendPoints(userId: string, amount: number, logType: string, description: string, relatedId?: string) {
    if (amount <= 0) {
      throw new BadRequestException('消耗积分必须为正数');
    }

    await this.getOrCreateUserPoints(userId);

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.userPoints.updateMany({
        where: { user_id: userId, balance: { gte: amount } },
        data: {
          balance: { decrement: amount },
          total_spent: { increment: amount },
        },
      });

      if (updated.count === 0) {
        const current = await tx.userPoints.findUnique({ where: { user_id: userId } });
        throw new BadRequestException(
          `积分不足，需要 ${amount} 积分，当前余额 ${current?.balance ?? 0}`,
        );
      }

      const after = await tx.userPoints.findUnique({ where: { user_id: userId } });
      const balanceAfter = after?.balance ?? 0;

      await tx.pointsLog.create({
        data: {
          user_id: userId,
          points_change: -amount,
          balance_before: balanceAfter + amount,
          balance_after: balanceAfter,
          log_type: logType,
          description,
          related_id: relatedId,
        },
      });

      return {
        success: true,
        points_spent: amount,
        balance: balanceAfter,
      };
    });
  }

  /**
   * 计算等级
   */
  private calculateLevel(xp: number): number {
    return Math.floor(xp / 1000) + 1;
  }
}
