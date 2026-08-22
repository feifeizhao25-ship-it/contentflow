import { parseGeneratedTitles } from './title-parser';

describe('parseGeneratedTitles', () => {
  it('strips explanatory prefix lines like "以下是……"', () => {
    const raw = [
      '以下是为您生成的5个吸引人的标题：',
      '1. 标题A',
      '2. 标题B',
      '3. 标题C',
    ].join('\n');

    const titles = parseGeneratedTitles(raw, 5);
    expect(titles).toEqual(['标题A', '标题B', '标题C']);
    expect(titles.some((t) => t.includes('以下是'))).toBe(false);
  });

  it('drops trailing courtesy lines like "希望对你有帮助"', () => {
    const raw = ['标题A', '标题B', '希望这些标题对您有帮助！', '如需调整请告诉我'].join('\n');
    expect(parseGeneratedTitles(raw, 5)).toEqual(['标题A', '标题B']);
  });

  it('removes list markers, markdown emphasis and wrapping quotes', () => {
    const raw = [
      '- **「标题A」**',
      '1、 《标题B》 ',
      '2) "标题C"',
      '标题3：标题D',
    ].join('\n');
    expect(parseGeneratedTitles(raw, 10)).toEqual(['标题A', '标题B', '标题C', '标题D']);
  });

  it('skips separator lines, header-only lines and overlong lines', () => {
    const raw = [
      '---',
      '标题：',
      '短标题',
      '这是一个远远超过五十个字符上限因此绝不可能是合格标题的说明性长句子它不应该被当作标题返回给用户',
    ].join('\n');
    expect(parseGeneratedTitles(raw, 10)).toEqual(['短标题']);
  });

  it('deduplicates and respects the requested count', () => {
    const raw = ['标题A', '标题A', '标题B', '标题C'].join('\n');
    expect(parseGeneratedTitles(raw, 2)).toEqual(['标题A', '标题B']);
  });

  it('fails closed when no valid title can be parsed', () => {
    const raw = ['以下是为您生成的标题：', '希望对您有帮助！'].join('\n');
    expect(() => parseGeneratedTitles(raw, 5)).toThrow(/未通过结构化校验/);
    expect(() => parseGeneratedTitles('', 5)).toThrow(/未通过结构化校验/);
  });
});
