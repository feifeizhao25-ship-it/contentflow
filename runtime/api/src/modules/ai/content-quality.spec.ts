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
    const sourced = scoreContent('A structured draft.\nEvidence from Official publisher [1].', [{
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
    const now = new Date('2026-07-30T12:00:00Z');
    expect(sourcesForPlatform('douyin', now)[0].publisher).toBe('抖音');
    expect(sourcesForPlatform('linkedin', now)[0].publisher).toBe('LinkedIn');
    expect(sourcesForPlatform('unknown')).toEqual([]);
  });

  it('fails closed when platform guidance is overdue for review', () => {
    expect(sourcesForPlatform(
      'tiktok',
      new Date('2026-09-01T00:00:00Z'),
      30,
    )).toEqual([]);
  });

  it('does not award full citation points for an uncited source list', () => {
    const source = [{
      title: 'Policy',
      url: 'https://example.test',
      publisher: 'Official publisher',
      verifiedAt: '2026-07-30',
    }];
    expect(scoreContent('A claim without a reference.', source).citation).toBeLessThan(
      scoreContent('A claim supported by Official publisher [1].', source).citation,
    );
  });
});
