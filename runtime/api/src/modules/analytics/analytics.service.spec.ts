import { AnalyticsService } from './analytics.service';

describe('AnalyticsService.getDashboard', () => {
  const range = { start: new Date('2026-09-01'), end: new Date('2026-09-30') };

  function build(rows: Array<{ status: string; n: number }>) {
    const prisma = {
      publishTask: { groupBy: jest.fn().mockResolvedValue(rows.map((r) => ({ status: r.status, _count: { _all: r.n } }))) },
      content: { findMany: jest.fn().mockResolvedValue([{ status: 'draft', content_type: 'article' }]) },
      platformAccount: { findMany: jest.fn().mockResolvedValue([{ platform: 'douyin', follower_count: 12 }]) },
    } as any;
    return { prisma, service: new AnalyticsService(prisma) };
  }

  it('发布成功 / 失败数按任务状态统计，不是写死的 0', async () => {
    const { service, prisma } = build([
      { status: 'published', n: 7 }, { status: 'failed', n: 2 }, { status: 'queued', n: 3 }, { status: 'submitted_unconfirmed', n: 1 },
    ]);
    const result = await service.getDashboard('t1', range);
    expect(result.publish).toEqual({ total: 13, success: 7, failed: 2 });
    expect(prisma.publishTask.groupBy.mock.calls[0][0].where.tenant_id).toBe('t1');
  });

  it('没有任务时全是 0（真实的 0）', async () => {
    const { service } = build([]);
    expect((await service.getDashboard('t1', range)).publish).toEqual({ total: 0, success: 0, failed: 0 });
  });
});
