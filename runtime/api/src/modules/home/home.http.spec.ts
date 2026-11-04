/** 走真实路由：国内版中文、国际版英文，都要登录；数据来自账号自己。 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

const prisma = (state: { accounts: any[]; failed: number; pending: number }) => ({
  platformAccount: { findMany: async () => state.accounts },
  content: { count: async ({ where }: any) => (where.status === 'pending_review' ? state.pending : where.status === 'approved' ? 0 : 1) },
  publishTask: { count: async ({ where }: any) => (where.status === 'failed' ? state.failed : 0) },
  material: { count: async () => 0 },
  growthGoal: { count: async () => 0 },
});

describe('GET /api/v1/home/today', () => {
  let app: INestApplication;
  const state = { accounts: [{ platform: 'douyin' }], failed: 0, pending: 0 };
  const authed = { value: true };
  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [HomeService, { provide: PrismaService, useValue: prisma(state) }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => { ctx.switchToHttp().getRequest().user = { id: 'u1', tenantId: 't1' }; return authed.value; } })
      .compile();
    app = ref.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => { await app.close(); delete process.env.MARKET_REGION; });

  it('国内版中文；用户的数据变了建议就变', async () => {
    state.failed = 0; state.pending = 0;
    const a = await request(app.getHttpServer()).get('/api/v1/home/today').expect(200);
    expect(a.body.data.language).toBe('zh');
    state.pending = 2;
    const b = await request(app.getHttpServer()).get('/api/v1/home/today').expect(200);
    expect(b.body.data.next_step.id).toBe('review_content');
    expect(b.body.data.next_step.id).not.toBe(a.body.data.next_step.id);
    expect(b.body.data.signals).toMatchObject({ pending_review: 2, accounts: 1, platforms: ['douyin'] });
  });

  it('国际版：接口存在（不是 404），全英文', async () => {
    process.env.MARKET_REGION = 'global';
    state.pending = 0; state.failed = 2;
    const r = await request(app.getHttpServer()).get('/api/v1/home/today').expect(200);
    expect(r.body.data.language).toBe('en');
    expect(JSON.stringify(r.body.data)).not.toMatch(/[㐀-鿿]/);
    expect(r.body.data.next_step.id).toBe('fix_failed');
  });

  it('需要登录', () => {
    expect(Reflect.getMetadata('__guards__', HomeController)).toContain(JwtAuthGuard);
  });
});
