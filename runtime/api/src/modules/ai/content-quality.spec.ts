import { sanitizeTitles, scoreContent, sourcesForPlatform } from './ai.service';

describe('AI content contract', () => {
  it('removes numbering and explanatory lines from titles', () => {
    expect(sanitizeTitles(
      '以下是推荐标题：\n1. 真正可发布的标题\n（制造悬念）\n- 第二个可靠标题',
      5,
    )).toEqual(['真正可发布的标题', '第二个可靠标题']);
  });

  it('scores sourced content higher and returns actionable dimensions', () => {
    const unsourced = scoreContent('Short draft', []);
    const sourced = scoreContent('A structured draft.\nWith evidence and action.', [{
      title: 'Policy',
      url: 'https://example.test',
      publisher: 'Official publisher',
      verifiedAt: '2026-07-30',
    }]);
    expect(sourced.total).toBeGreaterThan(unsourced.total);
    expect(sourced).toEqual(expect.objectContaining({
      accuracy: expect.any(Number),
      professionalism: expect.any(Number),
      platformFit: expect.any(Number),
      citation: expect.any(Number),
      safety: 10,
    }));
  });

  it('keeps domestic and international platform sources isolated', () => {
    expect(sourcesForPlatform('douyin')[0].publisher).toBe('抖音');
    expect(sourcesForPlatform('linkedin')[0].publisher).toBe('LinkedIn');
    expect(sourcesForPlatform('unknown')).toEqual([]);
  });
});
