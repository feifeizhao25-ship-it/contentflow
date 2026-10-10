/**
 * 套餐 AI 额度真的被执行（审计 P0-3 / 第 6 点）：
 *  - 国内模型原来 cost_amount: null，每日成本预算永远统计为 0；
 *  - 文章、标题、脚本、图片接口不查套餐 AI 额度，免费版等于无限 AI；
 *  - 日预算超限抛英文 Error，用户只看到「服务暂时出错」。
 */
import { ExecutionContext, HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AiAllowanceService } from './ai-allowance.service';
import { ResourceType, UsageService } from '../system/usage.service';
import { ContentPackService } from './content-pack.service';
import {
  DOMESTIC_TEXT_MODEL_PRICES,
  IMAGE_TOKEN_EQUIVALENT,
  UNKNOWN_TEXT_MODEL_PRICE,
  estimateImageCost,
  estimateTextCost,
} from './model-pricing';

function service(env: Record<string, unknown>, prisma: unknown = {}) {
  const config = { get: jest.fn((key: string, fallback: unknown) => (key in env ? env[key] : fallback)) };
  return new AIService(prisma as never, config as never);
}

describe('国内模型按价目表折算成本', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('价目表里每个模型都有正的单价，未登记的模型按最高单价计（保守）', () => {
    for (const [model, price] of Object.entries(DOMESTIC_TEXT_MODEL_PRICES)) {
      expect(price.inputCnyPerMillion).toBeGreaterThan(0);
      expect(price.outputCnyPerMillion).toBeGreaterThan(0);
      expect(price.outputCnyPerMillion).toBeLessThanOrEqual(UNKNOWN_TEXT_MODEL_PRICE.outputCnyPerMillion);
      expect(estimateTextCost(model, 1000, 1000).cny).toBeGreaterThan(0);
    }
    const unknown = estimateTextCost('some-new-model', 1_000_000, 0);
    expect(unknown.known).toBe(false);
    expect(unknown.cny).toBe(UNKNOWN_TEXT_MODEL_PRICE.inputCnyPerMillion);
    expect(estimateImageCost('wanx2.1-t2i-turbo').cny).toBeGreaterThan(0);
  });

  it('DeepSeek 返回的记录里 cost_amount 不再是 null，而是按 token 折算的金额', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: '好' } }], usage: { prompt_tokens: 1000, completion_tokens: 2000, total_tokens: 3000 } }),
    }) as jest.Mock;
    const result = await service({ MARKET_REGION: 'cn', DEEPSEEK_API_KEY: 'dk' }).generateText({ prompt: '测试' });
    expect(result.cost_amount).not.toBeNull();
    expect(result.cost_amount).toBeCloseTo(estimateTextCost('deepseek-chat', 1000, 2000).cny, 8);
    expect(result.cost_amount!).toBeGreaterThan(0);
  });

  it('国内版：成本是人民币，预算读 AI_TENANT_DAILY_BUDGET_CNY（默认 140 元），美元预算变量不再参与', async () => {
    const prisma = { aIGeneration: { aggregate: jest.fn().mockResolvedValue({ _sum: { cost_amount: 100 } }) } };
    const usage = await service({ MARKET_REGION: 'cn', DEEPSEEK_API_KEY: 'dk', AI_TENANT_DAILY_BUDGET_USD: 1 }, prisma).getTenantDailyBudgetUsage('t');
    expect(usage).toMatchObject({ currency: 'CNY', spent: 100, limit: 140, remaining: 40 });
    expect(usage).not.toHaveProperty('spent_usd');
    // 价目表与源码里都不再有美元汇率
    const src = require('fs').readFileSync(require('path').join(__dirname, 'model-pricing.ts'), 'utf8');
    expect(src).not.toMatch(/CNY_PER_USD|usd:/);
  });

  it('核对过的价目必须带官方来源与实际核对日期；没核对的标「待核实」', () => {
    for (const [model, price] of Object.entries(DOMESTIC_TEXT_MODEL_PRICES)) {
      if (price.verified) {
        expect({ model, source: price.source }).toEqual({ model, source: expect.stringMatching(/^https:\/\/api-docs\.deepseek\.com\//) });
        expect({ model, checkedAt: price.checkedAt }).toEqual({ model, checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
      } else {
        expect({ model, note: price.note }).toEqual({ model, note: expect.stringContaining('待核实') });
      }
    }
    expect(DOMESTIC_TEXT_MODEL_PRICES['deepseek-flash']).toMatchObject({ inputCnyPerMillion: 2, outputCnyPerMillion: 8, verified: true });
    expect(DOMESTIC_TEXT_MODEL_PRICES['deepseek-v4-pro']).toMatchObject({ inputCnyPerMillion: 9, outputCnyPerMillion: 27, verified: true });
  });

  it('日预算按记录里的金额累计，超出后抛中文 429「今日 AI 用量已达上限」', async () => {
    const prisma = { aIGeneration: { aggregate: jest.fn().mockResolvedValue({ _sum: { cost_amount: 0.5 } }) } };
    // 国内版预算按人民币（AI_TENANT_DAILY_BUDGET_CNY），不再经美元折算
    const ai = service({ MARKET_REGION: 'cn', DEEPSEEK_API_KEY: 'dk', AI_TENANT_DAILY_BUDGET_CNY: 0.5 }, prisma);
    const error = await ai.assertTenantDailyBudget('t').catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(JSON.stringify(error.getResponse())).toContain('今日 AI 用量已达上限');
    prisma.aIGeneration.aggregate.mockResolvedValue({ _sum: { cost_amount: 0.49 } });
    await expect(ai.assertTenantDailyBudget('t')).resolves.toBeUndefined();
  });
});

describe('AI 生成接口统一执行套餐 AI 额度', () => {
  let app: INestApplication;
  const ai = {
    assertTenantDailyBudget: jest.fn(),
    generateArticle: jest.fn(),
    generateTitlesWithUsage: jest.fn(),
    generateScript: jest.fn(),
    generateImage: jest.fn(),
    analyzeViralContentWithUsage: jest.fn(),
    recordGeneration: jest.fn(),
  };
  const usage = { checkQuota: jest.fn(), trackUsage: jest.fn() };
  const textResult = { usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }, provider: 'deepseek', model: 'deepseek-chat', latency_ms: 1, cost_amount: 0.0001 };
  const previousRegion = process.env.MARKET_REGION;

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env.MARKET_REGION = 'cn';
    ai.assertTenantDailyBudget.mockResolvedValue(undefined);
    ai.generateArticle.mockResolvedValue({ content: '正文', visualPrompts: [], ...textResult });
    ai.generateTitlesWithUsage.mockResolvedValue({ titles: ['标题一'], ...textResult });
    ai.generateScript.mockResolvedValue({ title: 't', scenes: [{ visual: 'v', subtitle: 's', time: 5 }], ...textResult });
    ai.analyzeViralContentWithUsage.mockResolvedValue({ analysis: {}, ...textResult });
    ai.generateImage.mockResolvedValue({ url: 'https://example.cn/a.png', provider: 'dashscope', model: 'wanx2.1-t2i-turbo', cost_amount: 0.04 });
    const moduleRef = await Test.createTestingModule({
      controllers: [AIController],
      providers: [{ provide: AIService, useValue: ai }, { provide: UsageService, useValue: usage }, AiAllowanceService],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u', sub: 'u', tenantId: 't', role: 'owner' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, []);
    await app.init();
  });
  afterEach(async () => {
    process.env.MARKET_REGION = previousRegion;
    await app.close();
  });

  const endpoints: Array<[string, Record<string, unknown>, keyof typeof ai]> = [
    ['/api/v1/ai/generate/article', { topic: '主题' }, 'generateArticle'],
    ['/api/v1/ai/generate/titles', { topic: '主题' }, 'generateTitlesWithUsage'],
    ['/api/v1/ai/generate/script', { topic: '主题' }, 'generateScript'],
    ['/api/v1/ai/generate/image', { prompt: '一只猫' }, 'generateImage'],
    ['/api/v1/ai/analyze/viral', { content: '一段内容' }, 'analyzeViralContentWithUsage'],
  ];

  it.each(endpoints)('%s：套餐月度 AI 额度用完 → 中文 429，且不调用模型', async (url, body, method) => {
    usage.checkQuota.mockResolvedValue(false);
    const res = await request(app.getHttpServer()).post(url).send(body);
    expect(res.status).toBe(429);
    expect(res.body.error.message).toContain('本月 AI 额度已用完');
    expect(usage.checkQuota).toHaveBeenCalledWith('t', ResourceType.TOKENS);
    expect(ai[method]).not.toHaveBeenCalled();
  });

  it.each(endpoints)('%s：今日预算用完 → 中文 429「今日 AI 用量已达上限」', async (url, body, method) => {
    const real = service({ AI_TENANT_DAILY_BUDGET_USD: 1 }, { aIGeneration: { aggregate: async () => ({ _sum: { cost_amount: 5 } }) } });
    ai.assertTenantDailyBudget.mockImplementation((id: string) => real.assertTenantDailyBudget(id));
    usage.checkQuota.mockResolvedValue(true);
    const res = await request(app.getHttpServer()).post(url).send(body);
    expect(res.status).toBe(429);
    expect(res.body.error.message).toContain('今日 AI 用量已达上限');
    expect(ai[method]).not.toHaveBeenCalled();
  });

  it('文本生成成功后按实际 token 数计入当月 AI 额度，并把折算金额写进生成记录', async () => {
    usage.checkQuota.mockResolvedValue(true);
    const res = await request(app.getHttpServer()).post('/api/v1/ai/generate/titles').send({ topic: '主题' });
    expect(res.status).toBe(201);
    expect(usage.trackUsage).toHaveBeenCalledWith('t', ResourceType.TOKENS, 30, expect.objectContaining({ type: 'titles' }));
    expect(ai.recordGeneration.mock.calls[0][2].costAmount).toBe(0.0001);
  });

  it('图片生成计一张图并按固定折算计入 AI 额度，成本写进生成记录', async () => {
    usage.checkQuota.mockResolvedValue(true);
    const res = await request(app.getHttpServer()).post('/api/v1/ai/generate/image').send({ prompt: '一只猫' });
    expect(res.status).toBe(201);
    expect(usage.trackUsage).toHaveBeenCalledWith('t', ResourceType.IMAGES, 1, expect.anything());
    expect(usage.trackUsage).toHaveBeenCalledWith('t', ResourceType.TOKENS, IMAGE_TOKEN_EQUIVALENT, expect.anything());
    expect(ai.recordGeneration.mock.calls[0][2].costAmount).toBe(0.04);
  });
});

describe('内容包同样走额度闸', () => {
  it('额度用完返回 429 中文提示（原来抛普通 Error，界面只看到「服务暂时出错」）', async () => {
    const ai = { assertTenantDailyBudget: jest.fn().mockResolvedValue(undefined), generateTitlesWithUsage: jest.fn() };
    const usage = { checkQuota: jest.fn().mockResolvedValue(false), trackUsage: jest.fn() };
    const pack = new ContentPackService(ai as never, usage as never, {} as never, {} as never);
    const error = await pack.generatePack('t', { topic: '主题' } as never, 'u').catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(JSON.stringify(error.getResponse())).toContain('本月 AI 额度已用完');
    expect(ai.generateTitlesWithUsage).not.toHaveBeenCalled();
  });

  it('先查今日预算', async () => {
    const ai = { assertTenantDailyBudget: jest.fn().mockRejectedValue(new HttpException('今日 AI 用量已达上限', 429)), generateTitlesWithUsage: jest.fn() };
    const usage = { checkQuota: jest.fn().mockResolvedValue(true), trackUsage: jest.fn() };
    const pack = new ContentPackService(ai as never, usage as never, {} as never, {} as never);
    await expect(pack.generatePack('t', { topic: '主题' } as never, 'u')).rejects.toBeInstanceOf(HttpException);
    expect(ai.generateTitlesWithUsage).not.toHaveBeenCalled();
  });
});
