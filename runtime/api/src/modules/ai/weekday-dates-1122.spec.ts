import { currentDatePromptLine, fixWeekdayDates } from './current-date';

// 2026-11-21 14:10 UTC (22:10 Asia/Shanghai): the time of the round-2 test. 2026-11-21 is a Saturday, 11-22 a Sunday.
const NOW = new Date('2026-11-21T14:10:00Z');

describe('weekday/date mismatches in generated copy (2026-11-21 round 2)', () => {
  it('corrects the exact sentence from the test', () => {
    const r = fixWeekdayDates('Join us this Saturday, November 22 for the tasting.', NOW);
    expect(r.text).toBe('Join us this Sunday, November 22 for the tasting.');
    expect(r.fixed).toEqual([{ found: 'Saturday, November 22', corrected: 'Sunday, November 22' }]);
  });
  it.each([
    ['Sat, Nov 22', 'Sun, Nov 22'],
    ['Saturday 22 November', 'Sunday 22 November'],
    ['November 22 (Saturday)', 'November 22 (Sunday)'],
    ['Monday, December 25, 2026', 'Friday, December 25, 2026'],
    ['Friday, January 1', 'Friday, January 1'], // 2027-01-01 is a Friday: the nearest Jan 1 to late November 2026
    ['11月22日（周六）', '11月22日（周日）'],
    ['11月22日星期六', '11月22日星期日'],
    ['2026年11月21日 周日', '2026年11月21日 周六'],
    ['本周六（11月22日）', '本周日（11月22日）'],
  ])('%s -> %s', (input, expected) => expect(fixWeekdayDates(input, NOW).text).toBe(expected));
  it.each([
    'Sunday, November 22',
    'Saturday, November 21',
    '11月22日（周日）',
    'Open Monday to Friday. Sale ends November 30.',
    'Monitor May 3 shipments',
    '一杯咖啡的故事',
  ])('leaves correct or date-free text alone: %s', (t) => expect(fixWeekdayDates(t, NOW)).toEqual({ text: t, fixed: [] }));
  it('the prompt line names today\'s weekday and the next seven days', () => {
    const en = currentDatePromptLine(true, NOW);
    expect(en).toContain('Saturday, 2026-11-21');
    expect(en).toContain('Sunday November 22');
    expect(en).toContain('Friday November 27');
    const zh = currentDatePromptLine(false, NOW);
    expect(zh).toContain('星期六');
    expect(zh).toContain('11月22日周日');
  });
});
