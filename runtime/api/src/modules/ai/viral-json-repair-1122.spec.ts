import { parseViralAnalysis, repairModelJson } from './viral-analysis';

// The exact shape returned on 2026-11-21 (ev/api_r2/contentflow_cn/r2cn_王姐_烘焙店/07_viral_clean.json), shortened.
const BROKEN = '{"标题吸引力评分和技巧":{"评分":"7.5/10","技巧":"叠加松弛感"},"开头钩子分析":"以时间场景开场"},"内容结构特点":"短句口语化"},"情绪触发点":"安心感"},"可复制的模板":"周末[健康品类]出炉啦"}';

describe('model JSON repair for the viral analysis (2026-11-22)', () => {
  it('parses the 11-21 clean-copy answer into fields instead of raw text', () => {
    const r = parseViralAnalysis(BROKEN, { completionTokens: 300, maxTokens: 2000, english: false });
    expect(r.repaired).toBe(true);
    expect(r.truncated).toBe(false);
    expect(r.analysis.raw_analysis).toBeUndefined();
    expect(Object.keys(r.analysis)).toEqual(['标题吸引力评分和技巧', '开头钩子分析', '内容结构特点', '情绪触发点', '可复制的模板']);
    expect(r.analysis['标题吸引力评分和技巧']).toEqual({ 评分: '7.5/10', 技巧: '叠加松弛感' });
    expect(r.analysis['可复制的模板']).toBe('周末[健康品类]出炉啦');
  });

  it('removes trailing commas and keeps braces inside strings', () => {
    expect(repairModelJson('{"a":"x } y","b":[1,2,],}')).toEqual({ a: 'x } y', b: [1, 2] });
    expect(repairModelJson('{"a":"say \\"hi\\" }"}}')).toEqual({ a: 'say "hi" }' });
  });

  it('does not invent the end of a cut-off answer', () => {
    expect(repairModelJson('{"a":"x","b":{"c":"y"')).toBeNull();
    const r = parseViralAnalysis('{"a":"x","b":"cut', { completionTokens: 2000, maxTokens: 2000, english: false });
    expect(r.truncated).toBe(true);
    expect(r.repaired).toBeUndefined();
  });

  it('valid JSON is untouched and not marked repaired', () => {
    const r = parseViralAnalysis('{"a":"x"}', { completionTokens: 10, maxTokens: 2000, english: false });
    expect(r.analysis).toEqual({ a: 'x' });
    expect(r.repaired).toBeUndefined();
  });

  it('plain text is still shown as text', () => {
    const r = parseViralAnalysis('这是一段纯文本分析。', { completionTokens: 10, maxTokens: 2000, english: false });
    expect(r.analysis.raw_analysis).toBe('这是一段纯文本分析。');
  });
});
