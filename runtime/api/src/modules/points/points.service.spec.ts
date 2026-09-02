import { PointsService } from './points.service';

function makeFixture(lastCheckInDate: Date | null) {
  const record = {
    id: 'points-1',
    user_id: 'user-1',
    balance: 100,
    total_earned: 100,
    total_spent: 0,
    streak_days: 2,
    longest_streak: 2,
    experience_points: 100,
    level: 1,
    last_checkin_date: lastCheckInDate,
  };
  const prisma: any = {
    userPoints: {
      findUnique: jest.fn(async () => record),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    pointsLog: { create: jest.fn(async () => ({ id: 'log-1' })) },
  };
  return { service: new PointsService(prisma), prisma };
}

describe('PointsService 国内签到日界线', () => {
  afterEach(() => jest.useRealTimers());

  it('北京时间跨日后可再次签到，条件更新使用北京零点', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T16:30:00.000Z'));
    const { service, prisma } = makeFixture(new Date('2026-09-03T15:59:00.000Z'));

    const result = await service.checkIn('user-1');

    expect(result.success).toBe(true);
    expect(prisma.userPoints.updateMany).toHaveBeenCalledTimes(1);
    const args = prisma.userPoints.updateMany.mock.calls[0][0];
    expect(args.where.OR[1].last_checkin_date.lt.toISOString()).toBe(
      '2026-09-03T16:00:00.000Z',
    );
  });

  it('北京时间同一天内不重复发放积分', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T16:30:00.000Z'));
    const { service, prisma } = makeFixture(new Date('2026-09-03T16:10:00.000Z'));

    const result = await service.checkIn('user-1');

    expect(result).toMatchObject({ success: false, points_earned: 0, balance: 100 });
    expect(prisma.userPoints.updateMany).not.toHaveBeenCalled();
    expect(prisma.pointsLog.create).not.toHaveBeenCalled();
  });
});
