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

const prisma = (state: { accounts: any[]; failed: number; pending: number; profile?: any; pendingTitles?: any[] }) => ({
  platformAccount: { findMany: async () => state.accounts },
  content: {
    count: async ({ where }: any) => (where.status === 'pending_review' ? state.pending : where.status === 'approved' ? 0 : 1),
    findMany: async () => state.pendingTitles ?? [],
  },
  publishTask: { count: async ({ where }: any) => (where.status === 'failed' ? state.failed : 0) },
  material: { count: async () => 0 },
  growthGoal: { count: async () => 0 },
  user: { findUnique: async () => state.profile ?? null },
});

describe('GET /api/v1/home/today', () => {
  let app: INestApplication;
  const state = { accounts: [{ platform: 'douyin' }] as any[], failed: 0, pending: 0, profile: null as any, pendingTitles: [] as any[] };
  const authed = { value: true };
  beforeEach(async () => {
    state.accounts = [{ platform: 'douyin' }];
    state.failed = 0;
    state.pending = 0;
    state.profile = null;
    state.pendingTitles = [];
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

  it('没绑账号时仍按注册资料给选题，并列出待审核正文', async () => {
    state.accounts = [];
    state.pending = 1;
    state.profile = { industry: '教育培训', job_role: '老师', growth_stage: null, province: '浙江' };
    state.pendingTitles = [{ id: 'c-1', title: '寒假班课表' }];
    const r = await request(app.getHttpServer()).get('/api/v1/home/today').expect(200);
    expect(r.body.data.next_step.id).toBe('connect_account');
    expect(r.body.data.suggestions[0].title).toContain('教育培训');
    expect(r.body.data.suggestions[0].title).toContain('浙江');
    expect(r.body.data.suggestions[0].reason).toContain('老师');
    expect(JSON.stringify(r.body.data.suggestions)).not.toMatch(/热搜|趋势|爆款预测/);
    expect(r.body.data.pending_items).toEqual([expect.objectContaining({ id: 'c-1', title: '寒假班课表', href: '/contents?status=pending_review' })]);
  });

  it('两个不同的注册资料不会得到同一句选题', async () => {
    state.accounts = [];
    state.profile = { industry: '养生', job_role: null, growth_stage: null, province: '四川' };
    const a = await request(app.getHttpServer()).get('/api/v1/home/today').expect(200);
    state.profile = { industry: '教育培训', job_role: '老师', growth_stage: null, province: '浙江' };
    const b = await request(app.getHttpServer()).get('/api/v1/home/today').expect(200);
    expect(a.body.data.suggestions[0].title).not.toBe(b.body.data.suggestions[0].title);
    expect(a.body.data.suggestions.some((item: { library: string }) => item.library === 'rule-topics')).toBe(true);
    expect(b.body.data.suggestions.every((item: { title: string }) => item.title.includes('教育培训') || item.title.includes('老师') || item.title.includes('浙江') || item.title.includes('未成年人') || item.title.includes('直播'))).toBe(true);
  });

  it('需要登录', () => {
    expect(Reflect.getMetadata('__guards__', HomeController)).toContain(JwtAuthGuard);
  });
});
