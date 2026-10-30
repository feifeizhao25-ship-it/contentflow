/** 调度表（Asia/Shanghai）。@Cron 表达式与 Python 版 daily/weekly/monthly 写法一一对应。 */
export const SIL_TIMEZONE = 'Asia/Shanghai';
export const SIL_CRON = {
  daily_scan: '0 2 * * *',
  weekly_cycle: '0 3 * * 0', // 周日 03:00
  weekly_report: '30 9 * * 1', // 周一 09:30
  monthly_maintenance: '0 4 1 * *',
} as const;

/** 只支持本表用到的 5 段写法（分 时 日 月 周，数字或 *），返回 now 之后的下一次触发（上海时间，以 UTC Date 表示）。 */
export function nextRun(cron: string, now: Date): Date {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5 || parts.some((p) => !/^(\*|\d+)$/.test(p))) throw new Error(`bad_cron:${cron}`);
  const [mi, hh, dom, mon, dow] = parts.map((p) => (p === '*' ? null : Number(p)));
  const OFFSET = 8 * 3_600_000;
  let t = Math.floor((now.getTime() + OFFSET) / 60_000) * 60_000 + 60_000;
  for (let i = 0; i < 366 * 24 * 60; i++, t += 60_000) {
    const d = new Date(t);
    if ((mi === null || d.getUTCMinutes() === mi) && (hh === null || d.getUTCHours() === hh) && (dom === null || d.getUTCDate() === dom) && (mon === null || d.getUTCMonth() + 1 === mon) && (dow === null || d.getUTCDay() === dow)) {
      return new Date(t - OFFSET);
    }
  }
  throw new Error('no_next_run');
}
