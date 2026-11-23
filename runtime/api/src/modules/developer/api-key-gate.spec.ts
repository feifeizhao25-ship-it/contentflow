/**
 * 开发者 API 密钥创建默认关闭。
 * 页面已写明尚未开放，但直接 POST /developer/keys 原先仍能创建。
 */
import { ExecutionContext, ForbiddenException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ApiKeyController } from './api-key.controller';
import { API_KEYS_CLOSED_MESSAGE, ApiKeyService } from './api-key.service';

describe('开发者 API 密钥创建开关', () => {
  const previous = process.env.DEVELOPER_API_KEYS_ENABLED;
  const prisma: any = {
    apiKey: {
      create: jest.fn(async ({ data }: any) => ({ id: 'k-new', created_at: new Date().toISOString(), ...data })),
      findMany: jest.fn(async () => []),
    },
  };

  afterEach(() => {
    if (previous === undefined) delete process.env.DEVELOPER_API_KEYS_ENABLED;
    else process.env.DEVELOPER_API_KEYS_ENABLED = previous;
    prisma.apiKey.create.mockClear();
  });

  it('服务层：未设置或非 true 时拒绝创建，且不写库', async () => {
    const svc = new ApiKeyService(prisma);
    delete process.env.DEVELOPER_API_KEYS_ENABLED;
    await expect(svc.createKey('t', 'ci')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.createKey('t', 'ci')).rejects.toThrow(API_KEYS_CLOSED_MESSAGE);
    process.env.DEVELOPER_API_KEYS_ENABLED = 'false';
    await expect(svc.createKey('t', 'ci')).rejects.toThrow(/暂未开放/);
    process.env.DEVELOPER_API_KEYS_ENABLED = '1';
    await expect(svc.createKey('t', 'ci')).rejects.toThrow(/暂未开放/);
    expect(prisma.apiKey.create).not.toHaveBeenCalled();
  });

  it('服务层：DEVELOPER_API_KEYS_ENABLED=true 才创建，明文只返回一次', async () => {
    process.env.DEVELOPER_API_KEYS_ENABLED = 'true';
    const svc = new ApiKeyService(prisma);
    const out: any = await svc.createKey('t', 'ci');
    expect(out.secret).toMatch(/^sk_ff_[0-9a-f]{32}$/);
    expect(out.key_hash).toBeUndefined();
    expect(prisma.apiKey.create).toHaveBeenCalledTimes(1);
  });

  describe('HTTP', () => {
    let app: INestApplication;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ApiKeyController],
        providers: [ApiKeyService, { provide: PrismaService, useValue: prisma }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (ctx: ExecutionContext) => {
            ctx.switchToHttp().getRequest().user = { sub: 'u-me', tenantId: 't-mine', role: 'owner' };
            return true;
          },
        })
        .compile();
      app = moduleRef.createNestApplication();
      configureApp(app, []);
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('默认关闭：POST /developer/keys 返回 403 和中文说明，不写库', async () => {
      delete process.env.DEVELOPER_API_KEYS_ENABLED;
      const res = await request(app.getHttpServer()).post('/api/v1/developer/keys').send({ name: '绕过页面' });
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe(API_KEYS_CLOSED_MESSAGE);
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });

    it('打开开关后可以创建', async () => {
      process.env.DEVELOPER_API_KEYS_ENABLED = 'true';
      const res = await request(app.getHttpServer()).post('/api/v1/developer/keys').send({ name: '内部联调' });
      expect(res.status).toBe(201);
      expect(res.body.data.secret).toMatch(/^sk_ff_[0-9a-f]{32}$/);
      expect(res.body.data.key_hash).toBeUndefined();
    });
  });
});
