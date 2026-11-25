import { localStubCompletion } from './local-ai-stub';

/**
 * 分10 复算（桩）。
 * 输入：含「主题：周末早餐搭配」和「生图提示词」的中文提示。
 * 旧结果：封面三行是 a quiet reading desk / a paper notebook / warm afternoon light，与选题无关。
 * 新结果：三行都含选题，且是中文。
 * 正确值：中文提示词，并带上选题。
 * 依据：国内版封面提示词不能是与选题无关的英文。
 */
describe('国内封面提示词桩', () => {
  it('中文正文提示的封面三行是中文并带选题', () => {
    const raw = localStubCompletion('请创作一篇内容，主题：周末早餐搭配\n请在回答最后输出生图提示词');
    const lines = raw.content.split('\n').slice(-3);
    expect(lines).toEqual([
      '周末早餐搭配，室内，自然光',
      '周末早餐搭配的近景，暖色',
      '周末早餐搭配的俯拍构图',
    ]);
  });
});