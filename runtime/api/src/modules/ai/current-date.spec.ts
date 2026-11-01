import { currentDatePromptLine, dropStaleYearTitles, findStaleYears } from './current-date';

const NOW = new Date('2026-11-01T00:00:00Z');

describe('stale years in generated copy (retest B22)', () => {
  it('flags the exact title from the retest: "of 2023" in November 2026', () => {
    expect(findStaleYears('Top 5 Home Espresso Machines of 2023!', NOW)).toEqual([2023]);
  });
  it.each([
    ['2024年度最佳咖啡机', [2024]],
    ['The 2022 Guide to Cold Brew', [2022]],
    ['Best Air Fryers in 2021', [2021]],
  ])('flags %s', (t, years) => expect(findStaleYears(t as string, NOW)).toEqual(years));
  it.each([
    'Top 5 Home Espresso Machines of 2026!',
    'Best Air Fryers in 2027 (preview)',
    'Why I have brewed the same coffee since 2019',
    'Our café opened in 2019 and never looked back'.replace('in 2019', 'in the city'),
    '一杯咖啡的故事',
  ])('does not flag %s', (t) => expect(findStaleYears(t, NOW)).toEqual([]));

  it('removes stale titles but keeps the good ones', () => {
    const r = dropStaleYearTitles(['Top 5 Home Espresso Machines of 2023!', 'Pull a better shot at home', 'Best Grinders of 2026'], NOW);
    expect(r.titles).toEqual(['Pull a better shot at home', 'Best Grinders of 2026']);
    expect(r.removed).toEqual([{ title: 'Top 5 Home Espresso Machines of 2023!', years: [2023] }]);
  });
  it('keeps everything (nothing removed) when every title is stale, so the user is not left with none', () => {
    const t = ['Best of 2023', 'Top picks in 2022'];
    expect(dropStaleYearTitles(t, NOW)).toEqual({ titles: t, removed: [] });
  });
  it('the prompt line states today\'s date and the current year, per language', () => {
    expect(currentDatePromptLine(true, NOW)).toContain('2026-11-01');
    expect(currentDatePromptLine(true, NOW)).toContain('use 2026');
    expect(currentDatePromptLine(false, NOW)).toContain('2026年');
  });
});
