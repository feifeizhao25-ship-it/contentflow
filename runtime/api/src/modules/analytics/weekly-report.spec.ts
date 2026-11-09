/**
 * 周报 xlsx：只导出当前登录用户所在工作区已保存的记录。
 * 没有记录时表格写明是空的，不编造播放、点赞或涨粉。
 */
import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { weeklySheets } from './weekly-report';
import { buildXlsx } from './xlsx';

const NOW = new Date('2026-11-09T04:00:00Z');
const INSIDE = new Date('2026-11-09T02:00:00Z');

describe('weekly xlsx sheets', () => {
  const emptyPublish = { total: 0, published: 0, failed: 0, inProgress: 0, manualPending: 0, manualDone: 0, cancelled: 0 };

  it('an empty week says there are no records and does not invent engagement numbers', () => {
    const bytes = buildXlsx(weeklySheets({
      lang: 'en',
      windowStart: new Date('2026-11-08T16:00:00Z'),
      windowEnd: new Date('2026-11-15T16:00:00Z'),
      publish: emptyPublish,
      ai: { generations: 0, byType: [], savedAsContent: 0, approvedOrPublished: 0 },
      contents: [],
      tasks: [],
      engagementNote: 'Views, likes, comments and follower growth can only be read through each platform\'s official API.',
      truncated: false,
    }));
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    const xml = bytes.toString('utf8');
    expect(xml).toContain('No content was saved this week');
    expect(xml).toContain('No publish tasks were stored this week');
    expect(xml).toContain('Engagement data available');
    expect(xml).toContain('official API');
    expect(xml).not.toMatch(/8\.5%|10\.2w|涨粉 893/);
    expect(xml).not.toContain('<v>12</v>');
  });

  it('stored rows are written as themselves', () => {
    const xml = buildXlsx(weeklySheets({
      lang: 'en',
      windowStart: new Date('2026-11-08T16:00:00Z'),
      windowEnd: new Date('2026-11-15T16:00:00Z'),
      publish: { ...emptyPublish, total: 1, published: 1 },
      ai: { generations: 2, byType: [{ label: 'Articles', count: 2 }], savedAsContent: 1, approvedOrPublished: 0 },
      contents: [{ title: 'Launch note', content_type: 'article', status: 'draft', created_at: INSIDE }],
      tasks: [{ platform: 'linkedin', status: 'published', scheduled_at: null, created_at: INSIDE }],
      engagementNote: 'No engagement numbers are shown here.',
      truncated: false,
    })).toString('utf8');
    expect(xml).toContain('Launch note');
    expect(xml).toContain('linkedin');
    expect(xml).toContain('<v>1</v>');
    expect(xml).toContain('<v>2</v>');
    expect(xml).not.toContain('No content was saved this week');
  });
});

describe('GET /analytics/weekly-report.xlsx', () => {
  let app: INestApplication;
  const contents = [
    { tenant_id: 'tenant-a', title: 'A real draft', content_type: 'article', status: 'draft', created_at: INSIDE, source: 'manual' },
    { tenant_id: 'tenant-b', title: 'B secret draft', content_type: 'article', status: 'draft', created_at: INSIDE, source: 'manual' },
  ];
  const tasks = [
    { tenant_id: 'tenant-a', status: 'published', scheduled_at: null, created_at: INSIDE, error_code: null, error_message: null, platform_content: { platform: 'linkedin' }, platform_account: null },
    { tenant_id: 'tenant-b', status: 'failed', scheduled_at: null, created_at: INSIDE, error_code: 'DISPATCH_FAILED', error_message: null, platform_content: { platform: 'youtube' }, platform_account: null },
  ];

  const tenantOf = (where: any) => String(where?.tenant_id ?? '');
  const prisma = {
    publishTask: {
      groupBy: jest.fn(async ({ where }: any) => {
        const rows = tasks.filter((row) => row.tenant_id === tenantOf(where));
        const counts = new Map<string, number>();
        for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        return [...counts.entries()].map(([status, n]) => ({ status, _count: { _all: n } }));
      }),
      findMany: jest.fn(async ({ where }: any) => tasks.filter((row) => row.tenant_id === tenantOf(where))),
    },
    content: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async ({ where }: any) => contents.filter((row) => row.tenant_id === tenantOf(where))),
    },
    aIGeneration: { groupBy: jest.fn(async () => []) },
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'] });
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          const header = String(req.headers.authorization ?? '');
          if (!header.startsWith('Bearer ')) throw new UnauthorizedException('请先登录');
          req.user = { sub: 'user', tenantId: header.slice('Bearer '.length) };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => {
    jest.useRealTimers();
    await app.close();
  });

  it('the route is behind the login guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalyticsController)).toContain(JwtAuthGuard);
  });

  it('refuses a request that is not logged in', async () => {
    await request(app.getHttpServer()).get('/api/v1/analytics/weekly-report.xlsx').expect(401);
  });

  const xlsx = (token: string, query = '') => request(app.getHttpServer())
    .get(`/api/v1/analytics/weekly-report.xlsx${query}`)
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((res: any, cb: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

  it('exports only the signed-in workspace, in English when asked', async () => {
    const res = await xlsx('tenant-a', '?lang=en');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('weekly-report.xlsx');
    const xml = Buffer.isBuffer(res.body) ? res.body.toString('utf8') : String(res.body);
    expect(xml.startsWith('PK')).toBe(true);
    expect(xml).toContain('A real draft');
    expect(xml).toContain('linkedin');
    expect(xml).not.toContain('B secret draft');
    expect(xml).not.toContain('youtube');
    expect(prisma.content.findMany.mock.calls.every((call: any) => call[0].where.tenant_id === 'tenant-a')).toBe(true);
    expect(prisma.publishTask.findMany.mock.calls.every((call: any) => call[0].where.tenant_id === 'tenant-a')).toBe(true);
  });

  it('a workspace with no rows gets the empty-sheet note', async () => {
    const res = await xlsx('tenant-empty', '?lang=en');
    expect(res.status).toBe(200);
    const xml = Buffer.isBuffer(res.body) ? res.body.toString('utf8') : String(res.body);
    expect(xml).toContain('No content was saved this week');
    expect(xml).toContain('No publish tasks were stored this week');
    expect(xml).not.toContain('A real draft');
    expect(xml).not.toContain('B secret draft');
  });
});
