export interface GrowthBookEnv {
  GROWTHBOOK_ENABLED?: string;
  GROWTHBOOK_API_HOST?: string;
  GROWTHBOOK_CLIENT_KEY?: string;
}

export interface VariationResult {
  value: string;
  source: 'default' | 'growthbook';
}

/**
 * 自托管 GrowthBook。开关、地址或 client key 缺任一则返回默认值，不发起请求。
 * client key 只从环境读取，不写进仓库。
 */
export async function resolveVariation(
  featureKey: string,
  fallback: string,
  deps: { env?: GrowthBookEnv; fetchImpl?: typeof fetch } = {},
): Promise<VariationResult> {
  const env = deps.env ?? process.env;
  const enabled = env.GROWTHBOOK_ENABLED === '1' && Boolean(env.GROWTHBOOK_API_HOST) && Boolean(env.GROWTHBOOK_CLIENT_KEY);
  if (!enabled || !deps.fetchImpl || !env.GROWTHBOOK_API_HOST) return { value: fallback, source: 'default' };
  const url = new URL('/api/features/', env.GROWTHBOOK_API_HOST);
  const response = await deps.fetchImpl(url.toString(), {
    headers: { authorization: `Bearer ${env.GROWTHBOOK_CLIENT_KEY}` },
  });
  if (!response.ok) return { value: fallback, source: 'default' };
  const payload = (await response.json()) as { features?: Record<string, { defaultValue?: string }> };
  const value = payload.features?.[featureKey]?.defaultValue;
  if (typeof value !== 'string') return { value: fallback, source: 'default' };
  return { value, source: 'growthbook' };
}
