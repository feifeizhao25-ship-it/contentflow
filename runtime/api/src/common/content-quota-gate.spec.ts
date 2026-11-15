/**
 * 国内版会生成或导出内容的接口：免费档在额度内放行，超额返回同一份 429 / AI_MONTHLY_QUOTA，
 * 付费档按自己的额度放行，拒绝时不入账、不调用模型。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../bootstrap';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../database/prisma.service';
import { chinaMonthPeriod } from './china-period';
import { AI_MONTHLY_QUOTA_MESSAGE, AiQuotaExceededError, ResourceType, UsageService, finalizeReservedResponse } from '../modules/system/usage.service';
import { CN_PLANS } from '../modules/billing/plans.constant';
import { AIController } from '../modules/ai/ai.controller';
import { AIService } from '../modules/ai/ai.service';
import { AiAllowanceService } from '../modules/ai/ai-allowance.service';
import { ComplianceService } from '../modules/ai/compliance.service';
import { AiConcurrencyInterceptor } from '../modules/ai/ai-concurrency.interceptor';
import { ContentPackController } from '../modules/ai/content-pack.controller';
import { ContentPackService } from '../modules/ai/content-pack.service';
import { ExternalContentController } from '../modules/developer/external-content.controller';
import { ExternalApiGuard } from '../modules/developer/external-api.guard';
import { GrowthController } from '../modules/growth/growth.controller';
import { GrowthService } from '../modules/growth/growth.service';
import { GrowthTrafficService } from '../modules/growth/growth-traffic.service';
import { HomeService } from '../modules/home/home.service';
import { PublishController } from '../modules/publish/publish.controller';
import { PublishService } from '../modules/publish/publish.service';
import { PublishQueueService } from '../queue/publish-queue.service';
import { TenantService } from '../modules/tenant/tenant.service';
import { AdapterRegistry } from '../modules/publish/adapters/adapter.registry';
import { PUBLISH_MONTHLY_QUOTA_MESSAGE } from './quota-error';

const freePlan = CN_PLANS.find((plan) => plan.id === 'free')!;
const proPlan = CN_PLANS.find((plan) => plan.id === 'pro')!;

const state = {
  plan: 'free' as 'free' | 'pro',
  aiUsed: 0,
  postsUsed: 0,
  writes: 0,
};

function quotaBody(res: { status: number; body: any }, message?: string) {
  expect(res.status).toBe(429);
  expect(res.body.success).toBe(false);
  expect(res.body.error.code).toBe('AI_MONTHLY_QUOTA');
  expect(res.body.error.message).toBe(message ?? AI_MONTHLY_QUOTA_MESSAGE);
  expect(typeof res.body.error.timestamp).toBe('string');
  expect(typeof res.body.error.path).toBe('string');
}

function tenantRow() {
  return {
    id: 't',
    plan: state.plan,
    plan_expires_at: null,
    limits: {},
    usage_stats: { publishes_this_month: state.postsUsed, publishes_period: chinaMonthPeriod() },
  };
}

function prismaForQuota() {
  return {
    tenant: {
      findUnique: jest.fn(async () => tenantRow()),
      update: jest.fn(async ({ data }: { data: { usage_stats: { publishes_this_month: number } } }) => {
        state.writes += 1;
        state.postsUsed = data.usage_stats.publishes_this_month;
        return tenantRow();
      }),
    },
    usageMeter: {
      findFirst: jest.fn(async () => ({ ai_tokens: state.aiUsed, ai_tokens_reserved: 0 })),
    },
    content: {
      findFirst: jest.fn(async () => ({
        id: 'c1', status: 'approved', title: '标题', body: '今天读了一本小说，记下三点。', source: 'manual',
      })),
    },
    platformAccount: {
      findFirst: jest.fn(async () => ({ id: 'a1', status: 'active', platform: 'custom-live' })),
    },
    platformContent: {
      upsert: jest.fn(async ({ create }: { create: { platform: string } }) => ({ id: `pc-${create.platform}`, ...create })),
    },
    publishTask: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: 'task-1', ...data })),
      findMany: jest.fn(async () => []),
    },
    user: { findUnique: jest.fn(async () => null) },
  };
}

function signedIn(ctx: ExecutionContext) {
  ctx.switchToHttp().getRequest().user = { id: 'u', sub: 'u', tenantId: 't', role: 'owner' };
  return true;
}

describe('内容生成与导出的套餐额度闸', () => {
  const previousRegion = process.env.MARKET_REGION;
  let keys: string[] = [];

  beforeAll(() => {
    keys = Object.keys(process.env).filter((name) => name.endsWith('_API_KEY'));
    for (const name of keys) delete process.env[name];
    process.env.MARKET_REGION = 'cn';
  });
  afterAll(() => {
    process.env.MARKET_REGION = previousRegion;
  });
  beforeEach(() => {
    state.plan = 'free';
    state.aiUsed = 0;
    state.postsUsed = 0;
    state.writes = 0;
    AiConcurrencyInterceptor.inFlight.clear();
  });

  describe('AI 生成', () => {
    let app: INestApplication;
    const ai = {
      assertTenantDailyBudget: jest.fn().mockResolvedValue(undefined),
      generateArticle: jest.fn(),
      generateTitlesWithUsage: jest.fn(),
      generateScript: jest.fn(),
      generateImage: jest.fn(),
      analyzeViralContentWithUsage: jest.fn(),
    };
    const text = { usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }, provider: 'deepseek', model: 'deepseek-chat', latency_ms: 1, cost_amount: 0 };

    beforeAll(async () => {
      const prisma = prismaForQuota();
      const real = new UsageService(prisma as never);
      const usage = {
        checkQuota: (tenantId: string, resource: ResourceType, required?: number) => real.checkQuota(tenantId, resource, required),
        withAiHold: async (input: { tenantId: string; holdTokens: number; kind: string }, run: () => Promise<{ tokens: number; response: unknown }>) => {
          const open = await real.checkQuota(input.tenantId, ResourceType.TOKENS, input.holdTokens);
          if (!open) throw new AiQuotaExceededError(input.kind === 'image' ? input.holdTokens : undefined);
          const produced = await run();
          state.writes += 1;
          state.aiUsed += produced.tokens;
          return finalizeReservedResponse(produced, 'gen-1');
        },
      };
      ai.generateArticle.mockResolvedValue({ content: '正文', visualPrompts: [], ...text });
      ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['标题一'], ...text });
      ai.generateScript.mockResolvedValue({ title: '分镜', scenes: [{ visual: '画面', subtitle: '字幕', time: 5 }], ...text });
      ai.analyzeViralContentWithUsage.mockResolvedValue({ analysis: { note: '可核对' }, ...text });
      ai.generateImage.mockResolvedValue({ url: 'https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/a.png', provider: 'dashscope', model: 'wanx', cost_amount: 0 });
      const moduleRef = await Test.createTestingModule({
        controllers: [AIController],
        providers: [
          { provide: AIService, useValue: ai },
          { provide: UsageService, useValue: usage },
          AiAllowanceService,
          ComplianceService,
        ],
      }).overrideGuard(JwtAuthGuard).useValue({ canActivate: signedIn }).compile();
      app = moduleRef.createNestApplication();
      configureApp(app, []);
      await app.init();
    });
    afterAll(async () => { await app.close(); });
    beforeEach(() => {
      for (const fn of Object.values(ai)) fn.mockClear();
    });

    const cases: Array<[string, Record<string, unknown>, keyof typeof ai]> = [
      ['/api/v1/ai/generate/article', { topic: '主题' }, 'generateArticle'],
      ['/api/v1/ai/generate/script', { topic: '主题' }, 'generateScript'],
      ['/api/v1/ai/generate/titles', { topic: '主题' }, 'generateTitlesWithUsage'],
      ['/api/v1/ai/analyze/viral', { content: '一段普通内容' }, 'analyzeViralContentWithUsage'],
      ['/api/v1/ai/generate/image', { prompt: '一只猫' }, 'generateImage'],
    ];

    it.each(cases)('%s 免费档额度内可以生成', async (url, body, method) => {
      state.plan = 'free';
      state.aiUsed = 0;
      const res = await request(app.getHttpServer()).post(url).send(body);
      expect(res.status).toBe(201);
      expect(ai[method]).toHaveBeenCalledTimes(1);
      expect(state.writes).toBe(1);
    });

    it.each(cases)('%s 免费档超额拒绝且不入账、不调用模型', async (url, body, method) => {
      state.plan = 'free';
      state.aiUsed = freePlan.aiTokenQuota;
      const res = await request(app.getHttpServer()).post(url).send(body);
      quotaBody(res, method === 'generateImage'
        ? `本月 AI 剩余额度不足，本次生成需要 2500 令牌，可升级套餐，或在下月 1 日额度恢复后再试`
        : AI_MONTHLY_QUOTA_MESSAGE);
      expect(ai[method]).not.toHaveBeenCalled();
      expect(state.writes).toBe(0);
      expect(state.aiUsed).toBe(freePlan.aiTokenQuota);
    });

    it.each(cases)('%s 付费档在免费额度之上仍可生成', async (url, body, method) => {
      state.plan = 'pro';
      state.aiUsed = freePlan.aiTokenQuota;
      const res = await request(app.getHttpServer()).post(url).send(body);
      expect(res.status).toBe(201);
      expect(ai[method]).toHaveBeenCalledTimes(1);
      expect(proPlan.aiTokenQuota).toBeGreaterThan(freePlan.aiTokenQuota);
    });
  });

  describe('批量生成与对外内容包', () => {
    let app: INestApplication;
    const ai = {
      assertTenantDailyBudget: jest.fn().mockResolvedValue(undefined),
      generateTitlesWithUsage: jest.fn(),
      generateTextForMarket: jest.fn(),
    };
    const calls = { titles: 0 };

    beforeAll(async () => {
      const prisma = prismaForQuota();
      const real = new UsageService(prisma as never);
      const usage = {
        withAiHold: async (input: { tenantId: string; holdTokens: number; kind: string }, run: () => Promise<{ tokens: number; response: unknown }>) => {
          const open = await real.checkQuota(input.tenantId, ResourceType.TOKENS, input.holdTokens);
          if (!open) throw new AiQuotaExceededError(input.kind === 'image' ? input.holdTokens : undefined);
          const produced = await run();
          state.writes += 1;
          state.aiUsed += produced.tokens;
          return produced.response;
        },
      };
      ai.generateTitlesWithUsage.mockImplementation(async () => {
        calls.titles += 1;
        return { titles: ['标题一'], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 4 }, provider: 'deepseek', model: 'deepseek-chat', cost_amount: 0 };
      });
      ai.generateTextForMarket.mockResolvedValue({ content: '正文', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 6 }, provider: 'deepseek', model: 'deepseek-chat', cost_amount: 0 });
      const pack = new ContentPackService(ai as never, usage as never, { scrubOutput: async (value: string) => value } as never, { select: async () => [], buildContext: () => '' } as never);
      const moduleRef = await Test.createTestingModule({
        controllers: [ContentPackController, ExternalContentController],
        providers: [
          { provide: ContentPackService, useValue: pack },
          { provide: PrismaService, useValue: prisma },
        ],
      })
        .overrideGuard(JwtAuthGuard).useValue({ canActivate: signedIn })
        .overrideGuard(ExternalApiGuard).useValue({
          canActivate: (ctx: ExecutionContext) => {
            ctx.switchToHttp().getRequest().tenantId = 't';
            return true;
          },
        })
        .compile();
      app = moduleRef.createNestApplication();
      configureApp(app, []);
      await app.init();
    });
    afterAll(async () => { await app.close(); });
    beforeEach(() => { calls.titles = 0; });

    const packs = ['/api/v1/content-pack/generate', '/api/v1/external/v1/content-pack/generate'];

    it.each(packs)('%s 免费档额度内可以生成', async (url) => {
      state.plan = 'free';
      state.aiUsed = 0;
      const res = await request(app.getHttpServer()).post(url).send({ topic: '主题' });
      expect(res.status).toBe(201);
      expect(calls.titles).toBe(1);
      expect(state.writes).toBe(1);
    });

    it.each(packs)('%s 免费档超额拒绝且不入账、不调用模型', async (url) => {
      state.plan = 'free';
      state.aiUsed = freePlan.aiTokenQuota;
      const res = await request(app.getHttpServer()).post(url).send({ topic: '主题' });
      quotaBody(res);
      expect(calls.titles).toBe(0);
      expect(state.writes).toBe(0);
      expect(state.aiUsed).toBe(freePlan.aiTokenQuota);
    });

    it.each(packs)('%s 付费档在免费额度之上仍可生成', async (url) => {
      state.plan = 'pro';
      state.aiUsed = freePlan.aiTokenQuota;
      const res = await request(app.getHttpServer()).post(url).send({ topic: '主题' });
      expect(res.status).toBe(201);
      expect(calls.titles).toBe(1);
    });
  });

  describe('改写草稿', () => {
    let app: INestApplication;
    const prisma = prismaForQuota();

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [GrowthController],
        providers: [
          GrowthTrafficService,
          { provide: PrismaService, useValue: prisma },
          { provide: UsageService, useValue: new UsageService(prisma as never) },
          { provide: GrowthService, useValue: {} },
          { provide: HomeService, useValue: {} },
        ],
      }).overrideGuard(JwtAuthGuard).useValue({ canActivate: signedIn }).compile();
      app = moduleRef.createNestApplication();
      configureApp(app, []);
      await app.init();
    });
    afterAll(async () => { await app.close(); });

    const post = () => request(app.getHttpServer()).post('/api/v1/growth/skills/platform-copy/draft').send({ topic: '咖啡' });

    it('免费档额度内可以改写', async () => {
      state.plan = 'free';
      state.aiUsed = 0;
      const res = await post();
      expect(res.status).toBe(201);
      expect(JSON.stringify(res.body)).toContain('咖啡');
      expect(state.writes).toBe(0);
    });

    it('免费档超额拒绝且不入账', async () => {
      state.plan = 'free';
      state.aiUsed = freePlan.aiTokenQuota;
      const res = await post();
      quotaBody(res);
      expect(JSON.stringify(res.body)).not.toContain('咖啡');
      expect(state.writes).toBe(0);
      expect(state.aiUsed).toBe(freePlan.aiTokenQuota);
    });

    it('付费档在免费额度之上仍可改写', async () => {
      state.plan = 'pro';
      state.aiUsed = freePlan.aiTokenQuota;
      const res = await post();
      expect(res.status).toBe(201);
      expect(JSON.stringify(res.body)).toContain('咖啡');
    });
  });

  describe('发布与批量导出', () => {
    let app: INestApplication;
    const prisma = prismaForQuota();

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [PublishController],
        providers: [
          PublishService,
          TenantService,
          { provide: PrismaService, useValue: prisma },
          { provide: PublishQueueService, useValue: { addPublishTask: jest.fn(), retryPublishTask: jest.fn() } },
          { provide: AdapterRegistry, useValue: { get: () => ({ isLive: true }) } },
          { provide: ConfigService, useValue: { get: (_key: string, fallback: unknown) => fallback } },
        ],
      }).overrideGuard(JwtAuthGuard).useValue({ canActivate: signedIn }).compile();
      app = moduleRef.createNestApplication();
      configureApp(app, []);
      await app.init();
    });
    afterAll(async () => { await app.close(); });
    beforeEach(() => {
      prisma.publishTask.create.mockClear();
      prisma.publishTask.findMany.mockClear();
      prisma.tenant.update.mockClear();
    });

    const publish = () => request(app.getHttpServer()).post('/api/v1/publish/tasks').send({
      contentId: 'c1', platformAccountIds: ['a1'], publishType: 'immediate',
    });
    const manual = () => request(app.getHttpServer()).post('/api/v1/publish/manual-tasks').send({
      contentId: 'c1', platforms: ['xhs'],
    });

    it.each([
      ['POST /api/v1/publish/tasks', publish],
      ['POST /api/v1/publish/manual-tasks', manual],
    ])('%s 免费档发布额度内可以创建', async (_name, send) => {
      state.plan = 'free';
      state.postsUsed = 0;
      const res = await send();
      expect(res.status).toBe(201);
      expect(state.writes).toBe(1);
      expect(state.postsUsed).toBe(1);
    });

    it.each([
      ['POST /api/v1/publish/tasks', publish],
      ['POST /api/v1/publish/manual-tasks', manual],
    ])('%s 免费档发布超额拒绝且不入账', async (_name, send) => {
      state.plan = 'free';
      state.postsUsed = freePlan.monthlyPostQuota;
      const res = await send();
      quotaBody(res, PUBLISH_MONTHLY_QUOTA_MESSAGE);
      expect(state.writes).toBe(0);
      expect(state.postsUsed).toBe(freePlan.monthlyPostQuota);
      expect(prisma.publishTask.create).not.toHaveBeenCalled();
    });

    it.each([
      ['POST /api/v1/publish/tasks', publish],
      ['POST /api/v1/publish/manual-tasks', manual],
    ])('%s 付费档在免费发布额度之上仍可创建', async (_name, send) => {
      state.plan = 'pro';
      state.postsUsed = freePlan.monthlyPostQuota;
      const res = await send();
      expect(res.status).toBe(201);
      expect(proPlan.monthlyPostQuota).toBeGreaterThan(freePlan.monthlyPostQuota);
      expect(state.writes).toBe(1);
    });

    it('GET /api/v1/publish/tasks/export 免费档 AI 令牌用完仍可导出自己的发布日志，且不入账', async () => {
      state.plan = 'free';
      state.aiUsed = freePlan.aiTokenQuota;
      state.postsUsed = freePlan.monthlyPostQuota;
      const res = await request(app.getHttpServer()).get('/api/v1/publish/tasks/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(prisma.publishTask.findMany).toHaveBeenCalled();
      expect(state.writes).toBe(0);
      expect(state.aiUsed).toBe(freePlan.aiTokenQuota);
    });
  });
});
