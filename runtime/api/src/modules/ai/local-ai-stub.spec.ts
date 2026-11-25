import { localStubCompletion } from './local-ai-stub';

/**
 * 分9 复算（桩，没有模型）。
 * 输入：分镜提示词，选题「周末早餐搭配」。
 * 旧结果：桩返回散文，解析失败，接口 502「分镜格式无法读取」。
 * 新结果：合法 JSON，标题含「示例」和选题，两镜。
 * 正确值：结构能被 JSON.parse，且标明示例。
 * 依据：本地桩不产出分镜时，重试也不会成功，应直接给示例结构。
 */
describe('分镜桩', () => {
  it('中文分镜提示返回示例 JSON，并带上选题', () => {
    const raw = localStubCompletion('为抖音创作分镜脚本，主题：周末早餐搭配\n只输出 JSON，格式 {"scenes":[]}');
    const parsed = JSON.parse(raw.content);
    expect(parsed.title).toBe('示例：周末早餐搭配');
    expect(parsed.scenes).toHaveLength(2);
    expect(parsed.scenes[0].subtitle).toContain('示例');
    expect(parsed.scenes[0].visual).toContain('周末早餐搭配');
  });

  it('英文分镜提示不带汉字', () => {
    const raw = localStubCompletion('Write a storyboard script. Topic: morning routine\nOutput JSON only {"scenes":[]}');
    const parsed = JSON.parse(raw.content);
    expect(JSON.stringify(parsed)).not.toMatch(/[\u3400-\u9fff]/);
    expect(parsed.title).toContain('Example');
  });
});