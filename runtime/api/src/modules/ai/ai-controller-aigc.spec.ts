/**
 * AI 生成内容标识（《人工智能生成合成内容标识办法》）在接口出口的覆盖：
 *
 *  - generate/article：返回的正文没有任何标识（只有 generate/script 返回了 aiLabel，
 *    而且前端从未显示它）；
 *  - generate/image：返回裸图片地址，没有显式/隐式标识字段；也没有做每日预算检查
 *    （其它生成接口都做了）；生成记录里写死了 fal.ai / nano-banana-pro（境外服务名，而国内版实际走通义万相）。
 * 走真实 configureApp，只替换登录守卫与 AIService。
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { configureApp } from '../../bootstrap';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AiAllowanceService } from './ai-allowance.service';
import { finalizeReservedResponse, UsageService } from '../system/usage.service';

describe('AI 接口的 AIGC 标识', () => {
  let app: INestApplication;
  const ai = {
    assertTenantDailyBudget: jest.fn(),
    generateArticle: jest.fn(),
    generateImage: jest.fn(),
    recordGeneration: jest.fn(),
  };
  const usage = { withAiHold: jest.fn(), saved: [] as Array<{ generation?: { outputContent?: string; modelProvider?: string } }> };
  const previousRegion = process.env.MARKET_REGION;

  beforeEach(async () => {
    jest.resetAllMocks();
    process.env.MARKET_REGION = 'cn';
    ai.assertTenantDailyBudget.mockResolvedValue(undefined);
    usage.saved = [];
    usage.withAiHold.mockImplementation(async (_input: unknown, run: () => Promise<{ generation?: { outputContent?: string; modelProvider?: string }; response: unknown; attachContentId?: 'image' | 'text' | null }>) => {
      const produced = await run();
      usage.saved.push(produced);
      return finalizeReservedResponse(produced, 'gen-1');
    });
    ai.generateArticle.mockResolvedValue({ content: '一篇正文', visualPrompts: [], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }, provider: 'dashscope', model: 'qwen-plus', latency_ms: 5, cost_amount: null });
    ai.generateImage.mockResolvedValue({ url: 'https://dashscope-result.oss-cn-beijing.aliyuncs.com/a.png', provider: 'dashscope', model: 'wanx2.1-t2i-turbo' });
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

  it('generate/article：正文带「AI 生成」显式标识，并给出 aiLabel / aiGenerated', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/ai/generate/article').send({ topic: '主题' });
    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.content.startsWith(AI_TEXT_LABEL)).toBe(true);
    expect(data.aiLabel).toBe(AI_TEXT_LABEL);
    expect(data.aiGenerated).toBe(true);
  });

  it('generate/article：留存的生成记录里也是带标识的正文（导出个人信息时同样可辨识）', async () => {
    await request(app.getHttpServer()).post('/api/v1/ai/generate/article').send({ topic: '主题' });
    expect(usage.saved[0].generation?.outputContent?.startsWith(AI_TEXT_LABEL)).toBe(true);
  });

  it('generate/image：返回显式标识与隐式标识元数据', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/ai/generate/image').send({ prompt: '一只猫' });
    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.aiGenerated).toBe(true);
    expect(data.aiLabel).toBe(AI_TEXT_LABEL);
    expect(data.aiMetadata).toMatchObject({ ai_generated: true, media_type: 'image', generator: expect.any(String) });
    expect(data.url).toMatch(/^https:\/\//);
  });

  it('generate/image：先做每日预算检查（与其它生成接口一致）', async () => {
    ai.assertTenantDailyBudget.mockRejectedValue(new Error('今日 AI 预算已用完'));
    const res = await request(app.getHttpServer()).post('/api/v1/ai/generate/image').send({ prompt: '一只猫' });
    expect(res.status).toBe(500);
    expect(ai.generateImage).not.toHaveBeenCalled();
  });

  it('generate/image：生成记录写真实的供应商，国内版不再记成 fal.ai', async () => {
    await request(app.getHttpServer()).post('/api/v1/ai/generate/image').send({ prompt: '一只猫' });
    const record = usage.saved[0].generation;
    expect(record?.modelProvider).toBe('dashscope');
    expect(JSON.stringify(record)).not.toMatch(/fal\.ai|nano-banana/);
  });
});
