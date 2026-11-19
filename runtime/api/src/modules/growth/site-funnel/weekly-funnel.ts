/**
 * 全站每周漏斗汇总（只读、只出聚合）。
 *
 * 周按上海时间（Asia/Shanghai，UTC+8，无夏令时）切：周日 00:00:00 到周六 23:59:59，
 * 即左闭右开 [周日 00:00, 下周日 00:00)。
 *
 * 只做读查询，不写任何表。响应里没有工作区（租户）编号、用户编号、订单号、手机号、邮箱，
 * 也不按工作区拆分计数。口径见 runtime/docs/SITE_FUNNEL_WEEKLY.md。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export const READONLY_TOKEN_ENV = 'FENFAXIA_FUNNEL_READONLY_TOKEN';
export const MAX_WEEKS = 26;
export const DEFAULT_WEEKS = 4;
/** 算作「已付款」的订单状态：付款后申请退款、已退款的订单，付款那一刻仍是一笔付款。 */
export const PAID_ORDER_STATES = ['paid', 'refund_pending', 'refunded'] as const;
export const SOURCE_TABLE_MISSING_NOTE =
  '注册来源表 GrowthSignupSource 不存在（注册来源题尚未上线或未合入），本项为空，不代表 0。';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const SHANGHAI_OFFSET = 8 * HOUR;

/** 注册来源题（PR #120）的选项顺序。合入前这里只用来排顺序，统计以表里实际的代码为准。 */
const SOURCE_ORDER = ['xiaohongshu', 'douyin', 'shipinhao', 'gongzhonghao', 'zhihu', 'bilibili', 'search', 'friend', 'other'];

export class WeekError extends Error {}

export interface WeekRange { start: Date; end: Date }

export interface WeeklyFunnelRow {
  week_start: string;
  week_end: string;
  complete: boolean;
  new_signups: number;
  new_paid: number;
  renewals: number;
  order_amount_fen: number;
  refund_amount_fen: number;
  expirations: number;
  signups_by_source: Record<string, number> | null;
  signups_by_source_note?: string;
}

/** moment 所在周（上海时间）的周日 00:00。 */
export function weekStartOf(moment: Date): Date {
  const local = moment.getTime() + SHANGHAI_OFFSET;
  const dayIndex = Math.floor(local / DAY);
  const dow = new Date(dayIndex * DAY).getUTCDay(); // 0 = 周日
  return new Date((dayIndex - dow) * DAY - SHANGHAI_OFFSET);
}

export function parseWeekStart(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new WeekError('week_start 须为 YYYY-MM-DD');
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new WeekError('week_start 须为 YYYY-MM-DD');
  }
  if (check.getUTCDay() !== 0) throw new WeekError('week_start 须为周日（上海时间）');
  return new Date(utc - SHANGHAI_OFFSET);
}

export function parseWeeks(value: unknown): number {
  if (value === undefined || value === null || value === '') return DEFAULT_WEEKS;
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new WeekError(`weeks 须在 1 到 ${MAX_WEEKS} 之间`);
  const weeks = Number(text);
  if (weeks < 1 || weeks > MAX_WEEKS) throw new WeekError(`weeks 须在 1 到 ${MAX_WEEKS} 之间`);
  return weeks;
}

export function weekRanges(lastWeekStart: Date, weeks: number): WeekRange[] {
  const out: WeekRange[] = [];
  for (let back = weeks - 1; back >= 0; back -= 1) {
    const start = lastWeekStart.getTime() - back * WEEK;
    out.push({ start: new Date(start), end: new Date(start + WEEK) });
  }
  return out;
}

/** 带 +08:00 的上海时间，精确到秒。 */
export function shanghaiIso(moment: Date): string {
  return `${new Date(moment.getTime() + SHANGHAI_OFFSET).toISOString().slice(0, 19)}+08:00`;
}

