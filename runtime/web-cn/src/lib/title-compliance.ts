/**
 * 创作页标题：按主题里的「N个标题」截断，去掉「N个…爆款标题」包装，并把合规结果标成中文。
 * 数量和包装的判断与 runtime/api 的 title-parser 保持一致。
 */
import type { ComplianceView } from './compliance-view';

export type TitleStatusText = '违规' | '需复核' | '未发现' | '未能检查' | '检查中';

const TITLE_PACKAGING = /^(?:\d{1,2}|[一二两三四五六七八九十])\s*个.{0,30}爆款标题/;
const CN_TITLE_COUNT: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};
const TITLE_COUNT_IN_TOPIC = /(\d{1,2}|[一二两三四五六七八九十])\s*个\s*(?:(?:小红书|抖音|快手|视频号|微博|哔哩哔哩|b站|爆款)\s*){0,3}标题/;

export function isTitlePackagingLine(line: string): boolean {
  return TITLE_PACKAGING.test(String(line || '').normalize('NFKC').trim());
}

/** 主题指定了 1–10 个标题时用这个数；否则用调用方的默认数量。 */
export function requestedTitleCount(topic: string, fallback: number): number {
  const safeFallback = Number.isInteger(fallback) && fallback >= 1 && fallback <= 10 ? fallback : 5;
  const matched = String(topic || '').normalize('NFKC').match(TITLE_COUNT_IN_TOPIC);
  if (!matched) return safeFallback;
  const raw = matched[1];
  const count = CN_TITLE_COUNT[raw] ?? Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > 10) return safeFallback;
  return count;
}

export function cleanDisplayedTitles(titles: readonly unknown[], topic: string, fallbackCount: number): string[] {
  const count = requestedTitleCount(topic, fallbackCount);
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of titles) {
    if (typeof raw !== 'string') continue;
    const title = raw.trim();
    if (!title || isTitlePackagingLine(title)) continue;
    if (seen.has(title)) continue;
    seen.add(title);
    cleaned.push(title);
    if (cleaned.length >= count) break;
  }
  return cleaned;
}

/** 合规检查结果 → 标题旁的中文状态。认不出结果时不假装「未发现」。 */
export function titleStatusLabel(view: ComplianceView | null | undefined): TitleStatusText {
  if (!view) return '未能检查';
  if (view.level === 'violation' || view.hits.some((hit) => hit.severity === 'block')) return '违规';
  if (view.level === 'risk' || view.hits.some((hit) => hit.severity === 'review')) return '需复核';
  return '未发现';
}
