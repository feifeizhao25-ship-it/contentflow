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

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ZH_DAYS = ['日', '一', '二', '三', '四', '五', '六'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The next seven days with their weekdays, so the model never has to work out a weekday itself. */
function weekAhead(global: boolean, now: Date): string {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    days.push(global
      ? `${EN_DAYS[d.getUTCDay()]} ${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
      : `${d.getUTCMonth() + 1}月${d.getUTCDate()}日周${ZH_DAYS[d.getUTCDay()]}`);
  }
  return days.join(global ? ', ' : '、');
}

/**
 * 2026-11-21 测试：海外版内容包写了「this Saturday, November 22」，可 2026-11-22 是星期天。
 * 提示词只给了日期，没给星期，模型自己推星期推错了。现在把今天是星期几、以及往后 7 天的日期和星期都写进去。
 */
export function currentDatePromptLine(global: boolean, now: Date = new Date()): string {
  const iso = todayIso(now);
  const y = now.getUTCFullYear();
  return global
    ? ` Today's date is ${EN_DAYS[now.getUTCDay()]}, ${iso}. If you mention a year as "this year", "latest" or "current", use ${y}; never present an earlier year as current. The next seven days are: ${weekAhead(true, now)}. Only pair a weekday with a date from this list; otherwise leave the weekday out.`
    : ` 今天的日期是${iso}，星期${ZH_DAYS[now.getUTCDay()]}。如果要写「今年」「最新」「当前」的年份，请用${y}年；不要把更早的年份当成当前年份。往后 7 天依次是：${weekAhead(false, now)}。写星期几时只能用这里对得上的日期，对不上就不写星期。`;
}

const EN_DAY_RE = '(Sun(?:day)?|Mon(?:day)?|Tue(?:s|sday)?|Wed(?:nesday)?|Thu(?:r|rs|rsday)?|Fri(?:day)?|Sat(?:urday)?)';
const EN_MONTH_RE = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const ZH_DAY_RE = '(周|星期|礼拜)([一二三四五六日天])';

function enDayIndex(token: string): number {
  return EN_DAYS.findIndex((d) => d.slice(0, 3).toLowerCase() === token.slice(0, 3).toLowerCase());
}
function enMonthIndex(token: string): number {
  return EN_MONTHS.findIndex((m) => m.slice(0, 3).toLowerCase() === token.slice(0, 3).toLowerCase());
}
function zhDayIndex(ch: string): number {
  return ch === '天' ? 0 : ZH_DAYS.indexOf(ch);
}
/** A month/day without a year: take the occurrence closest to today (late December copy about "Jan 3" means next year). */
function weekdayOf(month: number, day: number, now: Date, year?: number): number | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const candidates = year ? [year] : [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1];
  let best: Date | null = null;
  for (const y of candidates) {
    const d = new Date(Date.UTC(y, month, day));
    if (d.getUTCMonth() !== month) continue;
    if (!best || Math.abs(d.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime())) best = d;
  }
  return best ? best.getUTCDay() : null;
}
function enDayLike(token: string, idx: number): string {
  const full = EN_DAYS[idx];
  const out = token.length <= 4 ? full.slice(0, 3) : full;
  return token[0] === token[0].toLowerCase() ? out.toLowerCase() : out;
}

export interface WeekdayFix { found: string; corrected: string }

/**
 * Second line of defence: a weekday written next to a date that it does not fall on is corrected
 * to the real weekday ("Saturday, November 22" in 2026 -> "Sunday, November 22"; 「11月22日（周六）」->「11月22日（周日）」).
 */
export function fixWeekdayDates(text: string, now: Date = new Date()): { text: string; fixed: WeekdayFix[] } {
  const fixed: WeekdayFix[] = [];
  if (typeof text !== 'string' || !text) return { text, fixed };
  const record = (found: string, corrected: string) => { if (found !== corrected) fixed.push({ found, corrected }); return corrected; };
  const yearOf = (y?: string) => (y ? Number(y) : undefined);
  let out = text;
  // "Saturday, November 22" / "Sat Nov 22, 2026"
  out = out.replace(new RegExp(`\\b${EN_DAY_RE},?\\s+${EN_MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+((?:19|20)\\d{2}))?`, 'gi'), (m, dayTok, monTok, dd, yy) => {
    const want = weekdayOf(enMonthIndex(monTok), Number(dd), now, yearOf(yy));
    if (want === null || want === enDayIndex(dayTok)) return m;
    return record(m, m.replace(dayTok, enDayLike(dayTok, want)));
  });
  // "Saturday, 22 November"
  out = out.replace(new RegExp(`\\b${EN_DAY_RE},?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+${EN_MONTH_RE}(?:,?\\s+((?:19|20)\\d{2}))?`, 'gi'), (m, dayTok, dd, monTok, yy) => {
    const want = weekdayOf(enMonthIndex(monTok), Number(dd), now, yearOf(yy));
    if (want === null || want === enDayIndex(dayTok)) return m;
    return record(m, m.replace(dayTok, enDayLike(dayTok, want)));
  });
  // "November 22 (Saturday)" / "Nov 22, Sat"
  out = out.replace(new RegExp(`\\b${EN_MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+((?:19|20)\\d{2}))?\\s*[,(（]\\s*${EN_DAY_RE}\\b`, 'gi'), (m, monTok, dd, yy, dayTok) => {
    const want = weekdayOf(enMonthIndex(monTok), Number(dd), now, yearOf(yy));
    if (want === null || want === enDayIndex(dayTok)) return m;
    return record(m, m.replace(new RegExp(`${dayTok}$`), enDayLike(dayTok, want)));
  });
  // 「(2026年)11月22日（周六）」「11月22日星期六」「11月22日 周六」
  out = out.replace(new RegExp(`(?:((?:19|20)\\d{2})年)?(\\d{1,2})月(\\d{1,2})[日号]\\s*[（(]?\\s*${ZH_DAY_RE}`, 'g'), (m, yy, mm, dd, prefix, ch) => {
    const want = weekdayOf(Number(mm) - 1, Number(dd), now, yearOf(yy));
    if (want === null || want === zhDayIndex(ch)) return m;
    return record(m, m.replace(new RegExp(`${prefix}${ch}$`), `${prefix}${ZH_DAYS[want]}`));
  });
  // 「周六（11月22日）」「本周六 11月22日」
  out = out.replace(new RegExp(`${ZH_DAY_RE}\\s*[（(]?\\s*(?:((?:19|20)\\d{2})年)?(\\d{1,2})月(\\d{1,2})[日号]`, 'g'), (m, prefix, ch, yy, mm, dd) => {
    const want = weekdayOf(Number(mm) - 1, Number(dd), now, yearOf(yy));
    if (want === null || want === zhDayIndex(ch)) return m;
    return record(m, m.replace(`${prefix}${ch}`, `${prefix}${ZH_DAYS[want]}`));
  });
  return { text: out, fixed };
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
