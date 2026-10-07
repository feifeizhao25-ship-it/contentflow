/**
 * 发布中心：筛选、批量重试、导出日志。
 *
 * 原来这几个控件都没有绑定事件，后端列表也只认 status。走真实 configureApp + supertest，
 * 只替换登录守卫和数据库。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { PublishQueueService } from '../../queue/publish-queue.service';
import { TenantService } from '../tenant/tenant.service';
import { AdapterRegistry } from './adapters/adapter.registry';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';
import { csvCell, parsePublishTaskFilter, publishTaskWhere, publishTasksToCsv, PUBLISH_LOG_HEADERS } from './publish-log';

const sampleTasks = [
  {
    id: 'task-1', tenant_id: 't-mine', status: 'failed', publish_type: 'immediate', retry_count: 2,
    scheduled_at: new Date('2026-10-06T12:30:00Z'), created_at: new Date('2026-10-06T12:00:00Z'), completed_at: null,
    error_code: 'CHANNEL_NOT_LIVE', error_message: '抖音开放平台尚未接入', platform_post_url: null,
    content: { title: '=HYPERLINK("http://evil")' }, platform_account: { platform: 'douyin', account_nickname: '小林的店' }, platform_content: null,
  },
  {
    id: 'task-2', tenant_id: 't-mine', status: 'manual_done', publish_type: 'manual', retry_count: 0,
    scheduled_at: new Date('2026-10-05T01:00:00Z'), created_at: new Date('2026-10-05T00:59:00Z'), completed_at: new Date('2026-10-05T02:00:00Z'),
    error_code: null, error_message: null, platform_post_url: 'https://www.xiaohongshu.com/explore/abc',
    content: { title: '寒露秋燥, "护肤"笔记' }, platform_account: null, platform_content: { platform: 'xhs' },
  },
];

describe('发布中心：筛选、批量重试、导出日志', () => {
  let app: INestApplication;
  let me: { sub: string; tenantId: string; role: string };
  const prisma = {
    publishTask: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  };
  const queue = { retryPublishTask: jest.fn() };
  const adapters = { get: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    me = { sub: 'u-me', tenantId: 't-mine', role: 'member' };
    prisma.publishTask.findMany.mockResolvedValue(sampleTasks);
    prisma.publishTask.count.mockResolvedValue(2);
    const moduleRef = await Test.createTestingModule({
      controllers: [PublishController],
      providers: [
        PublishService,
        { provide: PrismaService, useValue: prisma },
        { provide: PublishQueueService, useValue: queue },
        { provide: TenantService, useValue: {} },
        { provide: AdapterRegistry, useValue: adapters },
        { provide: ConfigService, useValue: { get: (_k: string, d: unknown) => d } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = me; return true; } })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => app.close());
  const http = () => request(app.getHttpServer());

  it('列表：关键词、平台、状态、日期都会变成查询条件，并且始终限定在本工作区', async () => {
    await http().get(`/api/v1/publish/tasks?keyword=${encodeURIComponent('寒露')}&platform=xhs,douyin&status=success&from=2026-10-05&to=2026-10-07`).expect(200);
    const where = prisma.publishTask.findMany.mock.calls[0][0].where;
    expect(where.tenant_id).toBe('t-mine');
    const flat = JSON.stringify(where);
    expect(flat).toContain('"contains":"寒露"');
    expect(flat).toContain('"in":["xhs","douyin"]');
    expect(flat).toContain('"in":["published","manual_done"]');
    // 北京时间 10-05 0 点 = UTC 10-04 16:00；结束日 10-07 含当天 → 小于 10-08 0 点
    expect(flat).toContain('2026-10-04T16:00:00.000Z');
    expect(flat).toContain('2026-10-07T16:00:00.000Z');
    expect(prisma.publishTask.count.mock.calls[0][0].where).toEqual(where);
  });

  it('列表：不认识的平台、状态、日期返回 400 中文提示，不会悄悄忽略', async () => {
    for (const q of ['platform=facebook', 'status=hacked', 'from=2026-13-01', 'from=2026-02-30', 'from=2026-10-08&to=2026-10-01']) {
      const res = await http().get(`/api/v1/publish/tasks?${q}`);
      expect({ q, status: res.status }).toEqual({ q, status: 400 });
      expect(JSON.stringify(res.body)).toMatch(/[一-鿿]/);
    }
    expect(prisma.publishTask.findMany).not.toHaveBeenCalled();
  });

  it('导出：只导出本工作区，与列表同一筛选；CSV 中文表头、带 BOM、文件名是中文', async () => {
    const res = await http().get('/api/v1/publish/tasks/export?status=failed&platform=douyin').buffer(true).parse((r: any, cb: any) => {
      const chunks: Buffer[] = []; r.on('data', (c: Buffer) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks).toString('utf8')));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''" + encodeURIComponent('发布记录-'));
    const where = prisma.publishTask.findMany.mock.calls[0][0].where;
    expect(where.tenant_id).toBe('t-mine');
    expect(JSON.stringify(where)).toContain('"in":["failed"]');
    const text: string = res.body;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(PUBLISH_LOG_HEADERS.join(','));
    expect(lines[0]).toContain('失败原因');
    // 第 1 条：标题以 = 开头，被加了单引号防公式；北京时间 20:30
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(lines[1]).toContain('抖音');
    expect(lines[1]).toContain('发布失败');
    expect(lines[1]).toContain('2026-10-06 20:30');
    expect(lines[1]).toContain('抖音开放平台尚未接入');
    // 第 2 条：逗号与引号被正确转义；人工发布
    expect(lines[2]).toContain('"寒露秋燥, ""护肤""笔记"');
    expect(lines[2]).toContain('小红书');
    expect(lines[2]).toContain('人工确认发布');
    expect(lines[2]).toContain('已人工发布');
    // 不出现英文状态原文
    expect(text).not.toMatch(/,manual_done,|,failed,|,douyin,|,xhs,/);
  });

  it('批量重试：逐条处理，只重试本工作区的失败任务；通道未接入、他人任务、非失败任务都给中文原因', async () => {
    adapters.get.mockImplementation((platform: string) => ({ isLive: platform === 'bilibili' }));
    prisma.publishTask.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.tenant_id !== 't-mine') return null;
      return ({
        ok: { id: 'ok', status: 'failed', content_id: 'c', platform_account_id: 'a1', platform_account: { platform: 'bilibili' } },
        dy: { id: 'dy', status: 'failed', content_id: 'c', platform_account_id: 'a2', platform_account: { platform: 'douyin' } },
        done: { id: 'done', status: 'published', content_id: 'c', platform_account_id: 'a1', platform_account: { platform: 'bilibili' } },
      } as any)[where.id] ?? null;
    });
    prisma.publishTask.update.mockResolvedValue({});
    queue.retryPublishTask.mockResolvedValue(undefined);
    const res = await http().post('/api/v1/publish/tasks/retry').send({ taskIds: ['ok', 'dy', 'done', 'other-tenant'] }).expect(200);
    const data = res.body.data;
    expect(data.requested).toBe(4);
    expect(data.retried).toBe(1);
    const byId = Object.fromEntries(data.results.map((r: any) => [r.id, r]));
    expect(byId.ok.ok).toBe(true);
    expect(byId.dy.reason).toMatch(/尚未完成真实开放平台接入/);
    expect(byId.done.reason).toBe('只有失败的任务可以重试');
    expect(byId['other-tenant'].reason).toBe('任务不存在');
    expect(queue.retryPublishTask).toHaveBeenCalledTimes(1);
    for (const call of prisma.publishTask.findFirst.mock.calls) expect(call[0].where.tenant_id).toBe('t-mine');
  });

  it('批量重试：空列表、超过 50 条被拒绝', async () => {
    await http().post('/api/v1/publish/tasks/retry').send({ taskIds: [] }).expect(400);
    await http().post('/api/v1/publish/tasks/retry').send({ taskIds: Array.from({ length: 51 }, (_, i) => `t${i}`) }).expect(400);
    expect(prisma.publishTask.findFirst).not.toHaveBeenCalled();
  });
});

describe('publish-log 纯函数', () => {
  it('csvCell：公式前缀加单引号；逗号、引号、换行加引号', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+86 138')).toBe("'+86 138");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('第一行\n第二行')).toBe('"第一行\n第二行"');
    expect(csvCell(null)).toBe('');
  });

  it('英文失败原文不导出，只给中文说明', () => {
    const csv = publishTasksToCsv([{ ...sampleTasks[0], content: { title: 'x' }, error_message: 'Request failed with status 500' }]);
    expect(csv).not.toContain('Request failed');
    expect(csv).toContain('平台未返回可识别的中文说明');
  });

  it('不给筛选条件时只有工作区条件', () => {
    expect(publishTaskWhere('t1', parsePublishTaskFilter({}))).toEqual({ tenant_id: 't1' });
    expect(publishTaskWhere('t1', parsePublishTaskFilter({ status: 'all' }))).toEqual({ tenant_id: 't1' });
  });
});