/** 订单金额是 Decimal（元），转成整数分。 */
export function yuanToFen(amount: unknown): number {
  const value = Number(typeof amount === 'object' && amount !== null ? String(amount) : amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

const inRange = (moment: Date | null | undefined, start: Date, end: Date) =>
  !!moment && moment.getTime() >= start.getTime() && moment.getTime() < end.getTime();

@Injectable()
export class SiteFunnelService {
  constructor(private readonly prisma: PrismaService) {}

  async report(query: { week_start?: string; weeks?: unknown }, now: Date = new Date()) {
    const current = weekStartOf(now);
    const last = query.week_start ? parseWeekStart(query.week_start) : current;
    if (last.getTime() > current.getTime()) throw new WeekError('week_start 不能晚于本周（上海时间）');
    const ranges = weekRanges(last, parseWeeks(query.weeks));
    return {
      timezone: 'Asia/Shanghai',
      week_definition: '周日 00:00:00 至周六 23:59:59（上海时间）',
      scope: 'site',
      currency: 'CNY',
      money_unit: '分',
      generated_at: shanghaiIso(now),
      weeks: await this.summarize(ranges, now),
    };
  }

  async summarize(ranges: WeekRange[], now: Date): Promise<WeeklyFunnelRow[]> {
    const p = this.prisma as any;
    const first = ranges[0].start;
    const lastEnd = ranges[ranges.length - 1].end;

    // 付款：拿到截至最后一周结束前的全部已付款订单，才能判断「此前是否付过」。只在内存里用工作区编号去重，不输出。
    const paid: { tenant_id: string; paid_at: Date; amount: unknown }[] = await p.paymentOrder.findMany({
      where: { currency: 'CNY', status: { in: [...PAID_ORDER_STATES] }, paid_at: { not: null, lt: lastEnd } },
      select: { tenant_id: true, paid_at: true, amount: true },
    });
    paid.sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime());
    const firstPaid = new Map<string, number>();
    for (const order of paid) {
      if (!firstPaid.has(order.tenant_id)) firstPaid.set(order.tenant_id, new Date(order.paid_at).getTime());
    }

    // 退款：表里没有退款时间列，用订单进入 refunded 时写下的 updated_at。
    const refunded: { amount: unknown; updated_at: Date }[] = await p.paymentOrder.findMany({
      where: { currency: 'CNY', status: 'refunded', updated_at: { gte: first, lt: lastEnd } },
      select: { amount: true, updated_at: true },
    });

    // 到期：每个工作区只有一条订阅；续费会把 current_period_end 往后推，所以落在本周且已过去、仍为 active 的就是到期没续。
    const cutoff = new Date(Math.min(lastEnd.getTime(), now.getTime()));
    const ended: { current_period_end: Date }[] = await p.subscription.findMany({
      where: { status: 'active', plan: { not: 'free' }, current_period_end: { gte: first, lt: cutoff } },
      select: { current_period_end: true },
    });

    const sourceTable = await this.sourceTablePresent();
    const rows: WeeklyFunnelRow[] = [];
    for (const { start, end } of ranges) {
      const weekOrders = paid.filter((o) => inRange(new Date(o.paid_at), start, end));
      const newPaid = new Set<string>();
      let renewals = 0;
      for (const order of weekOrders) {
        const at = new Date(order.paid_at).getTime();
        if (firstPaid.get(order.tenant_id) === at) newPaid.add(order.tenant_id);
        else renewals += 1;
      }
      const weekCutoff = new Date(Math.min(end.getTime(), now.getTime()));
      const bySource = sourceTable ? await this.signupsBySource(start, end) : null;
      const row: WeeklyFunnelRow = {
        week_start: shanghaiIso(start),
        week_end: shanghaiIso(new Date(end.getTime() - 1000)),
        complete: now.getTime() >= end.getTime(),
        new_signups: await p.user.count({ where: { created_at: { gte: start, lt: end } } }),
        new_paid: newPaid.size,
        renewals,
        order_amount_fen: weekOrders.reduce((sum, o) => sum + yuanToFen(o.amount), 0),
        refund_amount_fen: refunded
          .filter((o) => inRange(new Date(o.updated_at), start, end))
          .reduce((sum, o) => sum + yuanToFen(o.amount), 0),
        expirations: ended.filter((s) => inRange(new Date(s.current_period_end), start, weekCutoff)).length,
        signups_by_source: bySource,
      };
      if (bySource === null) row.signups_by_source_note = SOURCE_TABLE_MISSING_NOTE;
      rows.push(row);
    }
    return rows;
  }

  private async sourceTablePresent(): Promise<boolean> {
    const rows: { present: boolean }[] = await (this.prisma as any).$queryRaw`
      SELECT to_regclass('"GrowthSignupSource"') IS NOT NULL AS present`;
    return Boolean(rows?.[0]?.present);
  }

  private async signupsBySource(start: Date, end: Date): Promise<Record<string, number>> {
    const p = this.prisma as any;
    const rows: { source: string; n: number | bigint }[] = await p.$queryRaw`
      SELECT s."source" AS source, COUNT(*)::int AS n
      FROM "GrowthSignupSource" s JOIN "GrowthEvent" e ON e."id" = s."event_id"
      WHERE e."event" = 'signup' AND e."created_at" >= ${start} AND e."created_at" < ${end}
      GROUP BY s."source"`;
    const counts: Record<string, number> = {};
    for (const code of SOURCE_ORDER) counts[code] = 0;
    for (const row of rows) counts[String(row.source)] = (counts[String(row.source)] ?? 0) + Number(row.n);
    const events: number = await p.growthEvent.count({ where: { event: 'signup', created_at: { gte: start, lt: end } } });
    const answered = Object.values(counts).reduce((a, b) => a + b, 0);
    counts.unanswered = Math.max(events - answered, 0);
    return counts;
  }
}
