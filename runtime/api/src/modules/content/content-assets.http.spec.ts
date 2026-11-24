/**
 * POST /contents/:id/assets 必须走真实的全局 ValidationPipe。
 *
 * 管道开着 whitelist、forbidNonWhitelisted、transform 和 enableImplicitConversion。
 * 请求体若只声明成 unknown[]，反射类型是 Array，每一项对象会被转成空数组，
 * 合法的 type / url / label / meta.content 到不了服务层，接口返回 400。
 * 非法负载（多余字段、超长列表、危险地址）仍然拒绝，且不写库。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

describe('POST /contents/:id/assets 经过全局 ValidationPipe', () => {
  let app: INestApplication;
  const prisma = {
    content: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
    reviewLog: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    user: { count: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const row: Record<string, unknown> = {
      id: 'c-1', tenant_id: 't-mine', status: 'draft', source: 'manual', body: '旧', cover_url: null, media_urls: [],
    };
    prisma.content.findFirst.mockImplementation(async () => row);
    prisma.content.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      for (const key of ['body', 'cover_url', 'media_urls']) {
        if (data[key] !== undefined) row[key] = data[key];
      }
      return { ...row };
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [ContentService, { provide: PrismaService, useValue: prisma }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u-me', sub: 'u-me', tenantId: 't-mine', role: 'owner' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });

  afterEach(async () => app.close());

  const http = () => request(app.getHttpServer());
  const legal = {
    assets: [
      { type: 'script', url: '', label: '正文脚本', meta: { content: '新脚本' } },
      { type: 'cover', url: 'https://cdn.example/c.png', label: '封面图' },
    ],
  };

  it('保留合法素材数组里的类型、地址、名称和正文，并写入内容', async () => {
    const res = await http().post('/api/v1/contents/c-1/assets').send(legal);
    expect(res.status).toBe(201);
    expect(prisma.content.update).toHaveBeenCalledTimes(1);
    expect(prisma.content.update.mock.calls[0][0].data).toEqual(expect.objectContaining({
      body: '新脚本',
      cover_url: 'https://cdn.example/c.png',
      media_urls: ['https://cdn.example/c.png'],
    }));
    expect(res.body?.data?.assets?.find((item: { type: string }) => item.type === 'script')?.meta?.content).toBe('新脚本');
  });

  it('拒绝非法负载，且不写库', async () => {
    const illegal = [
      { ...legal, extra: true },
      { assets: [{ ...legal.assets[0], injected: 1 }] },
      { assets: [{ ...legal.assets[0], meta: { content: '新脚本', extra: 1 } }] },
      { assets: Array.from({ length: 21 }, () => ({ type: 'script', url: '', meta: { content: 'x' } })) },
      { assets: [{ type: 'exe', url: 'https://cdn.example/a.png', label: '配图' }] },
      { assets: [{ type: 'cover', url: 'javascript:alert(1)', label: '封面图' }] },
      { assets: 'not-a-list' },
      {},
    ];
    for (const body of illegal) {
      prisma.content.update.mockClear();
      const res = await http().post('/api/v1/contents/c-1/assets').send(body);
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
      expect(prisma.content.update).not.toHaveBeenCalled();
      const message = JSON.stringify(res.body?.error?.message ?? '');
      expect(message).not.toContain('assets');
    }
  });
});
