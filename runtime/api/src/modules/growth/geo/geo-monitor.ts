export const GEO_PLATFORMS = ['doubao', 'yuanbao', 'deepseek', 'qwen', 'kimi'] as const;
export type GeoPlatform = (typeof GEO_PLATFORMS)[number];
export type GeoSurface = 'app' | 'web';

export interface GeoObservation {
  week: string;
  platform: GeoPlatform;
  surface: GeoSurface;
  query: string;
  cited: boolean;
  url?: string;
}

export interface GeoEnv {
  GEO_MONITOR_ENABLED?: string;
}

export function recordObservation(obs: GeoObservation, env: GeoEnv = process.env): { stored: boolean; reason?: string; observation?: GeoObservation } {
  if (env.GEO_MONITOR_ENABLED !== '1') return { stored: false, reason: 'GEO 监测未打开' };
  if (!GEO_PLATFORMS.includes(obs.platform)) return { stored: false, reason: '未知平台' };
  if (obs.surface !== 'app' && obs.surface !== 'web') return { stored: false, reason: 'surface 只能是 app 或 web' };
  if (!/^\d{4}-W\d{2}$/.test(obs.week)) return { stored: false, reason: 'week 需为 YYYY-Www' };
  if (!obs.query.trim()) return { stored: false, reason: '缺少查询词' };
  return { stored: true, observation: { ...obs, query: obs.query.trim().slice(0, 120) } };
}

/** 不主动抓取 AI 搜索页面。 */
export function pullFromProviders(): never {
  throw new Error('GEO 监测不主动抓取，只接受人工或官方接口录入');
}
