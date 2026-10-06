/**
 * 北京时间（UTC+8，无夏令时）下的自然日 / 自然月。
 *
 * 套餐的「每月 N 条发布」「每月 N 万 AI 令牌」按北京时间自然月计；
 * 原来用 `new Date().toISOString().substring(0, 7)`（UTC 月份），
 * 北京时间每月 1 日 0:00–8:00 仍算上个月。
 */
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 'YYYY-MM'（北京时间）。 */
export function chinaMonthPeriod(now: Date | number = Date.now()): string {
  const shifted = new Date(new Date(now).getTime() + CHINA_OFFSET_MS);
  return shifted.toISOString().substring(0, 7);
}

/** 北京时间当天 0 点对应的 UTC 时刻。 */
export function chinaDayStart(now: Date | number = Date.now()): Date {
  const shifted = new Date(new Date(now).getTime() + CHINA_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - CHINA_OFFSET_MS);
}

/** 北京时间本月 1 日 0 点对应的 UTC 时刻。 */
export function chinaMonthStart(now: Date | number = Date.now()): Date {
  const shifted = new Date(new Date(now).getTime() + CHINA_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - CHINA_OFFSET_MS);
}
