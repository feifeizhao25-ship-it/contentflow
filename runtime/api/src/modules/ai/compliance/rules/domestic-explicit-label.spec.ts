import { labelAiGeneratedText } from '../../../../common/ai-content-label';
import { domesticExplicitLabelBlock, DOMESTIC_EXPLICIT_LABEL_CODE } from './domestic-explicit-label';

describe('国内发布包显式标识', () => {
  it('现行中文标识可以通过', () => {
    expect(domesticExplicitLabelBlock(labelAiGeneratedText('台灯教程'), true)).toBeNull();
    expect(domesticExplicitLabelBlock('【本内容由 AI 生成】\n正文', true)).toBeNull();
  });

  it('AI 内容缺少标识时拦截，并说明没有提交到平台', () => {
    const block = domesticExplicitLabelBlock('只有正文', true);
    expect(block?.code).toBe(DOMESTIC_EXPLICIT_LABEL_CODE);
    expect(block?.message).toContain('没有向平台提交');
    expect(block?.message).toMatch(/[一-鿿]/);
    expect(block?.issues.map((issue) => issue.code)).toEqual(['explicit_missing_ai_element', 'explicit_missing_generation_element']);
  });

  it('只有人工智能、没有生成或合成时提示缺生成要素', () => {
    const block = domesticExplicitLabelBlock('本内容由人工智能辅助', true);
    expect(block?.issues.map((issue) => issue.code)).toEqual(['explicit_missing_generation_element']);
  });

  it('空字符串和未传文字都拦截', () => {
    expect(domesticExplicitLabelBlock('', true)?.issues[0].code).toBe('explicit_missing');
    expect(domesticExplicitLabelBlock(undefined, true)?.issues[0].code).toBe('explicit_missing');
    expect(domesticExplicitLabelBlock(null, true)?.issues[0].code).toBe('explicit_missing');
  });

  it('人工内容不要求显式标识', () => {
    expect(domesticExplicitLabelBlock('只有正文', false)).toBeNull();
    expect(domesticExplicitLabelBlock('', false)).toBeNull();
  });
});
