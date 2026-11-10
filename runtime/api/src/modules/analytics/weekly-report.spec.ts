/**
 * 周报 xlsx：只导出当前登录用户所在工作区已保存的记录。
 * 没有记录时表格写明是空的，不编造播放、点赞或涨粉。
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
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
import { buildPdf } from './pdf';
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

const week = {
  lang: 'en' as const,
  windowStart: new Date('2026-11-08T16:00:00Z'),
  windowEnd: new Date('2026-11-15T16:00:00Z'),
  publish: { total: 0, published: 0, failed: 0, inProgress: 0, manualPending: 0, manualDone: 0, cancelled: 0 },
  ai: { generations: 0, byType: [], savedAsContent: 0, approvedOrPublished: 0 },
  contents: [] as Array<{ title: string; content_type: string; status: string; created_at: Date }>,
  tasks: [] as Array<{ platform: string; status: string; scheduled_at: null; created_at: Date }>,
  engagementNote: 'Views, likes, comments and follower growth can only be read through each platform\'s official API.',
  truncated: false,
};

/** qpdf 确认文件能打开，pdftotext 确认中英文和「互动不可用」是正文而不是图。 */
function checkedPdfText(pdf: Buffer): string {
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(1000);
  expect(pdf.length).toBeLessThan(256 * 1024);
  const dir = mkdtempSync(join(tmpdir(), 'weekly-pdf-'));
  const file = join(dir, 'report.pdf');
  try {
    writeFileSync(file, pdf);
    const check = execFileSync('qpdf', ['--check', file], { encoding: 'utf8' });
    expect(check).toMatch(/No syntax or stream encoding errors/);
    return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('weekly pdf pages', () => {
  it('an empty week uses the same fields and does not invent engagement numbers', async () => {
    const pdf = await buildPdf(weeklySheets(week));
    console.log(`weekly-pdf-bytes en=${pdf.length}`);
    const text = checkedPdfText(pdf);
    expect(text).toContain('Weekly workspace report');
    expect(text).toContain('No content was saved this week');
    expect(text).toContain('No publish tasks were stored this week');
    expect(text).toContain('Engagement data available');
    expect(text).toContain('No');
    expect(text).toContain('official API');
    expect(text).not.toMatch(/8\.5%|10\.2w|涨粉 893/);
    expect(text).not.toMatch(/\b12\b/);
  });

  it('stored rows and the Chinese labels are written as themselves', async () => {
    const pdf = await buildPdf(weeklySheets({
      ...week,
      lang: 'zh',
      publish: { ...week.publish, total: 1, published: 1 },
      ai: { generations: 2, byType: [{ label: '文章', count: 2 }], savedAsContent: 1, approvedOrPublished: 0 },
      contents: [{ title: '发布说明', content_type: 'article', status: 'draft', created_at: INSIDE }],
      tasks: [{ platform: 'linkedin', status: 'published', scheduled_at: null, created_at: INSIDE }],
      engagementNote: '播放、点赞、评论、涨粉等互动数据只能通过平台开放接口获取。',
    }));
    console.log(`weekly-pdf-bytes zh=${pdf.length}`);
    const text = checkedPdfText(pdf);
    expect(text).toContain('本周工作区报告');
    expect(text).toContain('发布说明');
    expect(text).toContain('linkedin');
    expect(text).toContain('是否有互动数据');
    expect(text).toContain('没有');
    expect(text).toContain('平台开放接口');
    expect(text).not.toContain('本周没有保存任何内容');
    expect(text).not.toMatch(/8\.5%|10\.2w|涨粉 893/);
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

describe('GET /analytics/weekly-report.pdf', () => {
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
    delete process.env.MARKET_REGION;
    await app.close();
  });

  const pdf = (token: string, query = '') => request(app.getHttpServer())
    .get(`/api/v1/analytics/weekly-report.pdf${query}`)
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((res: any, cb: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

  it('uses the same login gate as the spreadsheet', async () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AnalyticsController)).toContain(JwtAuthGuard);
    await request(app.getHttpServer()).get('/api/v1/analytics/weekly-report.pdf').expect(401);
    await request(app.getHttpServer()).get('/api/v1/analytics/weekly-report.xlsx').expect(401);
  });

  it('does not add a plan block while export formats are still not enforced', async () => {
    const registry = JSON.parse(readFileSync(join(__dirname, '../../../../web-cn/src/lib/entitlements.json'), 'utf8'));
    expect(registry.entitlementStatus['export.formats'].status).toBe('coming_soon');
    expect(registry.entitlementStatus['export.batchExport'].status).toBe('coming_soon');
    const res = await pdf('tenant-a', '?lang=en');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('weekly-report.pdf');
    expect(res.headers['x-export-truncated']).toBe('0');
  });

  it('exports only the signed-in workspace, in English or Chinese', async () => {
    const english = await pdf('tenant-a', '?lang=en');
    const enBody = Buffer.isBuffer(english.body) ? english.body : Buffer.from(english.body);
    const en = checkedPdfText(enBody);
    expect(en).toContain('A real draft');
    expect(en).toContain('linkedin');
    expect(en).toContain('Engagement data available');
    expect(en).not.toContain('B secret draft');
    expect(en).not.toContain('youtube');
    expect(en).not.toMatch(/8\.5%|10\.2w|涨粉 893/);

    const chinese = await pdf('tenant-a', '?lang=zh');
    const zhBody = Buffer.isBuffer(chinese.body) ? chinese.body : Buffer.from(chinese.body);
    const zh = checkedPdfText(zhBody);
    console.log(`weekly-pdf-bytes http-en=${enBody.length} http-zh=${zhBody.length}`);
    expect(zh).toContain('本周工作区报告');
    expect(zh).toContain('A real draft');
    expect(zh).toContain('没有');
    expect(zh).not.toContain('B secret draft');

    process.env.MARKET_REGION = 'global';
    const internationalBody = (await pdf('tenant-a')).body;
    const international = checkedPdfText(Buffer.isBuffer(internationalBody) ? internationalBody : Buffer.from(internationalBody));
    expect(international).toContain('Weekly workspace report');
    expect(international).not.toContain('本周工作区报告');
  });

  it('a workspace with no rows gets the empty-sheet note', async () => {
    const emptyBody = (await pdf('tenant-empty', '?lang=en')).body;
    const text = checkedPdfText(Buffer.isBuffer(emptyBody) ? emptyBody : Buffer.from(emptyBody));
    expect(text).toContain('No content was saved this week');
    expect(text).toContain('No publish tasks were stored this week');
    expect(text).not.toContain('A real draft');
    expect(text).not.toContain('B secret draft');
  });
});
