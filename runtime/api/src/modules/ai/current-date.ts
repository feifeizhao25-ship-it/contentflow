/**
 * 复测 B22：生成的标题里出现过期年份（「Top 5 Home Espresso Machines of 2023!」，当前已是 2026 年）。
 * 模型不知道今天的日期。两道防线：
 * 1) 提示词里写明今天的日期，并要求不要用更早的年份当「今年」；
 * 2) 生成之后，把带过期「年份标记」的标题剔除（「of 2023」「2023年」「2023 Guide」这种把年份当卖点的写法）。
 *    历史事实里的年份（"since 2019"）不动。
 */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function currentDatePromptLine(global: boolean, now: Date = new Date()): string {
  const iso = todayIso(now);
  const y = now.getUTCFullYear();
  return global
    ? ` Today's date is ${iso}. If you mention a year as "this year", "latest" or "current", use ${y}; never present an earlier year as current.`
    : ` 今天的日期是${iso}。如果要写「今年」「最新」「当前」的年份，请用${y}年；不要把更早的年份当成当前年份。`;
}

const YEAR = '(?:19|20)\\d{2}';
// 把年份当作「版本/年度」标记的写法
const BADGE_PATTERNS: RegExp[] = [
  new RegExp(`\\b(?:of|in|for|best|top|guide|edition|update[d]?|new|latest)\\s+(${YEAR})\\b`, 'gi'),
  new RegExp(`\\b(${YEAR})\\s+(?:guide|edition|update|picks|list|ranking|review|reviews|best|top|trends?|must[- ]haves?)\\b`, 'gi'),
  new RegExp(`(${YEAR})\\s*(?:年度|年最新|年新款|年版|年必|新款|最新)`, 'g'),
  new RegExp(`(?:^|[^\\d])(${YEAR})\\s*年(?![代初末中])`, 'g'),
];

export function findStaleYears(text: string, now: Date = new Date()): number[] {
  const current = now.getUTCFullYear();
  const found = new Set<number>();
  for (const re of BADGE_PATTERNS) {
    for (const m of (text ?? '').matchAll(re)) {
      const y = Number(m[1]);
      if (y < current) found.add(y);
    }
  }
  return [...found].sort();
}

export interface StaleYearResult {
  titles: string[];
  removed: Array<{ title: string; years: number[] }>;
}

/** Drops titles that use an earlier year as a badge. If every title is stale we keep them (and report), rather than return nothing. */
export function dropStaleYearTitles(titles: string[], now: Date = new Date()): StaleYearResult {
  const flagged = titles.map((title) => ({ title, years: findStaleYears(title, now) }));
  const kept = flagged.filter((f) => f.years.length === 0).map((f) => f.title);
  const removed = flagged.filter((f) => f.years.length > 0);
  if (kept.length === 0) return { titles, removed: [] };
  return { titles: kept, removed };
}
