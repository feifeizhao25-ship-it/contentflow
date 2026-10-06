import { AnalyticsService } from './analytics.service';
import { chinaWeekStart, failureReasonText, summarizePublish, ENGAGEMENT_UNAVAILABLE } from './own-data-overview';

/** 审计 P0-2：数据分析页原来整页写死；现在只给自有数据，互动数据接通授权前不给数字。 */
describe('AnalyticsService.getOverview（只用自有数据）', () => {
  const now = new Date('2026-10-08T02:00:00Z'); // 北京时间 10 月 8 日（周四）10:00

  function build() {
    const prisma = {
      publishTask: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'published', _count: { _all: 2 } },
          { status: 'failed', _count: { _all: 3 } },
          { status: 'queued', _count: { _all: 1 } },
          { status: 'manual_pending', _count: { _all: 2 } },
          { status: 'manual_done', _count: { _all: 1 } },
        ]),
        findMany: jest.fn().mockResolvedValue([
          { error_code: 'ADAPTER_NOT_INTEGRATED', error_message: '抖音开放平台尚未接入' },
          { error_code: 'ADAPTER_NOT_INTEGRATED', error_message: '抖音开放平台尚未接入' },
          { error_code: 'DISPATCH_FAILED', error_message: 'ECONNREFUSED 10.0.0.1:443' },
        ]),
      },
      aIGeneration: {
        groupBy: jest.fn().mockResolvedValue([
          { generation_type: 'article', _count: { _all: 4 } },
          { generation_type: 'titles', _count: { _all: 6 } },
        ]),
      },
      content: { count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValue(0) },
    } as any;
    return { prisma, service: new AnalyticsService(prisma) };
  }

  it('按任务真实状态统计，含人工发布两种状态；互动数据不给数字', async () => {
    const { service } = build();
    const result = await service.getOverview('t1', now);
    expect(result.week.publish).toEqual({ total: 9, published: 2, failed: 3, inProgress: 1, manualPending: 2, manualDone: 1, cancelled: 0 });
    expect(result.engagement).toEqual(ENGAGEMENT_UNAVAILABLE);
    expect(result.engagement.message).toBe('接通平台授权后显示');
    expect(JSON.stringify(result.engagement)).not.toMatch(/\d/);
  });

  it('失败原因全是中文，按次数排序；英文原文不外露', async () => {
    const { service } = build();
    const result = await service.getOverview('t1', now);
    expect(result.failureReasons).toEqual([
      { reason: '抖音开放平台尚未接入', count: 2 },
      { reason: '发布服务调用失败', count: 1 },
    ]);
    expect(JSON.stringify(result.failureReasons)).not.toMatch(/ECONNREFUSED/);
  });

  it('AI 生成次数按类型汇总并给中文名，采纳 = 保存进内容库 / 其中已通过或已发布', async () => {
    const { service, prisma } = build();
    const result = await service.getOverview('t1', now);
    expect(result.week.ai.generations).toBe(10);
    expect(result.week.ai.byType[0]).toEqual({ type: 'titles', label: '标题', count: 6 });
    expect(result.week.ai.savedAsContent).toBe(3);
    expect(result.week.ai.approvedOrPublished).toBe(1);
    // 只查本工作区
    for (const call of prisma.publishTask.groupBy.mock.calls) expect(call[0].where.tenant_id).toBe('t1');
    for (const call of prisma.aIGeneration.groupBy.mock.calls) expect(call[0].where.tenant_id).toBe('t1');
  });

  it('本周从北京时间周一 0 点算，本月从北京时间 1 日 0 点算', async () => {
    const { service } = build();
    const result = await service.getOverview('t1', now);
    expect(result.week.start).toBe('2026-10-04T16:00:00.000Z'); // 10 月 5 日（周一）0:00 北京时间
    expect(result.month.start).toBe('2026-09-30T16:00:00.000Z');
    expect(chinaWeekStart(new Date('2026-10-04T15:59:00Z')).toISOString()).toBe('2026-09-27T16:00:00.000Z'); // 北京时间周日 23:59 仍属上一周
  });

  it('工具函数：没有中文原因时按错误码给中文，未知时如实说未记录', () => {
    expect(failureReasonText('QUEUE_UNAVAILABLE', 'redis down')).toBe('发布队列暂时不可用');
    expect(failureReasonText(null, 'timeout')).toBe('发布失败（未记录具体原因）');
    expect(summarizePublish([]).total).toBe(0);
  });
});

describe('统计窗口', () => {
  it('本周包括本周晚些时候才计划发布的任务（窗口到下周一 0 点），本月到下月 1 日 0 点', () => {
    const { overviewWindows } = jest.requireActual('./own-data-overview');
    const w = overviewWindows(new Date('2026-10-08T01:30:00Z'));
    expect(w.week.end.toISOString()).toBe('2026-10-11T16:00:00.000Z');
    expect(w.month.end.toISOString()).toBe('2026-10-31T16:00:00.000Z');
    const dec = overviewWindows(new Date('2026-12-20T00:00:00Z'));
    expect(dec.month.end.toISOString()).toBe('2026-12-31T16:00:00.000Z');
  });
});
