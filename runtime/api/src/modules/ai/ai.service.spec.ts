import { AIService } from './ai.service';

describe('AIService OpenRouter routing', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('uses tested economical models with privacy-safe fallback routing', async () => {
    const config = {
      get: jest.fn((key: string, fallback: string) => ({
        OPENROUTER_API_KEY: 'test-key',
        OPENROUTER_MODEL_FAST: 'qwen/qwen3-30b-a3b-instruct-2507',
        OPENROUTER_FALLBACK_MODELS: 'deepseek/deepseek-v3.2,google/gemini-2.5-flash-lite',
      }[key] ?? fallback)),
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: 'qwen/qwen3-30b-a3b-instruct-2507', choices: [{ message: { content: '可用内容' } }], usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6, cost: 0.000001 } }),
    }) as jest.Mock;
    const service = new AIService({} as never, config as never);
    const result = await service.generateText({ prompt: '测试', maxTokens: 99999 });
    expect(result.usage.total_tokens).toBe(6);
    expect(result.model).toBe('qwen/qwen3-30b-a3b-instruct-2507');
    expect(result.provider).toBe('openrouter');
    expect(result.cost_usd).toBe(0.000001);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.models).toEqual(['qwen/qwen3-30b-a3b-instruct-2507', 'deepseek/deepseek-v3.2', 'google/gemini-2.5-flash-lite']);
    expect(body.provider).toEqual({ data_collection: 'deny', zdr: true, require_parameters: true });
    expect(body.max_tokens).toBe(4000);
  });

  it('fails closed when OpenRouter returns empty content', async () => {
    const config = { get: jest.fn((key: string, fallback: string) => key === 'OPENROUTER_API_KEY' ? 'test-key' : fallback) };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '' } }] }) }) as jest.Mock;
    const service = new AIService({} as never, config as never);
    await expect(service.generateText({ prompt: '测试' })).rejects.toThrow('empty content');
  });

  it('opens the circuit after consecutive provider failures', async () => {
    const config = {
      get: jest.fn((key: string, fallback: unknown) => ({
        OPENROUTER_API_KEY: 'test-key',
        OPENROUTER_CIRCUIT_FAILURES: 2,
        OPENROUTER_CIRCUIT_COOLDOWN_MS: 60000,
      }[key] ?? fallback)),
    };
    global.fetch = jest.fn().mockRejectedValue(new Error('network unavailable')) as jest.Mock;
    const service = new AIService({} as never, config as never);
    await expect(service.generateText({ prompt: '测试1' })).rejects.toThrow('network unavailable');
    await expect(service.generateText({ prompt: '测试2' })).rejects.toThrow('network unavailable');
    await expect(service.generateText({ prompt: '测试3' })).rejects.toThrow('circuit is open');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('blocks a tenant that has reached its daily AI cost budget', async () => {
    const config = { get: jest.fn((key: string, fallback: unknown) => key === 'AI_TENANT_DAILY_BUDGET_USD' ? 1 : fallback) };
    const prisma = { aIGeneration: { aggregate: jest.fn().mockResolvedValue({ _sum: { cost_amount: 1.01 } }) } };
    const service = new AIService(prisma as never, config as never);
    await expect(service.assertTenantDailyBudget('tenant-1')).rejects.toThrow('daily budget exceeded');
  });

  it('reports the 80 percent budget warning level', async () => {
    const config = { get: jest.fn((key: string, fallback: unknown) => key === 'AI_TENANT_DAILY_BUDGET_USD' ? 10 : fallback) };
    const prisma = { aIGeneration: { aggregate: jest.fn().mockResolvedValue({ _sum: { cost_amount: 8.5 } }) } };
    const service = new AIService(prisma as never, config as never);
    const usage = await service.getTenantDailyBudgetUsage('tenant-1');
    expect(usage.warning_level).toBe('warning');
    expect(usage.remaining_usd).toBe(1.5);
  });
});
