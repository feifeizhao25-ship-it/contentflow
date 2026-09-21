/**
 * 国内市场的模型供应商边界。
 *
 * ## 为什么要有这个文件
 *
 * `AIService.generateText` 原来的判断是：
 *
 *     if (this.openRouterApiKey) { ...走 openrouter.ai... }
 *     // 否则才走 DeepSeek / DashScope
 *
 * 也就是说 **只要环境里恰好有这把 key，国内栈也会走境外供应商**，
 * 而 `docker-compose.production.yml` 里 `api-cn` 和 `web-cn` 当时都注入了
 * `OPENROUTER_API_KEY`。配置层和代码层没有任何一处知道"这是国内栈"。
 *
 * 把它从 compose 里删掉是必要的，但不够：下一个人加回来就又出境了，
 * 而且不会有任何报错。所以边界要写在代码里，由 `MARKET_REGION` 决定，
 * 配置只能收紧、不能放宽。
 *
 * 单独成文件是为了能脱离 Nest 的依赖注入直接做单元测试。
 */

/** OpenRouter 风格的模型标识（含 `/`），境内端点不认识这种 id。 */
const VENDOR_SCOPED_MODEL = /\//;

export const DOMESTIC_MARKETS = new Set(['cn', 'china', 'zh-cn']);

export function isDomesticMarket(marketRegion: string | undefined | null): boolean {
  return DOMESTIC_MARKETS.has(String(marketRegion ?? '').trim().toLowerCase());
}

export interface TextProviderInput {
  /** 来自 MARKET_REGION 环境变量 */
  marketRegion?: string | null;
  /** 来自 OPENROUTER_API_KEY 环境变量 */
  openRouterApiKey?: string | null;
  /** 调用方显式指定的模型，未指定时由本函数给缺省值 */
  requestedModel?: string | null;
  /** 国内默认模型；来自 OPENROUTER_MODEL_FAST 的等价物，但只用于境外市场 */
  offshoreDefaultModel: string;
  domesticDefaultModel?: string;
}

export interface TextProviderDecision {
  useOpenRouter: boolean;
  model: string;
}

/**
 * 决定这一次生成走境外聚合路由还是境内直连。
 *
 * 国内市场一律返回 `useOpenRouter: false`，**不论 key 在不在**。
 */
export function resolveTextProvider(input: TextProviderInput): TextProviderDecision {
  const domestic = isDomesticMarket(input.marketRegion);
  const key = String(input.openRouterApiKey ?? '');
  const useOpenRouter = !domestic && key.length > 0;

  if (input.requestedModel) {
    if (domestic && VENDOR_SCOPED_MODEL.test(input.requestedModel)) {
      // 形如 qwen/qwen3-30b-a3b-instruct-2507 的是聚合路由的命名，
      // DashScope 与 DeepSeek 的端点不认识它。与其把一个必然 400 的
      // 请求发出去，不如在这里说清楚。
      throw new Error(
        `国内市场不接受聚合路由风格的模型标识「${input.requestedModel}」；` +
          '请使用境内供应商自己的模型名（如 qwen-turbo、deepseek-chat）。',
      );
    }
    return { useOpenRouter, model: input.requestedModel };
  }

  const model = useOpenRouter
    ? input.offshoreDefaultModel
    : input.domesticDefaultModel ?? 'qwen-turbo';
  return { useOpenRouter, model };
}

/**
 * 国内栈至少要有一把境内供应商的 key，否则生成链路是哑的。
 * 在**启动时**就说清楚，而不是等第一个用户点了生成才报。
 */
export function assertDomesticProviderConfigured(input: {
  marketRegion?: string | null;
  qwenApiKey?: string | null;
  deepseekApiKey?: string | null;
}): void {
  if (!isDomesticMarket(input.marketRegion)) return;
  if (String(input.qwenApiKey ?? '') || String(input.deepseekApiKey ?? '')) return;
  throw new Error(
    'MARKET_REGION=cn 时必须配置 QWEN_API_KEY 或 DEEPSEEK_API_KEY 之一；' +
      '国内栈不接受境外模型供应商作为替代。',
  );
}
