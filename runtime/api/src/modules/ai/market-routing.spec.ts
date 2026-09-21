import {
  assertDomesticProviderConfigured,
  isDomesticMarket,
  resolveTextProvider,
} from './market-routing';

/**
 * 这一组钉的是"国内栈不出境"这条边界。
 *
 * 原来的判断只有 `if (this.openRouterApiKey)`——只要环境里有这把 key，
 * 国内栈也会走 openrouter.ai，而 compose 当时确实给 api-cn 注入了它。
 * 把它从 compose 删掉是必要的，但不够：下一个人加回来就又出境了，
 * 而且不会有任何报错。所以两头都钉：**有 key 也不许走**，
 * 以及**境外市场不能被误伤**。
 */
describe('国内市场的模型供应商边界', () => {
  const offshoreDefaultModel = 'qwen/qwen3-30b-a3b-instruct-2507';

  it('国内市场即使配了 OPENROUTER_API_KEY 也不走聚合路由', () => {
    const decision = resolveTextProvider({
      marketRegion: 'cn',
      openRouterApiKey: 'sk-or-should-be-ignored',
      offshoreDefaultModel,
    });
    expect(decision.useOpenRouter).toBe(false);
    expect(decision.model).toBe('qwen-turbo');
  });

  it.each(['cn', 'CN', ' Cn ', 'china', 'zh-CN'])('市场标识 %p 都算国内', (market) => {
    expect(isDomesticMarket(market)).toBe(true);
    expect(
      resolveTextProvider({ marketRegion: market, openRouterApiKey: 'k', offshoreDefaultModel })
        .useOpenRouter,
    ).toBe(false);
  });

  it('境外市场不受影响：有 key 就照常走聚合路由', () => {
    const decision = resolveTextProvider({
      marketRegion: 'global',
      openRouterApiKey: 'sk-or-real',
      offshoreDefaultModel,
    });
    expect(decision.useOpenRouter).toBe(true);
    expect(decision.model).toBe(offshoreDefaultModel);
  });

  it('境外市场没有 key 时回落到境内直连，而不是报错', () => {
    const decision = resolveTextProvider({
      marketRegion: 'global',
      openRouterApiKey: '',
      offshoreDefaultModel,
    });
    expect(decision.useOpenRouter).toBe(false);
    expect(decision.model).toBe('qwen-turbo');
  });

  it('国内市场拒绝聚合路由风格的模型标识', () => {
    // DashScope / DeepSeek 的端点不认识 "厂商/模型" 这种命名，
    // 发出去必然 400。与其让用户看到一个含糊的上游错误，不如在这里说清楚。
    expect(() =>
      resolveTextProvider({
        marketRegion: 'cn',
        openRouterApiKey: '',
        requestedModel: 'deepseek/deepseek-v3.2',
        offshoreDefaultModel,
      }),
    ).toThrow('聚合路由风格的模型标识');
  });

  it('国内市场接受境内供应商自己的模型名', () => {
    const decision = resolveTextProvider({
      marketRegion: 'cn',
      openRouterApiKey: '',
      requestedModel: 'deepseek-chat',
      offshoreDefaultModel,
    });
    expect(decision.useOpenRouter).toBe(false);
    expect(decision.model).toBe('deepseek-chat');
  });

  it('境外市场仍可使用带斜杠的模型标识', () => {
    const decision = resolveTextProvider({
      marketRegion: 'global',
      openRouterApiKey: 'k',
      requestedModel: 'google/gemini-2.5-flash-lite',
      offshoreDefaultModel,
    });
    expect(decision.useOpenRouter).toBe(true);
    expect(decision.model).toBe('google/gemini-2.5-flash-lite');
  });
});

describe('国内栈必须有境内供应商凭据', () => {
  it('两把都没有就在启动阶段拒绝', () => {
    expect(() =>
      assertDomesticProviderConfigured({ marketRegion: 'cn', qwenApiKey: '', deepseekApiKey: '' }),
    ).toThrow('QWEN_API_KEY 或 DEEPSEEK_API_KEY');
  });

  it.each([
    ['qwen', { qwenApiKey: 'k', deepseekApiKey: '' }],
    ['deepseek', { qwenApiKey: '', deepseekApiKey: 'k' }],
  ])('有 %s 一把就够', (_name, keys) => {
    expect(() =>
      assertDomesticProviderConfigured({ marketRegion: 'cn', ...keys }),
    ).not.toThrow();
  });

  it('境外市场不做这项检查', () => {
    expect(() =>
      assertDomesticProviderConfigured({
        marketRegion: 'global',
        qwenApiKey: '',
        deepseekApiKey: '',
      }),
    ).not.toThrow();
  });
});
