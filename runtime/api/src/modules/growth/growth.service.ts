import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * 增长目标。
 *
 * 修复前这个 service **一行数据库都没查** —— `getGrowthPlan` 直接 return
 * 一份写死的对象（followers: 10000、两条固定策略），前端 growth 页面
 * 又另有一份 `mockGrowthData`。也就是说前后端各自编了一套假数据，
 * 而 `GrowthGoal` 模型早就在 schema 里了。
 *
 * 另一处：原签名收 `tenantId`，但 `GrowthGoal` 上的字段是 **`user_id`**。
 * 即便当时接了库也会查不到任何东西 —— 参数名和字段名对不上。
 */
@Injectable()
export class GrowthService {
  private readonly logger = new Logger(GrowthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGrowthPlan(userId: string) {
    const goals = await this.prisma.growthGoal.findMany({
      where: { user_id: userId, status: 'active' },
      orderBy: { end_date: 'asc' },
    });

    // BigInt 不能直接 JSON 序列化，转成 number 再返回
    const serialized = goals.map((g) => ({
      id: g.id,
      targetType: g.target_type,
      targetValue: Number(g.target_value),
      currentValue: Number(g.current_value),
      periodType: g.period_type,
      startDate: g.start_date,
      endDate: g.end_date,
      status: g.status,
      progress:
        Number(g.target_value) > 0
          ? Math.min(Number(g.current_value) / Number(g.target_value), 1)
          : 0,
    }));

    return {
      goals: serialized,
      // 没有目标就如实说没有，不要编一个「当前处于第 1 阶段」出来
      hasGoals: serialized.length > 0,
    };
  }

  async updateGrowthPlan(
    userId: string,
    data: {
      targetType: string;
      targetValue: number;
      periodType?: string;
      startDate: string | Date;
      endDate: string | Date;
    },
  ) {
    const goal = await this.prisma.growthGoal.create({
      data: {
        user_id: userId,
        target_type: data.targetType,
        target_value: BigInt(Math.max(0, Math.floor(data.targetValue))),
        period_type: data.periodType ?? 'monthly',
        start_date: new Date(data.startDate),
        end_date: new Date(data.endDate),
      },
    });

    this.logger.log(`增长目标已创建: user=${userId} type=${goal.target_type}`);

    return {
      id: goal.id,
      targetType: goal.target_type,
      targetValue: Number(goal.target_value),
      currentValue: Number(goal.current_value),
      startDate: goal.start_date,
      endDate: goal.end_date,
      status: goal.status,
    };
  }
}
