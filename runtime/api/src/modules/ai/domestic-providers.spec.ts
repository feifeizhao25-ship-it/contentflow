import { AIService, AI_NOT_CONFIGURED_MESSAGE, AI_UNAVAILABLE_MESSAGE, DOMESTIC_CHAT_ENDPOINTS, DASHSCOPE_IMAGE_SYNTHESIS, MAX_SCRIPT_SCENES } from './ai.service';
import { AIController } from './ai.controller';
import { AI_TEXT_LABEL } from '../../common/ai-content-label';

/**
 * 国内版的文本生成原来一次也成功不了：千问地址写成 DashScope 不存在的
 * /api/v1/chat/completions；未指定模型时一律 qwen-turbo，只配了 DeepSeek 的部署永远
 * 「QWEN key 未配置」。图片生成只会调 fal.ai（境外）。
 */
function service(env: Record<string, unknown>) {
  const config = { get: jest.fn((key: string, fallback: unknown) => (key in env ? env[key] : fallback)) };
  return new AIService({} as never, config as never);
}

function chatOk(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 } }) };
}

describe('domestic text generation', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('uses DeepSeek when only DEEPSEEK_API_KEY is configured', async () => {
    global.fetch = jest.fn().mockResolvedValue(chatOk('好')) as jest.Mock;
    const result = await service({ MARKET_REGION: 'cn', DEEPSEEK_API_KEY: 'dk' }).generateText({ prompt: '测试' });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(DOMESTIC_CHAT_ENDPOINTS.deepseek);
    // 官方已停用 deepseek-chat 这个模型名（2026-07-24），默认改用现行的 deepseek-flash
    expect(JSON.parse(init.body).model).toBe('deepseek-flash');
    expect(result.provider).toBe('deepseek');
  });

  it('calls DashScope on its OpenAI-compatible path', async () => {
    global.fetch = jest.fn().mockResolvedValue(chatOk('好')) as jest.Mock;
    await service({ MARKET_REGION: 'cn', QWEN_API_KEY: 'qk' }).generateText({ prompt: '测试' });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    expect(JSON.parse(init.body).model).toBe('qwen-turbo');
  });

  it('falls back to the other domestic provider when the first fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(chatOk('来自 DeepSeek')) as jest.Mock;
    const result = await service({ MARKET_REGION: 'cn', QWEN_API_KEY: 'qk', DEEPSEEK_API_KEY: 'dk' }).generateText({ prompt: '测试' });
    expect(result.content).toBe('来自 DeepSeek');
    expect((global.fetch as jest.Mock).mock.calls.map((c) => c[0])).toEqual([DOMESTIC_CHAT_ENDPOINTS.qwen, DOMESTIC_CHAT_ENDPOINTS.deepseek]);
  });

  it('never leaves the country, even with an OpenRouter key present', async () => {
    global.fetch = jest.fn().mockResolvedValue(chatOk('好')) as jest.Mock;
    await service({ MARKET_REGION: 'cn', DEEPSEEK_API_KEY: 'dk', OPENROUTER_API_KEY: 'or' }).generateText({ prompt: '测试' });
    for (const [url] of (global.fetch as jest.Mock).mock.calls) expect(String(url)).not.toContain('openrouter');
  });
});

describe('国内模型不可用时给出明确的中文原因', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('所有国内模型都失败：503「AI 服务暂不可用，请稍后再试」，供应商细节只写日志', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}), text: async () => 'upstream down' }) as jest.Mock;
    const svc = service({ MARKET_REGION: 'cn', QWEN_API_KEY: 'qk', DEEPSEEK_API_KEY: 'dk' });
    const logged = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    const error = await svc.generateText({ prompt: '测试' }).catch((e) => e);
    expect(error.getStatus()).toBe(503);
    expect(error.message).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(logged.mock.calls.flat().join(' ')).toMatch(/qwen:503.*deepseek:503/);
  });

  it('经 HTTP 层后界面拿到的就是这句中文（不会被换成「服务暂时出错」）', async () => {
    const { HttpExceptionFilter } = await import('../../common/filters/http-exception.filter');
    const svc = service({ MARKET_REGION: 'cn', QWEN_API_KEY: 'qk' });
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as jest.Mock;
    jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    const error = await svc.analyzeViralContentWithUsage('内容').catch((e) => e);
    const json = jest.fn();
    const res: any = { status: jest.fn(() => ({ json })) };
    new HttpExceptionFilter().catch(error, { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ url: '/api/v1/ai/analyze/viral', method: 'POST' }) }) } as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(json.mock.calls[0][0])).toContain(AI_UNAVAILABLE_MESSAGE);
  });
});

