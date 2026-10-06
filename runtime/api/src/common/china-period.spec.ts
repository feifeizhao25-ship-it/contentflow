import { chinaDayStart, chinaMonthPeriod, chinaMonthStart } from './china-period';

describe('北京时间自然日 / 自然月', () => {
  it('UTC 9 月 30 日 16:30 已是北京时间 10 月 1 日', () => {
    expect(chinaMonthPeriod(new Date('2026-09-30T16:30:00Z'))).toBe('2026-10');
    expect(chinaMonthPeriod(new Date('2026-09-30T15:59:59Z'))).toBe('2026-09');
  });
  it('当日 / 当月起点', () => {
    expect(chinaDayStart(new Date('2026-10-06T01:00:00Z')).toISOString()).toBe('2026-10-05T16:00:00.000Z');
    expect(chinaMonthStart(new Date('2026-10-06T01:00:00Z')).toISOString()).toBe('2026-09-30T16:00:00.000Z');
  });
});
