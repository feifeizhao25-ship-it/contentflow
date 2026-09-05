import { subscriptionPeriodEnd } from './subscription-period';
it.each([
 ['2026-01-31T12:30:00Z', 'monthly', '2026-02-28T12:30:00.000Z'],
 ['2024-01-31T12:30:00Z', 'monthly', '2024-02-29T12:30:00.000Z'],
 ['2024-02-29T12:30:00Z', 'yearly', '2025-02-28T12:30:00.000Z'],
 ['2026-12-15T12:30:00Z', 'monthly', '2027-01-15T12:30:00.000Z'],
] as const)('会员期限正确处理月末与闰年 %s', (date, cycle, expected) => {
 expect(subscriptionPeriodEnd(new Date(date), cycle).toISOString()).toBe(expected);
});
