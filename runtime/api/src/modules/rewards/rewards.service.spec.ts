import { BadRequestException } from '@nestjs/common';
import { RewardsService } from './rewards.service';

/**
 * 积分兑换的并发安全测试。
 *
 * 修复前 redeemReward 是「先查后写」：
 *   1. 读余额 → 判断够不够 → decrement          （两个并发请求都能通过 → 余额变负）
 *   2. 读库存 → 判断有没有 → `stock: stock - 1` （绝对写入，两个请求都写同一个值 → 超卖）
 *   3. count 兑换次数 → create                   （同样可被并发绕过）
 * 且四次写入没有事务，中途失败会留下「扣了分没拿到奖励」。
 *
 * 这里用假 prisma 断言的是**修复后的调用形态**：
 * 条件更新 + 受影响行数判断 + 单事务。形态回退了测试就会红。
 */

type Call = { model: string; op: string; args: any };

function makeFakePrisma(overrides: {
  reward?: any;
  pointsUpdateCount?: number;
  stockUpdateCount?: number;
  redeemedCount?: number;
  balanceAfter?: number;
}) {
  const calls: Call[] = [];
  const reward = overrides.reward ?? {
    id: 'r1',
    name: '测试奖励',
    is_active: true,
    points_required: 100,
    stock: 5,
    stock_unlimited: false,
    usage_limit_per_user: 1,
    expires_at: null,
  };

  const tx = {
    userPoints: {
      updateMany: jest.fn(async (args: any) => {
        calls.push({ model: 'userPoints', op: 'updateMany', args });
        return { count: overrides.pointsUpdateCount ?? 1 };
      }),
      update: jest.fn(async (args: any) => {
        calls.push({ model: 'userPoints', op: 'update', args });
        return { balance: overrides.balanceAfter ?? 0 };
      }),
      findUnique: jest.fn(async () => ({ balance: overrides.balanceAfter ?? 400 })),
    },
    reward: {
      updateMany: jest.fn(async (args: any) => {
        calls.push({ model: 'reward', op: 'updateMany', args });
        return { count: overrides.stockUpdateCount ?? 1 };
      }),
      update: jest.fn(async (args: any) => {
        calls.push({ model: 'reward', op: 'update', args });
        return reward;
      }),
    },
    redemptionRecord: {
      count: jest.fn(async () => overrides.redeemedCount ?? 0),
      findMany: jest.fn(async () => []),
      create: jest.fn(async (args: any) => {
        calls.push({ model: 'redemptionRecord', op: 'create', args });
        return { id: 'rec1', ...args.data };
      }),
    },
    pointsLog: {
      create: jest.fn(async (args: any) => {
        calls.push({ model: 'pointsLog', op: 'create', args });
        return { id: 'log1' };
      }),
    },
  };

  const prisma: any = {
    ...tx,
    reward: { ...tx.reward, findUnique: jest.fn(async () => reward) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };

  return { prisma, tx, calls, reward };
}

function makeService(prisma: any): RewardsService {
  return new RewardsService(prisma);
}

describe('RewardsService.redeemReward — 并发安全', () => {
  it('全部写入发生在同一个事务里', async () => {
    const { prisma } = makeFakePrisma({});
    await makeService(prisma).redeemReward('u1', 'r1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('扣积分用带余额条件的 updateMany，而不是无条件 decrement', async () => {
    const { prisma, tx } = makeFakePrisma({});
    await makeService(prisma).redeemReward('u1', 'r1');

    expect(tx.userPoints.updateMany).toHaveBeenCalledTimes(1);
    const args = tx.userPoints.updateMany.mock.calls[0][0];
    // 关键：where 里必须有余额下界，否则并发可扣成负数
    expect(args.where.balance).toEqual({ gte: 100 });
    expect(args.data.balance).toEqual({ decrement: 100 });
  });

  it('余额不足时（影响 0 行）抛错且不建兑换记录', async () => {
    const { prisma, tx } = makeFakePrisma({ pointsUpdateCount: 0 });
    await expect(makeService(prisma).redeemReward('u1', 'r1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.redemptionRecord.create).not.toHaveBeenCalled();
  });

  it('扣库存用 decrement + stock>0 条件，不是读后绝对写入', async () => {
    const { prisma, tx } = makeFakePrisma({});
    await makeService(prisma).redeemReward('u1', 'r1');

    expect(tx.reward.updateMany).toHaveBeenCalledTimes(1);
    const args = tx.reward.updateMany.mock.calls[0][0];
    expect(args.where.stock).toEqual({ gt: 0 });
    expect(args.data.stock).toEqual({ decrement: 1 });
    // 绝对写入是超卖的根因，必须已经消失
    expect(tx.reward.update).not.toHaveBeenCalled();
  });

  it('库存被并发抢完时抛错（事务回滚会退回积分）', async () => {
    const { prisma, tx } = makeFakePrisma({ stockUpdateCount: 0 });
    await expect(makeService(prisma).redeemReward('u1', 'r1')).rejects.toThrow('售罄');
    expect(tx.redemptionRecord.create).not.toHaveBeenCalled();
  });

  it('无限库存的奖励不扣库存', async () => {
    const { prisma, tx } = makeFakePrisma({
      reward: {
        id: 'r1', name: '无限', is_active: true, points_required: 10,
        stock: null, stock_unlimited: true, usage_limit_per_user: 99, expires_at: null,
      },
    });
    await makeService(prisma).redeemReward('u1', 'r1');
    expect(tx.reward.updateMany).not.toHaveBeenCalled();
  });

  it('达到每人限兑次数时抛错', async () => {
    const { prisma, tx } = makeFakePrisma({ redeemedCount: 1 });
    await expect(makeService(prisma).redeemReward('u1', 'r1')).rejects.toThrow('上限');
    expect(tx.redemptionRecord.create).not.toHaveBeenCalled();
  });

  it('限兑次数的 count 在事务内执行', async () => {
    const { prisma, tx } = makeFakePrisma({});
    await makeService(prisma).redeemReward('u1', 'r1');
    expect(tx.redemptionRecord.count).toHaveBeenCalled();
  });

  it('流水里的余额取自库里的真实值', async () => {
    const { prisma, tx } = makeFakePrisma({ balanceAfter: 300 });
    await makeService(prisma).redeemReward('u1', 'r1');
    const log = tx.pointsLog.create.mock.calls[0][0].data;
    expect(log.balance_after).toBe(300);
    expect(log.balance_before).toBe(400); // 300 + 100
    expect(log.points_change).toBe(-100);
  });

  it('已下架的奖励不进事务', async () => {
    const { prisma } = makeFakePrisma({
      reward: {
        id: 'r1', name: 'x', is_active: false, points_required: 1,
        stock: 1, stock_unlimited: false, usage_limit_per_user: 1, expires_at: null,
      },
    });
    await expect(makeService(prisma).redeemReward('u1', 'r1')).rejects.toThrow('下架');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
