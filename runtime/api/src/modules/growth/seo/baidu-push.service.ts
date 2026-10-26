export interface BaiduEnv {
  BAIDU_PUSH_ENABLED?: string;
  BAIDU_PUSH_TOKEN?: string;
  BAIDU_PUSH_SITE?: string;
}

export function baiduPushReady(env: BaiduEnv = process.env): boolean {
  return env.BAIDU_PUSH_ENABLED === '1' && Boolean(env.BAIDU_PUSH_TOKEN) && Boolean(env.BAIDU_PUSH_SITE);
}

/** 未配置时不推送、不读取硬编码 token。返回值不含 token。 */
export async function pushUrls(
  urls: string[],
  env: BaiduEnv = process.env,
  fetchImpl?: typeof fetch,
): Promise<{ pushed: false; reason: string } | { pushed: true; count: number }> {
  if (!baiduPushReady(env)) return { pushed: false, reason: '百度普通收录未配置' };
  if (!fetchImpl || !env.BAIDU_PUSH_SITE || !env.BAIDU_PUSH_TOKEN) return { pushed: false, reason: '百度普通收录未配置' };
  const endpoint = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(env.BAIDU_PUSH_SITE)}&token=${encodeURIComponent(env.BAIDU_PUSH_TOKEN)}`;
  const response = await fetchImpl(endpoint, { method: 'POST', body: urls.join('\n') });
  if (!response.ok) return { pushed: false, reason: '百度普通收录拒绝了本次推送' };
  return { pushed: true, count: urls.length };
}
