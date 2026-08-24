import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

export interface RewardInfo {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string;
  points_required: number;
  stock: number | null;
  stock_unlimited: boolean;
  is_active: boolean;
  is_featured: boolean;
  reward_details: any;
}

export interface RedemptionResult {
  success: boolean;
  record_id: string;
  reward_name: string;
  points_spent: number;
  balance: number;
  redeem_code: string | null;
  message: string;
}

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取所有可用奖励
   */
  async getAvailableRewards(category?: string): Promise<RewardInfo[]> {
    const where: any = { is_active: true };
    if (category) {
      where.category = category;
    }

    const rewards = await this.prisma.reward.findMany({
      where,
      orderBy: [{ is_featured: 'desc' }, { sort_order: 'asc' }, { points_required: 'asc' }],
    });

    return rewards;
  }

  /**
   * 获取奖励详情
   */
  async getRewardById(rewardId: string): Promise<RewardInfo> {
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      throw new NotFoundException('奖励不存在');
    }

    return reward;
  }

  /**
   * 兑换奖励
   */
  async redeemReward(userId: string, rewardId: string): Promise<RedemptionResult> {
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward) {
      throw new NotFoundException('奖励不存在');
    }

    if (!reward.is_active) {
      throw new BadRequestException('该奖励已下架');
    }

    if (!reward.stock_unlimited && reward.stock !== null && reward.stock <= 0) {
      throw new BadRequestException('该奖励已售罄');
    }

    const userPoints = await this.prisma.userPoints.findUnique({
      where: { user_id: userId },
    });

    if (!userPoints || userPoints.balance < reward.points_required) {
      throw new BadRequestException(`积分不足，需要 ${reward.points_required} 积分`);
    }

    const existingRedemptions = await this.prisma.redemptionRecord.findMany({
      where: {
        user_id: userId,
        reward_id: rewardId,
        status: { in: ['pending', 'completed'] },
      },
    });

    if (existingRedemptions.length >= reward.usage_limit_per_user) {
      throw new BadRequestException('您已达到该奖励的兑换上限');
    }

    const redeemCode = this.generateRedeemCode();

    const updatedPoints = await this.prisma.userPoints.update({
      where: { user_id: userId },
      data: {
        balance: { decrement: reward.points_required },
        total_spent: { increment: reward.points_required },
      },
    });

    if (!reward.stock_unlimited && reward.stock !== null) {
      await this.prisma.reward.update({
        where: { id: rewardId },
        data: { stock: reward.stock - 1 },
      });
    }

    const record = await this.prisma.redemptionRecord.create({
      data: {
        user_id: userId,
        reward_id: rewardId,
        points_spent: reward.points_required,
        status: 'completed',
        redeem_code: redeemCode,
        code_used_at: new Date(),
        used_at: new Date(),
        expires_at: reward.expires_at,
      },
    });

    await this.prisma.pointsLog.create({
      data: {
        user_id: userId,
        points_change: -reward.points_required,
        balance_before: userPoints.balance,
        balance_after: updatedPoints.balance,
        log_type: 'reward_redeem',
        description: `兑换奖励: ${reward.name}`,
        related_id: record.id,
      },
    });

    return {
      success: true,
      record_id: record.id,
      reward_name: reward.name,
      points_spent: reward.points_required,
      balance: updatedPoints.balance,
      redeem_code: redeemCode,
      message: `成功兑换 "${reward.name}"！兑换码: ${redeemCode}`,
    };
  }

  /**
   * 获取用户兑换记录
   */
  async getUserRedemptions(userId: string, page = 1, limit = 20) {
    const [records, total] = await Promise.all([
      this.prisma.redemptionRecord.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.redemptionRecord.count({ where: { user_id: userId } }),
    ]);

    return {
      records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * 使用兑换码
   */
  async useRedeemCode(userId: string, redeemCode: string) {
    const record = await this.prisma.redemptionRecord.findFirst({
      where: {
        user_id: userId,
        redeem_code: redeemCode,
        status: 'completed',
      },
    });

    if (!record) {
      throw new NotFoundException('兑换码不存在或已使用');
    }

    if (record.used_at) {
      throw new BadRequestException('该兑换码已使用');
    }

    await this.prisma.redemptionRecord.update({
      where: { id: record.id },
      data: {
        used_at: new Date(),
        used_details: { used_at: new Date().toISOString() },
      },
    });

    return { success: true, message: '兑换码使用成功！' };
  }

  private generateRedeemCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'FX-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
      if (i === 3) code += '-';
    }
    return code;
  }
}
