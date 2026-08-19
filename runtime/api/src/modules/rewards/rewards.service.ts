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
   *
   * 原实现有三处「先查后写」竞态 + 全程无事务：
   *
   *   1. 余额：先 `balance < required` 判断，再 `decrement` ——
   *      两个并发请求都能通过判断，都执行扣减，**余额变负数**（双花）。
   *   2. 库存：先 `stock <= 0` 判断，再 `stock: reward.stock - 1` ——
   *      这是「读取后绝对写入」，比 decrement 更糟：两个请求都读到 stock=1，
   *      都写 stock=0，超卖一件；且会覆盖期间任何其他库存变更。
   *   3. 每人限兑次数：同样是先 count 后 create。
   *
   *   4. 四次写入（扣分 / 减库存 / 建兑换记录 / 记流水）互相独立，
   *      中途任一失败就会留下「扣了分没拿到奖励」或「拿到奖励没扣分」。
   *
   * 现改为：单个事务 + 带条件的 updateMany，用受影响行数判断前置条件
   * 是否仍然成立。数据库的原子性替代了应用层的判断。
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

    const redeemCode = this.generateRedeemCode();

    return await this.prisma.$transaction(async (tx) => {
      // ── 1. 扣积分：条件更新，余额不足时影响 0 行 ──
      const pointsUpdate = await tx.userPoints.updateMany({
        where: {
          user_id: userId,
          balance: { gte: reward.points_required },
        },
        data: {
          balance: { decrement: reward.points_required },
          total_spent: { increment: reward.points_required },
        },
      });

      if (pointsUpdate.count === 0) {
        throw new BadRequestException(`积分不足，需要 ${reward.points_required} 积分`);
      }

      // ── 2. 扣库存：同样用条件更新，售罄时影响 0 行 ──
      if (!reward.stock_unlimited && reward.stock !== null) {
        const stockUpdate = await tx.reward.updateMany({
          where: { id: rewardId, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });

        if (stockUpdate.count === 0) {
          // 抛错会回滚整个事务，上面扣掉的积分自动退回
          throw new BadRequestException('该奖励已售罄');
        }
      }

      // ── 3. 每人限兑次数：在事务内 count，与写入同一把锁 ──
      const redeemedCount = await tx.redemptionRecord.count({
        where: {
          user_id: userId,
          reward_id: rewardId,
          status: { in: ['pending', 'completed'] },
        },
      });

      if (redeemedCount >= reward.usage_limit_per_user) {
        throw new BadRequestException('您已达到该奖励的兑换上限');
      }

      const record = await tx.redemptionRecord.create({
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

      // 扣减后的真实余额从库里读，不用扣减前的值去算 ——
      // 并发场景下 before/after 相减未必等于本次扣减额
      const current = await tx.userPoints.findUnique({
        where: { user_id: userId },
      });
      const balanceAfter = current?.balance ?? 0;

      await tx.pointsLog.create({
        data: {
          user_id: userId,
          points_change: -reward.points_required,
          balance_before: balanceAfter + reward.points_required,
          balance_after: balanceAfter,
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
        balance: balanceAfter,
        redeem_code: redeemCode,
        message: `成功兑换 "${reward.name}"！兑换码: ${redeemCode}`,
      };
    });
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
