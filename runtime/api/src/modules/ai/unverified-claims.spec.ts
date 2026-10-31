import { findUnverifiedClaims } from './unverified-claims';

describe('findUnverifiedClaims', () => {
  it('flags the figure and brand the model invented (the UI-test article: 83% essence, BOBBI BROWN)', () => {
    const out = findUnverifiedClaims('这款含有83%精华水的BOBBI BROWN虫草粉底液很服帖', '秋冬干皮粉底液 保湿');
    expect(out).toEqual(['83%', 'BOBBI BROWN']);
  });

  it('does not flag what the user supplied', () => {
    expect(findUnverifiedClaims('Save 20% on the NIKON Z6 kit', 'NIKON Z6 20% discount')).toEqual([]);
  });

  it('ignores common acronyms and plain prose', () => {
    expect(findUnverifiedClaims('Use SPF cream, an LED lamp and a USB hub for your DIY vlog.', 'desk setup')).toEqual([]);
  });

  it('matches whole numbers only (the user gave 120, not 20)', () => {
    expect(findUnverifiedClaims('A 20% boost', 'about 120 items')).toEqual(['20%']);
  });

  it('handles 百分之 and empty input', () => {
    expect(findUnverifiedClaims('百分之九十五的人', '')).toEqual([]);
    expect(findUnverifiedClaims('百分之95的人', '')).toEqual(['百分之95']);
    expect(findUnverifiedClaims('', 'x')).toEqual([]);
  });
});