describe('domestic image generation', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('uses Tongyi Wanxiang instead of fal.ai, even when FAL_API_KEY is set', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: { task_id: 't-1', task_status: 'PENDING' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: { task_status: 'RUNNING' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'https://dashscope-result.oss-cn-beijing.aliyuncs.com/a.png' }] } }) }) as jest.Mock;
    const svc = service({ MARKET_REGION: 'cn', QWEN_API_KEY: 'qk', FAL_API_KEY: 'fal', DASHSCOPE_IMAGE_POLL_INTERVAL_MS: 0 });
    const result = await svc.generateImage({ prompt: '一杯咖啡', size: '720x1280' });
    expect(result.url).toContain('aliyuncs.com');
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe(DASHSCOPE_IMAGE_SYNTHESIS);
    expect(calls[0][1].headers['X-DashScope-Async']).toBe('enable');
    expect(JSON.parse(calls[0][1].body).parameters.size).toBe('720*1280');
    for (const [url] of calls) expect(String(url)).not.toContain('fal.');
  });

  it('explains which key is needed instead of calling abroad', async () => {
    global.fetch = jest.fn() as jest.Mock;
    const svc = service({ MARKET_REGION: 'cn', DEEPSEEK_API_KEY: 'dk', FAL_API_KEY: 'fal' });
    // 给用户的是中文 503「AI 服务暂未开通」；缺哪个密钥只写日志给运维看（原来把 QWEN_API_KEY 原文抛给前端）
    const logged = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    const error = await svc.generateImage({ prompt: 'x' }).catch((e) => e);
    expect(error.getStatus()).toBe(503);
    expect(error.message).toBe(AI_NOT_CONFIGURED_MESSAGE);
    expect(logged.mock.calls.flat().join(' ')).toContain('QWEN_API_KEY');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports a failed task', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: { task_id: 't-2' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output: { task_status: 'FAILED', code: 'DataInspectionFailed' } }) }) as jest.Mock;
    const svc = service({ MARKET_REGION: 'cn', QWEN_API_KEY: 'qk', DASHSCOPE_IMAGE_POLL_INTERVAL_MS: 0 });
    // 内容安全拦截：给用户能处理的中文原因（400），平台返回的代码写日志
    const logged = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    const error = await svc.generateImage({ prompt: 'x' }).catch((e) => e);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('没有通过内容安全检查');
    expect(logged.mock.calls.flat().join(' ')).toContain('DataInspectionFailed');
  });
});

describe('storyboard script', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('parses fenced JSON, caps scene count and clamps durations', async () => {
    const scenes = Array.from({ length: 20 }, (_, i) => ({ visual: `画面${i}`, subtitle: `字幕${i}`, time: i === 0 ? 99 : 5 }));
    global.fetch = jest.fn().mockResolvedValue(chatOk('```json\n' + JSON.stringify({ title: '标题', scenes }) + '\n```')) as jest.Mock;
    const result = await service({ MARKET_REGION: 'cn', DEEPSEEK_API_KEY: 'dk' }).generateScript({ topic: '咖啡' });
    expect(result.title).toBe('标题');
    expect(result.scenes).toHaveLength(MAX_SCRIPT_SCENES);
    expect(result.scenes[0].time).toBe(30);
  });

  it('the endpoint records the generation and returns the AIGC label', async () => {
    const recorded: unknown[] = [];
    const fake = {
      assertTenantDailyBudget: async () => undefined,
      generateScript: async () => ({ title: 't', scenes: [{ visual: 'v', subtitle: 's', time: 5 }], provider: 'deepseek', model: 'deepseek-chat', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, latency_ms: 1, cost_amount: null }),
      recordGeneration: async (...args: unknown[]) => { recorded.push(args); },
    };
    const allowance = { assertAllowed: async () => undefined, chargeTokens: async () => undefined, chargeImage: async () => undefined };
    const controller = new AIController(fake as never, allowance as never);
    const body = await controller.generateScript({ user: { tenantId: 't-1', sub: 'u-1' } }, { topic: '咖啡' });
    expect(body).toEqual({ title: 't', scenes: [{ visual: 'v', subtitle: 's', time: 5 }], aiLabel: AI_TEXT_LABEL });
    expect(recorded).toHaveLength(1);
    await expect(controller.generateScript({ user: { tenantId: 't-1', sub: 'u-1' } }, { topic: ' ' })).rejects.toThrow('创作主题');
  });
});
